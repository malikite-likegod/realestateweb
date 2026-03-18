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

Add two fields to the existing `User` model in `prisma/schema.prisma`:

```prisma
resetTokenHash   String?   // bcrypt hash of the raw reset token; cleared after use
resetTokenExpiry DateTime? // 1 hour from request; cleared after use
```

The raw token is **never stored** — only its bcrypt hash. The raw token travels in the reset email link only. On submission, the server hashes the input and compares against the stored hash. Both fields are cleared on successful reset or expiry.

No schema changes are needed for the change password flow — it operates entirely on the existing `passwordHash` field.

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
6. Update `passwordHash` in DB
7. Return `{ ok: true }`

**Session behaviour:** The existing `auth_token` remains valid — the authenticated user made the change themselves, no forced re-login.

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
3. If **no match**: return `{ ok: true }` immediately (silent, no email sent)
4. If **match**:
   - Generate a 32-byte cryptographically random token using `crypto.randomBytes(32).toString('hex')`
   - Bcrypt-hash the token at cost factor 10 (lower than passwords for speed — token entropy compensates)
   - Write `resetTokenHash` and `resetTokenExpiry` (now + 1 hour) to the User record, overwriting any existing reset request
   - Send reset email to `user.email` containing a link to `/admin/login/reset-password?token=<rawToken>&email=<encodedEmail>`
   - Return `{ ok: true }`
5. If SMTP fails → return 500 `{ error: 'Could not send reset email. Please try again.' }`

---

### Reset Email

Plain HTML email containing:
- Brief intro ("You requested a password reset for your admin account.")
- A prominent button/link to the reset URL
- Expiry notice ("This link expires in 1 hour.")
- Note that if they didn't request this, they can ignore the email

---

### Reset Password Page — `/admin/login/reset-password`

Standalone page outside `DashboardLayout`, matching the style of `/admin/login`.

**On page load:**
- Reads `token` and `email` from URL query params
- If either is missing → show error: "This link is invalid." with link back to forgot-password
- Calls `POST /api/auth/reset-password/validate { token, email }` to check validity
- If invalid or expired → show error: "This link is invalid or has expired." with link back to forgot-password
- If valid → show the reset form

**Reset form:**
- **New password** — required, minimum 8 characters
- **Confirm new password** — required, client-side match check
- "Reset Password" button → `POST /api/auth/reset-password { email, token, newPassword, confirmPassword }`
- On success → redirect to `/admin/login?message=password-reset`
- On error → show inline error

**Login page:** When `?message=password-reset` is present in the URL, show a green success banner: "Your password has been reset. Please sign in."

---

### API Route — `POST /api/auth/reset-password/validate`

**Auth required:** none (public)

1. Validate `token` and `email` are present and non-empty — return 400 if not
2. Look up User by `email`
3. If no user → return 400 `{ valid: false }`
4. If `resetTokenExpiry` is null or in the past → clear both reset fields, return `{ valid: false }`
5. Bcrypt-compare `token` against `resetTokenHash`
6. If no match → return `{ valid: false }` (do **not** clear fields — this endpoint is read-only; clearing is done in the actual reset route)
7. If match → return `{ valid: true }`

---

### API Route — `POST /api/auth/reset-password`

**Auth required:** none (public)

1. Validate `token`, `email`, `newPassword`, `confirmPassword` are all present
2. Validate `newPassword.length >= 8` and `newPassword === confirmPassword` — return 400 with specific error if not
3. Look up User by `email`
4. If no user → return 400 `{ error: 'Invalid or expired reset link' }`
5. If `resetTokenExpiry` is null or in the past → clear both reset fields, return 400 `{ error: 'Invalid or expired reset link' }`
6. Bcrypt-compare `token` against `resetTokenHash`
7. If no match → return 400 `{ error: 'Invalid or expired reset link' }` (generic — no enumeration)
8. Bcrypt-hash `newPassword` at cost factor 12
9. Update `passwordHash`, clear `resetTokenHash` and `resetTokenExpiry` in a single DB transaction
10. Return `{ ok: true }` — client redirects to `/admin/login?message=password-reset`

**Session behaviour:** Any existing `auth_token` sessions remain valid (single-user admin — no need to force logout).

---

## Error Handling Summary

| Scenario | Route | Response |
|----------|-------|----------|
| Missing/invalid fields | any | 400 with specific field error |
| Email not found (forgot) | forgot-password | `{ ok: true }` — silent |
| SMTP failure | forgot-password | 500: "Could not send reset email" |
| Token expired (validate) | reset-password/validate | `{ valid: false }` |
| Token expired (reset) | reset-password | 400: "Invalid or expired reset link" |
| Token mismatch | reset-password | 400: "Invalid or expired reset link" |
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

The settings card is added inline to the existing `app/admin/settings/page.tsx` as a new client component.

---

## Libraries

- **`bcryptjs`** — already used; reused for token hashing and password hashing
- **`nodemailer`** — already used via `lib/communications/email-service.ts`
- **`crypto`** (Node built-in) — `randomBytes` for token generation

No new npm packages required.

---

## Out of Scope

- Password strength meter UI
- Forced password expiry / rotation policy
- Invalidating existing sessions on password reset
- Admin-initiated password reset for other users
