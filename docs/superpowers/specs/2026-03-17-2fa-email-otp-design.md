# Two-Factor Authentication (Email OTP) — Design Spec

**Date:** 2026-03-17
**Status:** Approved
**Scope:** Per-user toggle; Email OTP via existing SMTP mailer; Two-phase JWT approach

---

## Overview

Add optional per-user two-factor authentication (2FA) to the admin section. When enabled, a user must enter a one-time passcode (OTP) sent to their registered email address after entering their password. A toggle in Admin Settings allows each user to enable or disable 2FA for their own account.

---

## Data Model

Add fields to the existing `User` model in `prisma/schema.prisma`. No new tables are required.

```prisma
totpEnabled        Boolean   @default(false)
pendingOtpHash     String?   // bcrypt hash of current OTP; cleared after use or expiry
pendingOtpExpiry   DateTime? // when the pending OTP expires
pendingOtpAttempts Int       @default(0) // failed attempt counter; reset on new OTP
```

The OTP hash is stored **server-side only** in the database. The pending JWT issued to the client carries only `mfaPending: true` and `sub: userId` — no hash or code ever leaves the server.

OTPs are always sent to `user.email`.

---

## Login Flow

### Password-only path (2FA disabled — unchanged)
1. `POST /api/auth/login` — validate credentials
2. Issue full `auth_token` JWT cookie (7-day expiry)
3. Return `{ ok: true }` — client redirects to `/admin/dashboard`

### Two-phase path (2FA enabled)
1. `POST /api/auth/login` — validate credentials, detect `totpEnabled: true`
2. Generate a cryptographically random 6-digit **numeric** OTP
3. Bcrypt-hash the OTP; write `pendingOtpHash`, `pendingOtpExpiry` (now + 10 min), and `pendingOtpAttempts = 0` to the User record
4. Send OTP to `user.email` via SMTP mailer. If SMTP fails, return 500 `{ error: 'Could not send verification email' }` — do **not** issue a pending token
5. Issue a minimal **pending JWT** (10-min expiry, claims: `mfaPending: true`, `sub: userId`) and set it as `pending_token` cookie (httpOnly, secure, `sameSite: 'lax'`, 10-min maxAge)
6. Return `{ requires2fa: true }` — client redirects to `/admin/login/verify`

---

## Verify Step — `POST /api/auth/2fa/verify`

Processes OTP submission during login. Submitted `code` must be validated server-side as exactly 6 numeric digits (`/^\d{6}$/`) before any DB lookup; return 400 if not.

1. Read `pending_token` cookie; verify JWT signature and `mfaPending: true` claim
2. If JWT invalid (bad signature, malformed, or missing claim): return 401 `{ error: 'Session expired, please log in again' }`
3. If JWT expired: return 401 `{ error: 'Session expired, please log in again' }`
4. Look up User by `sub`; check `pendingOtpExpiry` — if past: clear all pending OTP fields, return 401 `{ error: 'Code expired, please log in again' }`
5. If `pendingOtpAttempts >= 5`: clear all pending OTP fields, clear `pending_token` cookie, return 401 `{ error: 'Too many attempts, please log in again' }`
6. Bcrypt-compare submitted code against `pendingOtpHash`
7. **On failure**:
   - Increment `pendingOtpAttempts`
   - If `pendingOtpAttempts >= 5`: clear all pending OTP fields, clear `pending_token` cookie, return 401 `{ error: 'Too many attempts, please log in again' }`
   - Otherwise: return 401 `{ error: 'Invalid code' }`
8. **On success**: clear `pendingOtpHash`, `pendingOtpExpiry`, `pendingOtpAttempts`; clear `pending_token` cookie; issue full `auth_token` cookie; return `{ ok: true }` — client redirects to `/admin/dashboard`

> **Note on attempt counting:** Steps 5 and 7 together ensure that the 5th bad guess is locked out in the same response (not the 6th). Step 5 blocks any request when the counter has already reached 5 from a prior attempt. Step 7 increments and re-checks so the 5th failure in a session is caught immediately.

---

## Middleware

`middleware.ts` is updated with the following rules (evaluated in order):

1. Path is `/admin/login` or `/admin/login/verify` **and** no valid `auth_token` → allow through
2. Path is `/admin/login` or `/admin/login/verify` **and** valid `auth_token` present → redirect to `/admin/dashboard`
3. Valid `auth_token` present → allow through (unchanged)
4. No valid `auth_token`, protected path → redirect to `/admin/login` (or 401 for API routes)

The middleware **never reads `pending_token`**. That cookie is consumed only by `/api/auth/2fa/verify`.

---

## New API Routes

| Method | Path | Auth required | Purpose |
|--------|------|---------------|---------|
| `POST` | `/api/auth/2fa/verify` | `pending_token` cookie | Verify OTP during login; issue full session |
| `GET`  | `/api/auth/2fa/clear`  | none | Clear `pending_token` cookie; redirect to `/admin/login` |
| `POST` | `/api/auth/2fa/enable` | `auth_token` (full session) | Send OTP; initiate enable or disable flow |
| `POST` | `/api/auth/2fa/confirm`| `auth_token` (full session) | Verify OTP; set `totpEnabled` true or false |

