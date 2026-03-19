# Contact Verification Design

**Date:** 2026-03-19
**Status:** Approved

## Overview

Add email and phone verification to the landing page lead capture flow. When a contact submits a landing page form, their email is validated via ZeroBounce (if configured), a one-click verification email is sent, and after clicking it an SMS OTP is automatically sent to verify their phone number. Verified status is displayed as badges in the contact view.

---

## Goals

- Block invalid email addresses at the landing page form using ZeroBounce
- Confirm contact owns their email address via one-click link
- Confirm contact owns their phone number via SMS OTP (auto-triggered after email verified)
- Display verification badges on the contact view page

---

## Non-Goals

- Admin-triggered re-verification
- Verification for contacts created manually (admin only, not via landing page)
- Email/phone verification for existing historical contacts

---

## Schema Changes

Eight new optional fields added to the `Contact` model in `prisma/schema.prisma`:

```prisma
emailVerified              Boolean   @default(false)
emailVerifiedAt            DateTime?
emailVerificationTokenHash String?   @unique   // SHA-256 hash of the raw token
emailVerificationSentAt    DateTime?
phoneVerified              Boolean   @default(false)
phoneVerifiedAt            DateTime?
phoneOtpCode               String?             // SHA-256 hash of the raw OTP (no unique index needed)
phoneOtpExpiresAt          DateTime?
phoneOtpAttempts           Int       @default(0)
phoneSessionTokenHash      String?   @unique   // SHA-256 hash of session token passed to success page
```

**Security model:**
- `emailVerificationTokenHash`: raw token sent in email link, hashed before storage. Lookup by hashing the incoming token. Consistent with existing `User.resetTokenHash` pattern.
- `phoneOtpCode`: SHA-256 hash of the 6-digit OTP, compared with `crypto.timingSafeEqual`.
- `phoneOtpAttempts`: incremented on each failed attempt; OTP invalidated after 5 failures.
- `phoneSessionTokenHash`: raw token included in success page URL after email verification. Used to identify the contact for the OTP submission step without exposing the internal contact ID.

Migration: `prisma migrate dev --name add_contact_verification`

---

## Environment Variables

```
ZEROBOUNCE_API_KEY=        # Optional. If absent, email validation is skipped.
NEXT_PUBLIC_APP_URL=       # Required for building the verification link in emails.
                           # Already used in email-service.ts. Must be set.
# TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER — already exist
```

---

## New Files

### `lib/services/zerobounce.ts`

Thin client for the ZeroBounce email validation API.

```ts
validateEmail(email: string): Promise<'valid' | 'invalid' | 'unknown'>
```

- If `ZEROBOUNCE_API_KEY` is not set, returns `'unknown'` immediately (no-op)
- Status mapping:
  - `valid` → `'valid'`
  - `invalid`, `abuse`, `disposable`, `spamtrap` → `'invalid'`
  - everything else (unknown, catch-all, etc.) → `'unknown'`
- On any network or API error, returns `'unknown'` (fail open — do not block submissions on transient errors)

### `lib/communications/verification-service.ts`

Handles email and phone verification flows.

---

**`sendEmailVerification(contactId: string): Promise<void>`**

1. Load contact from DB; read `contact.email`. If `contact.email` is null, log a warning and return (cannot send verification without an email address).
2. If `contact.emailVerified === true`, skip sending (do not reset verification for already-verified contacts).
3. Generate a cryptographically random 32-byte token via `crypto.randomBytes(32).toString('hex')`.
4. Hash the token: `SHA-256(rawToken)` → store as `emailVerificationTokenHash`.
5. Set `emailVerificationSentAt = now`.
6. Build verification URL: `${process.env.NEXT_PUBLIC_APP_URL}/api/verify/email/${rawToken}`.
7. Call `sendTransactionalEmail()` (bypasses `emailOptOut` check, appropriate for transactional messages). Any send failure is already logged to the `EmailMessage` record by the existing service.

---

**`sendPhoneOtp(contactId: string): Promise<{ sent: boolean; sessionToken?: string }>`**

