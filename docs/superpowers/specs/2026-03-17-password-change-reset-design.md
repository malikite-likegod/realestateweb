# Password Change & Forgot Password — Design Spec

**Date:** 2026-03-17
**Status:** Approved
**Scope:** Change password in admin settings + forgot password email reset flow

---

## Overview

Two related features sharing the same auth infrastructure:

1. **Change Password** — authenticated user updates their password from Admin Settings by providing their current password.
2. **Forgot Password** — unauthenticated user requests a reset link via email; a time-limited link takes them to a reset page.

---

## Data Model

Add three fields to the existing `User` model in `prisma/schema.prisma`:

```prisma
resetTokenHash    String?   // bcrypt hash of the raw reset token; cleared after use
resetTokenExpiry  DateTime? // 1 hour from request; cleared after use
passwordChangedAt DateTime? // set whenever password is changed or reset; used to invalidate old JWTs
```

The raw reset token is **never stored** — only its bcrypt hash. The raw token travels in the email link only. On submission, the server hashes the input and compares against the stored hash. All reset fields are cleared on successful reset or expiry.

`passwordChangedAt` is updated on both change-password and reset-password success. The JWT verification layer checks that the token's `iat` (issued-at) is after `passwordChangedAt` — if not, the session is treated as invalid. This invalidates any stolen or pre-existing sessions after a password change without requiring a token blocklist.

No additional schema changes are needed for the change password flow.

---

## Session Invalidation After Password Change

Both the change-password and reset-password flows set `passwordChangedAt = now()` on success.

`lib/auth.ts` — `getSession()` is updated to compare `payload.iat` (seconds) against `passwordChangedAt`:

```
if (user.passwordChangedAt && payload.iat < user.passwordChangedAt.getTime() / 1000) {
  return null // token predates password change — treat as invalid
}
```

`middleware.ts` does **not** need to change — it already rejects invalid JWTs by redirecting to login. The iat check happens inside `getSession()` / `verifyJwt()` callers.

**Result:** After a password change or reset, any existing `auth_token` JWT that was issued before the change becomes invalid on the next protected request.

---

## Rate Limiting

The public forgot-password endpoint is susceptible to SMTP cost abuse (bulk reset requests) and the validate endpoint is susceptible to brute force. Rate limiting should be enforced at the infrastructure layer — e.g., Vercel's edge rate limiting, a reverse proxy, or a future middleware addition. Within the API routes, bcrypt cost factor (10 for tokens, 12 for passwords) provides time-based protection as defense-in-depth. This is an accepted operational trade-off for a single-admin deployment; IP-based rate limiting is out of scope for this iteration.

---

## Feature 1: Change Password (Settings)

### UI

A new **Change Password** card is added to `/admin/settings`, below the Profile card. It is a client component (`'use client'`) with three fields:

- **Current password** — required
- **New password** — required, minimum 8 characters
- **Confirm new password** — required, must match new password (client-side check before submit)

A "Save Password" button submits the form. On success, fields are cleared and a success message is shown inline. On error, the error is shown inline.

### API Route — `POST /api/auth/change-password`

**Auth required:** full `auth_token` session

1. Validate all three fields are present; `newPassword.length >= 8`; `newPassword === confirmPassword` — return 400 with specific error if any check fails
2. Load user from session
3. Bcrypt-compare `currentPassword` against stored `passwordHash`
4. If wrong → 401 `{ error: 'Current password is incorrect' }`
5. Bcrypt-hash `newPassword` at cost factor 12
6. Update `passwordHash` and set `passwordChangedAt = now()` in a single DB write
7. Return `{ ok: true }`

The user's own `auth_token` will remain valid for this request but will be invalidated on the next protected route (the `iat` check in `getSession()` will fail). The client should redirect to `/admin/login` after a successful change so the user re-authenticates cleanly.

---

## Feature 2: Forgot Password Flow

### Entry Point

A "Forgot your password?" link is added below the Sign In button on `/admin/login`. It navigates to `/admin/login/forgot-password`.

---

### Forgot Password Page — `/admin/login/forgot-password`

Standalone page outside `DashboardLayout`, matching the visual style of `/admin/login` (dark charcoal background, centred card).

- Single email input + "Send Reset Link" button
- On submit → `POST /api/auth/forgot-password { email }`
- Page always shows the same message after submit regardless of result: **"If that email is registered, you'll receive a reset link shortly."** (prevents user enumeration)
- "Back to login" link

---

### API Route — `POST /api/auth/forgot-password`

**Auth required:** none (public)

