# Two-Factor Authentication (Email OTP) — Design Spec

**Date:** 2026-03-17
**Status:** Approved
**Scope:** Per-user toggle; Email OTP via existing SMTP mailer; Two-phase JWT approach

---

## Overview

Add optional per-user two-factor authentication (2FA) to the admin section. When enabled, a user must enter a one-time passcode (OTP) sent to their registered email address after entering their password. A toggle in Admin Settings allows each user to enable or disable 2FA for their own account.

---

## Data Model

Add two fields to the existing `User` model in `prisma/schema.prisma`. No new tables are required.

```prisma
totpEnabled  Boolean @default(false)
totpEmail    String? // defaults to user.email; reserved for future override
```

The OTP code itself is **never stored in the database**. It is bcrypt-hashed and embedded as a claim (`otpHash`) inside a short-lived pending JWT. Verification compares the submitted code against that claim.

---

## Login Flow

### Password-only path (2FA disabled — unchanged)
1. `POST /api/auth/login` — validate credentials
2. Issue full `auth_token` JWT cookie (7-day expiry)
3. Redirect to `/admin/dashboard`

### Two-phase path (2FA enabled)
1. `POST /api/auth/login` — validate credentials, detect `totpEnabled: true`
2. Generate a cryptographically random 6-digit OTP
3. Bcrypt-hash the OTP and embed it as `otpHash` claim in a **pending JWT** (10-min expiry, also carries `mfaPending: true` and `sub: userId`)
4. Set `pending_token` cookie (httpOnly, secure, 10-min maxAge)
5. Send OTP to user's email via SMTP mailer
6. Return `{ requires2fa: true }` — client redirects to `/admin/login/verify`

### Verify step
- `POST /api/auth/2fa/verify`
  - Read and verify `pending_token` cookie (signature + `mfaPending: true` + expiry)
  - Bcrypt-compare submitted code against `otpHash` claim
  - Track attempt count in the pending JWT; reject after 5 failed attempts
  - On success: clear `pending_token`, issue full `auth_token` cookie, redirect to `/admin/dashboard`
  - On failure: return 401, user stays on verify page

---

## Middleware

`middleware.ts` is updated with one new rule:

- `auth_token` present and valid → allow (unchanged)
- Path is `/admin/login` or `/admin/login/verify` → allow (unauthenticated)
- All other protected paths without valid `auth_token` → redirect to `/admin/login` (or 401 for API routes)

The middleware **never reads `pending_token`** — that cookie is only consumed by `/api/auth/2fa/verify`. This keeps the security boundary clean: a pending token grants access to exactly one route.

---

## New API Routes

| Method | Path | Auth required | Purpose |
|--------|------|---------------|---------|
| `POST` | `/api/auth/2fa/verify` | `pending_token` cookie | Verify OTP during login, issue full session |
| `POST` | `/api/auth/2fa/enable` | `auth_token` (full session) | Send OTP to email; initiates enable flow |
| `POST` | `/api/auth/2fa/confirm` | `auth_token` (full session) | Verify OTP and set `totpEnabled` true or false |

---

## Settings UI

A new **Two-Factor Authentication** card is added to `/admin/settings` (below the Profile card). It is a client component that manages its own local state for the enable/disable flow.

### State: Disabled (default)
- Description text explaining what 2FA does
- "Enable Two-Factor Authentication" button
- On click: calls `/api/auth/2fa/enable` (sends OTP), reveals an inline OTP input
- User enters code → calls `/api/auth/2fa/confirm` → on success, card transitions to Enabled state

### State: Enabled
- Green "Active" badge
- Shows the email address OTPs will be sent to
- "Disable" button
- On click: calls `/api/auth/2fa/enable` (sends a fresh OTP), reveals an inline OTP input
- User enters code → calls `/api/auth/2fa/confirm` (with `enable: false`) → card transitions to Disabled state

Requiring an OTP to *disable* 2FA prevents accidental or malicious deactivation without email access.

---

## Verify Page (`/admin/login/verify`)

A minimal standalone page outside `DashboardLayout`, visually matching `/admin/login`:

- Single OTP input (6-digit, numeric)
- "Verify" button → calls `/api/auth/2fa/verify`
- Error state for wrong code or expired token
- "Back to login" link (clears `pending_token` cookie)

---

## Error Handling

| Scenario | Behaviour |
|----------|-----------|
| OTP expired (>10 min) | Pending JWT verification fails → redirect to `/admin/login` with `?error=expired` |
| Wrong code (≤4 attempts) | 401 response, error message on verify page |
| Wrong code (5th attempt) | Pending token invalidated → redirect to `/admin/login` with `?error=toomany` |
| SMTP delivery failure | Login route returns 500 with `{ error: 'Could not send verification email' }` |
| 2FA enabled but no email | Falls back to `user.email` (always present) |

---

## Libraries

- **`nodemailer`** — already used by the SMTP mailer (no new dependency)
- **`bcryptjs`** — already used for password hashing; reused for OTP hashing

No new npm packages required.

---

## Out of Scope

- Backup codes (not in this iteration)
- TOTP authenticator app support
- Per-IP or per-device "remember this device" exemptions
- Multi-user admin — this spec assumes a single primary admin user but the per-user data model supports expansion