1. Check contact has a phone number (`contact.phone` or first `ContactPhone` entry). If not, return `{ sent: false }`.
2. Check Twilio is configured (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` all set). If not, return `{ sent: false }`.
3. Generate a 6-digit numeric OTP: `Math.floor(100000 + Math.random() * 900000).toString()`.
4. Hash OTP: `SHA-256(otp)` → store as `phoneOtpCode`. Set `phoneOtpExpiresAt = now + 1 hour`. Reset `phoneOtpAttempts = 0`.
5. Generate a 32-byte random session token. Hash it → store as `phoneSessionTokenHash`. The raw token is returned to the caller for inclusion in the success page redirect URL.
6. Send SMS via existing `sendSms()` service: `"Your verification code is: XXXXXX. It expires in 1 hour."`
7. Return `{ sent: true, sessionToken: rawSessionToken }`.

---

**`verifyPhoneOtp(sessionToken: string, code: string): Promise<'verified' | 'invalid' | 'expired' | 'locked' | 'not_found'>`**

1. Hash the incoming `sessionToken`; find contact by `phoneSessionTokenHash`. If not found, return `'not_found'`.
2. If `phoneOtpAttempts >= 5`, return `'locked'` (brute-force protection).
3. If `phoneOtpExpiresAt` is in the past, clear OTP fields, return `'expired'`.
4. Hash the incoming `code`; compare to `phoneOtpCode` using `crypto.timingSafeEqual()` (constant-time comparison prevents timing attacks).
5. On mismatch: increment `phoneOtpAttempts`, return `'invalid'`.
6. On match: set `phoneVerified=true`, `phoneVerifiedAt=now`, clear `phoneOtpCode`, `phoneOtpExpiresAt`, `phoneOtpAttempts`, `phoneSessionTokenHash`. Return `'verified'`.

---

## Modified Files

### `app/api/landing-pages/[slug]/lead/route.ts`

Add before contact upsert:
1. Call `validateEmail(email)`. If result is `'invalid'`, return `400 { error: 'Please enter a valid email address.' }`.
2. After contact upsert, call `sendEmailVerification(contact.id)` (fire-and-forget; failures are logged to `EmailMessage` by the transactional email service).

---

## New API Routes

### `app/api/verify/email/[token]/route.ts`

`GET` handler — this is the URL embedded in the verification email:

1. Hash the incoming `token` parameter.
2. Find contact by `emailVerificationTokenHash`. If not found, redirect to `${NEXT_PUBLIC_APP_URL}/verify/email/invalid`.
3. Set `emailVerified=true`, `emailVerifiedAt=now`, clear `emailVerificationTokenHash`.
4. Call `sendPhoneOtp(contact.id)`. Capture `{ sent, sessionToken }`.
5. Build redirect URL: `/verify/email/success?phone=${sent}&st=${sessionToken ?? ''}`.
6. Redirect (302) to the success page.

### `app/api/verify/phone/route.ts`

`POST` — body: `{ sessionToken: string, code: string }`:

| Result | HTTP Status | Response Body |
|--------|-------------|---------------|
| verified | 200 | `{ success: true }` |
| invalid | 400 | `{ error: 'invalid', message: 'Incorrect code.' }` |
| expired | 410 | `{ error: 'expired', message: 'Code has expired.' }` |
| locked | 429 | `{ error: 'locked', message: 'Too many attempts. Please contact support.' }` |
| not_found | 404 | `{ error: 'not_found', message: 'Session not found.' }` |

---

## New Public Pages

All pages live under `app/(public)/verify/email/`.

### `app/(public)/verify/email/success/page.tsx`

Client component. Reads query params: `phone` (`'true'|'false'`) and `st` (session token).

**Always shows:** green checkmark icon, heading "Email address confirmed!", subtext "Thank you for confirming your email."

**If `phone=true`:**
- Shows subtext: "We also sent a 6-digit code to your phone. Enter it below to verify your number."
- 6-digit OTP input (individual digit boxes or single input, styled consistently with existing form components)
- "Verify Phone" submit button
- On submit: `POST /api/verify/phone` with `{ sessionToken: st, code: enteredCode }`
- On `200`: replace OTP form with "Phone number verified!" confirmation
- On `400`: show inline error "Incorrect code, please try again."
- On `410`: show "This code has expired."
- On `429`: show "Too many attempts."

**If `phone=false`:** shows only the email confirmation message. No OTP form.

### `app/(public)/verify/email/invalid/page.tsx`

Static page: heading "Link invalid or already used", subtext "This verification link has already been used or has expired."

---

## Settings Page Changes

### `app/admin/settings/page.tsx`

Add a "ZeroBounce" row to the existing provider status grid (same `process.env` check pattern as SMTP/Twilio rows):

- **Label:** ZeroBounce
- **Description:** Email validation
- **Status:** green checkmark + "Configured" if `process.env.ZEROBOUNCE_API_KEY` is set; grey "Not configured" otherwise

---

## Contact View Changes

### `app/admin/contacts/[id]/page.tsx`

In the left sidebar identity card, add inline badges:

- **Email row:** if `contact.emailVerified === true`, render a small green badge (`<CheckCircle>` icon + "Verified") with a tooltip: `Verified on [emailVerifiedAt formatted as MMM d, yyyy]`
- **Phone row:** if `contact.phoneVerified === true`, same badge pattern with `phoneVerifiedAt`

---

## Error Handling & Edge Cases

| Scenario | Behavior |
|---|---|
| ZeroBounce API is down | `validateEmail` returns `'unknown'`, submission proceeds |
| `ZEROBOUNCE_API_KEY` not set | Validation skipped entirely |
| `contact.email` is null | `sendEmailVerification` logs warning and returns |
| Contact already email-verified re-submits form | `sendEmailVerification` skips — no new token, no email sent |
| Verification email link clicked twice | Token already cleared → not_found → redirect to `/verify/email/invalid` |
| No phone number on contact | `sendPhoneOtp` returns `{ sent: false }`, success page shows email-only confirmation |
| Twilio not configured | `sendPhoneOtp` returns `{ sent: false }`, phone verification skipped |
| OTP entered after 1 hour | `verifyPhoneOtp` returns `'expired'`, "Code has expired" shown |
| OTP wrong 5 times | `verifyPhoneOtp` returns `'locked'`, "Too many attempts" shown |
| `NEXT_PUBLIC_APP_URL` not set | Verification link in email will be malformed — document in `.env.example` as required |

---

## Data Flow Summary

```
Landing page form submit
  → ZeroBounce validate email (if key present)
    → 'invalid': return 400 (block submission)
    → 'valid'/'unknown': continue
  → Upsert contact in DB
  → sendEmailVerification (fire-and-forget, logs failures)
  → Return 200 to form

Contact clicks email link
  → GET /api/verify/email/[token]
    → Hash token, find contact
    → Not found → redirect /verify/email/invalid
    → Mark emailVerified=true, clear token hash
    → sendPhoneOtp → { sent, sessionToken }
    → Redirect /verify/email/success?phone=[true|false]&st=[sessionToken]

Success page (phone=true)
  → Shows OTP input
  → Contact enters code
  → POST /api/verify/phone { sessionToken, code }
    → Hash sessionToken, find contact
    → Check attempts < 5
    → Check expiry
    → timingSafeEqual(SHA256(code), phoneOtpCode)
    → Mark phoneVerified=true, clear OTP fields
    → Return { success: true }
  → Show "Phone number verified!"
```

---

## Testing Checklist

- [ ] ZeroBounce blocks `'invalid'` email on form submit
- [ ] ZeroBounce absent: form submits normally
- [ ] ZeroBounce API error: form submits normally (fail open)
- [ ] Verification email sent after lead capture (uses transactionalEmail, bypasses opt-out)
- [ ] Verification email NOT sent if contact already email-verified
- [ ] One-click link marks `emailVerified=true`
- [ ] Clicking link twice redirects to invalid page
- [ ] SMS OTP sent automatically after email verified (Twilio configured, phone present)
- [ ] SMS OTP not sent if no phone number
- [ ] SMS OTP not sent if Twilio not configured
- [ ] Valid OTP within 1 hour marks `phoneVerified=true`
- [ ] Expired OTP shows "Code has expired"
- [ ] Wrong OTP 5 times returns locked
- [ ] OTP comparison is timing-safe
- [ ] Email badge appears in contact view after `emailVerified=true`
- [ ] Phone badge appears in contact view after `phoneVerified=true`
- [ ] Settings page shows ZeroBounce configured/unconfigured correctly
- [ ] `NEXT_PUBLIC_APP_URL` absent produces logged warning (not a crash)