1. Validate `email` is a valid email format — return 400 if not
2. Look up User by email
3. If **no match**: return `{ ok: true }` immediately (silent, no email sent — consistent response regardless of email existence)
4. If **match**:
   - Generate a 32-byte cryptographically random token: `crypto.randomBytes(32).toString('hex')`
   - Bcrypt-hash the token at cost factor 10 (acceptable given 256-bit token entropy — bcrypt here is defense-in-depth; the token's randomness is the primary protection)
   - Write `resetTokenHash` and `resetTokenExpiry` (now + 1 hour), overwriting any existing reset request
   - Send reset email to `user.email` (see Reset Email section)
   - If SMTP fails: log error server-side, return `{ ok: true }` — **do not return 500**, as that would confirm the email exists to the caller
5. Return `{ ok: true }`

---

### Reset Email

Plain HTML email sent via the existing `lib/communications/email-service.ts` SMTP mailer, containing:

- Brief intro: "You requested a password reset for your admin account."
- A prominent link/button to: `/admin/login/reset-password?token=<rawToken>&email=<encodeURIComponent(email)>`
- Expiry notice: "This link expires in 1 hour."
- Note: "If you didn't request this, you can safely ignore this email."

---

### Reset Password Page — `/admin/login/reset-password`

Standalone page outside `DashboardLayout`, matching the style of `/admin/login`.

**On page load:**
- Reads `token` and `email` from URL query params
- If either is missing → show error: "This link is invalid." with link back to forgot-password
- Calls `POST /api/auth/reset-password/validate { token, email }` to check validity
- If `{ valid: false }` → show: "This link is invalid or has expired." with link back to forgot-password
- If `{ valid: true }` → show the reset form

**Reset form:**
- **New password** — required, minimum 8 characters
- **Confirm new password** — required, client-side match check before submit
- "Reset Password" button → `POST /api/auth/reset-password { email, token, newPassword, confirmPassword }`
- On success → redirect to `/admin/login?reset=1`
- On error → show inline error

**Login page:** When `?reset=1` is present in the URL, show a one-time green banner: "Your password has been reset. Please sign in." The query param is removed from the URL via `router.replace('/admin/login')` immediately after the banner is displayed, preventing replay on refresh or bookmark.

---

### API Route — `POST /api/auth/reset-password/validate`

**Auth required:** none (public, read-only)

Validates a reset token without consuming it.

1. Validate `token` and `email` are present and non-empty — return 400 if not
2. Look up User by `email`
3. If no user found: perform a dummy bcrypt-compare (`bcrypt.compare(token, '$2b$10$dummyhashfortimingequalisation')`) to equalise response timing, then return `{ valid: false }` — **prevents timing oracle that would reveal whether the email is registered**
4. If `resetTokenExpiry` is null or in the past: clear both reset fields, return `{ valid: false }`
5. Bcrypt-compare `token` against `resetTokenHash`
6. If no match: return `{ valid: false }` — **do not clear fields** (this endpoint is read-only; clearing happens only in the actual reset route)
7. If match: return `{ valid: true }`

> **Email+token tamper note:** If the `email` in the URL is tampered with while a valid token for a different account is supplied, step 2 returns no user (or the wrong user), bcrypt-compare will fail, and the endpoint returns `{ valid: false }`. No special handling is needed — the lookup-by-email-then-compare pattern handles this correctly.

---

### API Route — `POST /api/auth/reset-password`

**Auth required:** none (public)

1. Validate `token`, `email`, `newPassword`, `confirmPassword` are all present
2. Validate `newPassword.length >= 8` — return 400 `{ error: 'Password must be at least 8 characters' }` if not
3. Validate `newPassword === confirmPassword` — return 400 `{ error: 'Passwords do not match' }` if not
4. Look up User by `email`
5. If no user: return 400 `{ error: 'Invalid or expired reset link' }`
6. If `resetTokenExpiry` is null or in the past: clear both reset fields, return 400 `{ error: 'Invalid or expired reset link' }`
7. Bcrypt-compare `token` against `resetTokenHash`
8. If no match: return 400 `{ error: 'Invalid or expired reset link' }` — **token is not cleared on mismatch** — this is a deliberate decision; clearing on mismatch would allow an attacker to lock out a legitimate reset attempt by submitting a wrong token first. Without IP-level rate limiting, this is the safer choice.
9. Bcrypt-hash `newPassword` at cost factor 12
10. In a single DB transaction: update `passwordHash`, set `passwordChangedAt = now()`, clear `resetTokenHash` and `resetTokenExpiry`
11. Return `{ ok: true }` — client redirects to `/admin/login?reset=1`

**Session invalidation:** Setting `passwordChangedAt` in step 10 automatically invalidates any existing `auth_token` JWTs (via the `iat` check in `getSession()`).

---

## Error Handling Summary

| Scenario | Route | Response |
|----------|-------|----------|
| Missing/invalid fields | any | 400 with specific field error |
| Email not found (forgot) | forgot-password | `{ ok: true }` — silent |
| SMTP failure | forgot-password | `{ ok: true }` — logged server-side, not surfaced |
| Token expired (validate) | reset-password/validate | `{ valid: false }`, fields cleared |
| Token expired (reset) | reset-password | 400: "Invalid or expired reset link", fields cleared |
| Token mismatch (validate) | reset-password/validate | `{ valid: false }`, fields NOT cleared |
| Token mismatch (reset) | reset-password | 400: "Invalid or expired reset link", fields NOT cleared |
| Email not found (validate) | reset-password/validate | `{ valid: false }` after dummy bcrypt |
| New password < 8 chars | change-password / reset-password | 400: "Password must be at least 8 characters" |
| Passwords don't match | change-password / reset-password | 400: "Passwords do not match" |
| Current password wrong | change-password | 401: "Current password is incorrect" |

---

## New Files

| File | Purpose |
|------|---------|
| `app/admin/login/forgot-password/page.tsx` | Forgot password page |
| `app/admin/login/reset-password/page.tsx` | Reset password page |
| `app/api/auth/forgot-password/route.ts` | Send reset email |
| `app/api/auth/reset-password/validate/route.ts` | Validate token (read-only) |
| `app/api/auth/reset-password/route.ts` | Apply password reset |
| `app/api/auth/change-password/route.ts` | Change password (authenticated) |

Modified files:
- `app/admin/settings/page.tsx` — add Change Password card (new client component)
- `lib/auth.ts` — add `passwordChangedAt` iat check to `getSession()`
- `prisma/schema.prisma` — add three new User fields

---

## Libraries

- **`bcryptjs`** — already used; reused for token hashing and password hashing
- **`nodemailer`** — already used via `lib/communications/email-service.ts`
- **`crypto`** (Node built-in) — `randomBytes` for token generation

No new npm packages required.

---

## Out of Scope

- IP-based rate limiting (infrastructure concern, not application-level)
- Password strength meter UI
- Forced password expiry / rotation policy
- Admin-initiated password reset for other users
