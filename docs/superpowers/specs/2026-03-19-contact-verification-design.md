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

Six new optional fields added to the `Contact` model in `prisma/schema.prisma`:

```prisma
emailVerified          Boolean   @default(false)
emailVerifiedAt        DateTime?
emailVerificationToken String?   @unique
emailVerificationSentAt DateTime?
phoneVerified          Boolean   @default(false)
phoneVerifiedAt        DateTime?
phoneOtpCode           String?
phoneOtpExpiresAt      DateTime?
```

Migration: `prisma migrate dev --name add_contact_verification`

---

## Environment Variables

Two new optional env vars (in `.env`). Features degrade gracefully when absent.

```
ZEROBOUNCE_API_KEY=   # If absent, email validation is skipped
# TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER already exist
```

---

## New Files

### `lib/services/zerobounce.ts`

Thin client for the ZeroBounce email validation API.

- Exports `validateEmail(email: string): Promise<'valid' | 'invalid' | 'unknown'>`
- If `ZEROBOUNCE_API_KEY` is not set, returns `'unknown'` immediately (no-op)
- Maps ZeroBounce status codes: `valid` → valid, `invalid`/`abuse`/`disposable`/`spamtrap` → invalid, everything else → unknown
- On any network/API error, returns `'unknown'` (fail open — do not block submissions on API errors)

### `lib/communications/verification-service.ts`

Handles both email and phone verification flows.

**`sendEmailVerification(contactId: string): Promise<void>`**
- Generates a cryptographically random token (32 bytes hex)
- Stores token on contact (`emailVerificationToken`, `emailVerificationSentAt`)
- Sends email via existing email service with subject "Please confirm your email"
- Link points to `/verify/email/[token]`

**`sendPhoneOtp(contactId: string): Promise<boolean>`**
- Returns `false` if contact has no phone or Twilio is not configured
- Generates a 6-digit numeric OTP
- Stores SHA-256 hash of OTP in `phoneOtpCode`, sets `phoneOtpExpiresAt` to now + 1 hour
- Sends SMS via existing SMS service with message: "Your verification code is: XXXXXX (expires in 1 hour)"
- Returns `true` on success

**`verifyPhoneOtp(contactId: string, code: string): Promise<'verified' | 'invalid' | 'expired'>`**
- Loads contact, checks OTP hash matches and `phoneOtpExpiresAt` is in the future
- On success: sets `phoneVerified=true`, `phoneVerifiedAt=now`, clears OTP fields
- On failure: returns appropriate status without modifying the contact

---

## Modified Files

### `app/api/landing-pages/[slug]/lead/route.ts`

Add before contact upsert:
1. Call `validateEmail(email)` — if result is `'invalid'`, return `400` with `{ error: 'Please enter a valid email address.' }`
2. After contact upsert, call `sendEmailVerification(contact.id)` (fire and forget — do not block response)

### `app/api/verify/email/[token]/route.ts` *(new)*

`GET` handler:
1. Find contact by `emailVerificationToken`
2. If not found: redirect to `/verify/email/invalid`
3. Set `emailVerified=true`, `emailVerifiedAt=now`, clear `emailVerificationToken`
4. Call `sendPhoneOtp(contact.id)` — captures whether OTP was sent
5. Redirect to `/verify/email/success?phone=[true|false]`

### `app/api/verify/phone/route.ts` *(new)*

`POST` handler — body: `{ contactId: string, code: string }`:
1. Call `verifyPhoneOtp(contactId, code)`
2. Return `{ success: true }` or `{ error: 'Invalid code' }` / `{ error: 'Code expired' }` with appropriate HTTP status

---

## New Public Pages

### `app/(public)/verify/email/[token]/page.tsx`

Server component that triggers the verification by calling the API route internally, then renders a result page. Alternatively, the page can redirect to the GET API route which handles the logic and redirects back to a static result page.

**Flow:** `/verify/email/[token]` → API processes token → redirects to `/verify/email/success?phone=true|false`

### `app/(public)/verify/email/success/page.tsx`

Client component. Reads `phone` query param.

- Always shows: green checkmark, "Email address confirmed!"
- If `phone=true`: also shows a 6-digit OTP input field with a "Verify Phone" button, and a note "We sent a verification code to your phone number"
- On OTP submit: calls `POST /api/verify/phone` with `contactId` (passed as additional query param) and entered code
- On success: shows "Phone number verified!" replacing the OTP form
- On failure: shows inline error message

### `app/(public)/verify/email/invalid/page.tsx`

Static page: "This verification link is invalid or has already been used."

---

## Settings Page Changes

### `app/admin/settings/page.tsx`

Add ZeroBounce to the existing provider status grid (same pattern as SMTP/Twilio check):
- Label: "ZeroBounce"
- Status: green checkmark if `process.env.ZEROBOUNCE_API_KEY` is set, grey "Not configured" otherwise
- Description: "Email validation"

---

## Contact View Changes

### `app/admin/contacts/[id]/page.tsx`

In the left sidebar identity card, add inline badges:

- **Email row:** if `contact.emailVerified`, show a small green badge with checkmark icon and text "Verified". Tooltip: `Verified on [emailVerifiedAt formatted date]`
- **Phone row:** if `contact.phoneVerified`, show same badge pattern. Tooltip: `Verified on [phoneVerifiedAt formatted date]`

---

## Error Handling & Edge Cases

| Scenario | Behavior |
|---|---|
| ZeroBounce API is down | `validateEmail` returns `'unknown'`, form submission proceeds |
| `ZEROBOUNCE_API_KEY` not set | Validation skipped, form submits normally |
| Contact has no phone number | `sendPhoneOtp` returns false, success page shows email-only confirmation |
| Twilio not configured | `sendPhoneOtp` returns false, phone verification skipped |
| Email verification link clicked twice | Second click: token not found, redirects to `/verify/email/invalid` |
| OTP entered after 1 hour | Returns `'expired'` error, "Code expired" shown to user |
| Contact email already verified (re-submits form) | `sendEmailVerification` sends a new token, overwrites old one |

---

## Data Flow Summary

```
Landing page form submit
  → ZeroBounce validate email
    → invalid: return 400 (block)
    → valid/unknown: continue
  → Upsert contact in DB
  → Send verification email (async)
  → Return 200 to form

Contact clicks email link
  → GET /api/verify/email/[token]
  → Mark emailVerified=true
  → Send SMS OTP (if phone + Twilio)
  → Redirect to success page

Success page (phone=true)
  → Contact enters OTP
  → POST /api/verify/phone
  → Mark phoneVerified=true
  → Show "Phone verified!"
```

---

## Testing Checklist

- [ ] ZeroBounce blocks invalid email on form submit
- [ ] ZeroBounce absent: form submits normally
- [ ] ZeroBounce API error: form submits normally (fail open)
- [ ] Verification email is sent after lead capture
- [ ] One-click link marks email verified
- [ ] Clicking link twice shows invalid page
- [ ] SMS OTP sent automatically after email verified (Twilio configured)
- [ ] SMS OTP not sent if no phone number
- [ ] SMS OTP not sent if Twilio not configured
- [ ] Valid OTP within 1 hour marks phone verified
- [ ] Expired OTP shows error
- [ ] Invalid OTP shows error
- [ ] Email badge appears in contact view after verification
- [ ] Phone badge appears in contact view after verification
- [ ] Settings page shows ZeroBounce configured/unconfigured correctly