### `GET /api/auth/2fa/clear`
- Sets `pending_token` cookie to expired (maxAge: 0)
- Redirects to `/admin/login`
- No auth required

### `POST /api/auth/2fa/enable`
- Accepts body `{ action: 'enable' | 'disable' }`
- Requires full session (`auth_token`)
- Validates `action` against current `totpEnabled`: returns 400 if already in the target state
- If a pending OTP already exists (unexpired `pendingOtpExpiry`), it is **overwritten** — this is acceptable because the settings flow requires a full session (`auth_token`), which means the user is already authenticated
- Generates OTP, writes `pendingOtpHash`, `pendingOtpExpiry` (now + 10 min), `pendingOtpAttempts = 0` to User
- Sends OTP to `user.email`. If SMTP fails, returns 500 without updating DB
- Returns `{ sent: true }`
- **No `pending_token` cookie is set** — the settings flow uses DB fields only, relying on the existing `auth_token` session

### `POST /api/auth/2fa/confirm`
- Accepts body `{ code: string, action: 'enable' | 'disable' }`
- Requires full session (`auth_token`)
- Server-side: validates `code` is exactly 6 numeric digits; returns 400 if not
- Re-validates `action` against current `totpEnabled`; returns 400 if state has changed since `enable` was called
- Applies same attempt-tracking logic as `/api/auth/2fa/verify` (steps 4–7 above, minus pending JWT handling)
- On success: sets `totpEnabled` to `true` (enable) or `false` (disable); clears all pending OTP fields
- Returns `{ ok: true, totpEnabled: boolean }`

---

## Settings UI

A new **Two-Factor Authentication** card is added to `/admin/settings`, below the Profile card. It is a client component (`'use client'`) that manages its own local state for the inline enable/disable flow.

### State: Disabled (default)
- Descriptive text explaining what 2FA does and that codes are sent to the account email
- "Enable Two-Factor Authentication" button
- On click: `POST /api/auth/2fa/enable { action: 'enable' }` → OTP sent → card shows inline 6-digit numeric input
- "Verify" button → `POST /api/auth/2fa/confirm { code, action: 'enable' }`
- On success: card transitions to **Enabled** state
- On failure: shows error; user may retry (attempt limit enforced server-side)

### State: Enabled
- Green "Active" badge
- "Verification codes are sent to **{user.email}**"
- "Disable" button
- On click: `POST /api/auth/2fa/enable { action: 'disable' }` → OTP sent → inline input
- "Verify" button → `POST /api/auth/2fa/confirm { code, action: 'disable' }`
- On success: card transitions to **Disabled** state

Requiring an OTP to disable 2FA prevents accidental or malicious deactivation without email access.

---

## Verify Page (`/admin/login/verify`)

Minimal standalone page outside `DashboardLayout`, visually matching `/admin/login`:

- 6-digit numeric OTP input (`type="text"`, `inputMode="numeric"`, `pattern="[0-9]{6}"`, `maxLength={6}`)
- "Verify" button → `POST /api/auth/2fa/verify { code }`
- Error messages for: invalid code, expired code, too many attempts (latter two show message then redirect to `/admin/login` after 3 seconds)
- "Back to login" link → navigates to `GET /api/auth/2fa/clear` which clears `pending_token` and redirects to `/admin/login` (server-side redirect ensures the httpOnly cookie is properly cleared)

---

## Error Handling

| Scenario | Where | Behaviour |
|----------|-------|-----------|
| SMTP failure | login / enable route | 500: "Could not send verification email" |
| JWT invalid or malformed | verify route | 401: "Session expired, please log in again" |
| JWT expired | verify route | 401: "Session expired, please log in again" |
| OTP DB record expired | verify / confirm | Clear pending fields; 401: "Code expired" |
| Wrong code, attempts < 5 | verify / confirm | Increment `pendingOtpAttempts`; 401: "Invalid code" |
| Wrong code, 5th attempt | verify / confirm | Clear pending fields + cookie; 401: "Too many attempts" |
| Action matches current state | enable / confirm | 400: "2FA is already enabled/disabled" |
| OTP code not 6 numeric digits | verify / confirm | 400: "Invalid code format" |

---

## CSRF Considerations

All cookies (`auth_token`, `pending_token`) use `sameSite: 'lax'` and `httpOnly: true`. All mutating routes require either a valid `pending_token` or a valid `auth_token` — cross-site requests cannot supply these cookies under `sameSite: 'lax'`.

---

## Libraries

- **`nodemailer`** — already used by the SMTP mailer
- **`bcryptjs`** — already used for password hashing; reused for OTP hashing

No new npm packages required.

---

## Out of Scope

- Backup/recovery codes
- TOTP authenticator app support
- Per-device "remember this device" exemptions
- IP-level rate limiting (beyond per-user attempt counter)
