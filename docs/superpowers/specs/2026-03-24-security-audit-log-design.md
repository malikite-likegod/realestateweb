# Security Audit Log — Design Spec
**Date:** 2026-03-24
**Status:** Approved

---

## Overview

Add persistent logging of authentication events for security auditing. Admin users can view, filter, and page through the log in a dedicated `/admin/security` page. Logs are auto-pruned after 90 days.

---

## Data Model

New Prisma model `SecurityAuditLog`:

```prisma
model SecurityAuditLog {
  id        String   @id @default(cuid())
  createdAt DateTime @default(now())

  event     String   // see Event Types below
  actor     String?  // email address attempted (may not resolve to a real user)
  userId    String?  // FK to User if resolved; null for unknown-email failures
  contactId String?  // FK to Contact for portal events
  ip        String?
  userAgent String?
  meta      String?  // JSON blob for extra context (e.g. failure reason)

  user      User?    @relation(fields: [userId], references: [id], onDelete: SetNull)
  contact   Contact? @relation(fields: [contactId], references: [id], onDelete: SetNull)

  @@index([createdAt])
  @@index([userId])
  @@index([contactId])
  @@index([ip])
  @@index([actor])
  @@map("security_audit_log")
}
```

### Event Types

| Event | Trigger |
|---|---|
| `login_success` | Admin/user login succeeded |
| `login_failure` | Admin/user login failed (wrong password or unknown email) |
| `logout` | User logged out |
| `2fa_sent` | OTP sent to user's email during login |
| `2fa_success` | 2FA OTP verified successfully |
| `2fa_failure` | 2FA OTP verification failed |
| `password_reset_request` | Forgot-password flow initiated |
| `password_reset_complete` | Password reset via token completed |
| `password_change` | Authenticated user changed their password |
| `portal_login_success` | Contact portal login succeeded (sets `contactId`) |
| `portal_login_failure` | Contact portal login failed |
| `portal_logout` | Contact portal logout |

---

## Shared Helper — `lib/audit.ts`

```ts
interface AuditEventParams {
  event: string
  actor?: string       // always the attempted email address, for all login events
  userId?: string      // String (cuid) — FK to User
  contactId?: string   // String (cuid) — FK to Contact
  ip?: string
  userAgent?: string
  meta?: Record<string, unknown>
}

export async function logAuditEvent(params: AuditEventParams): Promise<void>
```

- Writes a single `SecurityAuditLog` row via Prisma.
- `meta` is serialized with `JSON.stringify` before writing to the `String?` column. The admin API returns `meta` as a parsed object (via `JSON.parse`), not a raw string.
- Fire-and-forget inside routes (errors are caught and swallowed — logging must never break auth).
- IP extracted from the `x-forwarded-for` header: take the **first** value from the comma-separated list (leftmost = original client IP), falling back to `x-real-ip`, then `null`. Example: `"1.2.3.4, 10.0.0.1"` → stored as `"1.2.3.4"`.
- User-agent extracted from `request.headers.get('user-agent')`.

---

## Auth Route Instrumentation

Each route calls `logAuditEvent()` at every success and failure branch:

| Route | Events |
|---|---|
| `POST /api/auth/login` | `login_success` (non-2FA path only), `login_failure`, `2fa_sent` (2FA path: emitted instead of `login_success` after credentials pass and OTP email succeeds) |
| `POST /api/auth/logout` | `logout` — update route signature to `POST(request: Request)` to enable IP/user-agent extraction. Read the `auth_token` cookie via `import { cookies } from 'next/headers'`, use `decodeJwt` from `jose` to decode (not verify) it and extract the `sub` claim as `userId`. Validate that `sub` is a non-empty string before using it as a DB lookup key. The extracted `userId` is used **only** to populate the audit record. Look up `actor` (user email) from the database using `userId`. If the cookie is missing, decoding fails, `sub` is invalid, or the DB lookup fails, emit `logout` with `userId` and `actor` null. |
| `POST /api/auth/2fa/verify` | `2fa_success` (serves as the login-success signal for 2FA users — no separate `login_success` is emitted), `2fa_failure` — update route's user select to include `email` field |
| `POST /api/auth/forgot-password` | `password_reset_request` |
| `POST /api/auth/reset-password` | `password_reset_complete` |
| `POST /api/auth/change-password` | `password_change` |
| `POST /api/portal/login` | `portal_login_success` (with `contactId` and `actor` = attempted email), `portal_login_failure` (`actor` = attempted email, `contactId` if email matched a contact) |
| `POST /api/portal/logout` | `portal_logout` — update route signature to `POST(request: Request)`. Read the `contact_token` cookie via `import { cookies } from 'next/headers'`, use `decodeJwt` from `jose` to decode it and extract the `sub` claim as `contactId`. Validate that `sub` is a non-empty string. Look up `actor` (contact email) from the database using `contactId`. If any step fails, emit `portal_logout` with `contactId` and `actor` null. |

`meta` captures failure reason where useful. Defined `meta.reason` vocabulary:

| Route | Reason values |
|---|---|
| `POST /api/auth/login` | `unknown_email`, `invalid_password`. Zod 400 validation failures (malformed body) do **not** emit an audit record — only credential failures do. |
| `POST /api/auth/2fa/verify` | `invalid_code`, `otp_expired`, `too_many_attempts`. Both the pre-check lockout (already locked before this attempt) and the inline 5th-failure lockout emit `2fa_failure` with `reason: too_many_attempts`. The OTP-expired branch (where `pendingOtpExpiry < new Date()`) emits `2fa_failure` with `reason: otp_expired`. Zod/format-invalid 400 early returns do **not** emit any audit event. Each request to a locked account produces one audit record — this is accepted and intentional. For all `2fa_success` and `2fa_failure` events: `userId` is populated from the `pending_token` JWT; `actor` is populated from `user.email`. The existing user select must be updated to include `email`. |
| `POST /api/portal/login` | `unknown_email`, `invalid_password`, `no_password_set`, `account_inactive`. The route deliberately returns a generic error to the client to prevent account enumeration. The audit log **does** record the specific reason — this is intentional. The existing `!contact \|\| !contact.passwordHash` combined check must be split into separate `if (!contact)` → `unknown_email` and `if (!contact.passwordHash)` → `no_password_set` branches so distinct reasons can be recorded. `contactId` population per reason: `unknown_email` → `null`; `no_password_set`, `invalid_password`, `account_inactive` → `contact.id`. |

`actor` is always set to the attempted email address for all login events (both admin and portal), both on success and failure. For events where only a user ID is available (`2fa_success`, `2fa_failure`, `logout`, `password_change`), look up the user email to populate `actor`. For `password_change`, the route already fetches the full `user` object — use `user.email` directly without an extra DB query.

For `2fa_sent`: log only after the OTP email send succeeds. If SMTP fails, do not log `2fa_sent` and do not log `login_success` either — the successful credential check goes unrecorded in this failure path. This is accepted: the 500 response is visible in server logs, and logging a misleading success record is worse than a gap.

---

## API Route — `GET /api/admin/security-audit`

Admin-only (requires valid session with `role: admin`).

**Query params:**
- `page` (default: 1) — values below 1 clamped to 1; non-numeric values treated as 1. No 400 returned.
- `limit` (default: 50, max: 100) — values above 100 clamped to 100; values below 1 clamped to 1. No 400 returned.
- `event` — comma-separated event type filter; split on `,`, trim whitespace from each token, keep only strings matching the known event vocabulary (listed in Event Types), drop the rest. If none remain after filtering, the `event` filter is omitted (return all events)
- `actor` — partial match on actor email
- `ip` — exact match on IP address
- `from` — ISO 8601 date or datetime string (e.g. `2026-03-24` or `2026-03-24T00:00:00Z`); treated as inclusive lower bound on `createdAt`. Date-only strings are interpreted as start-of-day UTC (`T00:00:00.000Z`). If not parseable by `new Date()`, return 400.
- `to` — ISO 8601 date or datetime string; treated as **inclusive** upper bound on `createdAt`. Date-only strings are interpreted as end-of-day UTC (`T23:59:59.999Z`). If not parseable by `new Date()`, return 400.

**Behaviour:**
1. Prune rows older than 90 days (`DELETE WHERE createdAt < now - 90d`) before querying, subject to the 1-hour throttle. If the `security_audit_last_pruned` row does not exist, treat as "never pruned" and run the prune. If the prune fails, log the error server-side and continue — the query proceeds regardless, and the timestamp is **not** upserted (so the next request will retry the prune).
2. Apply filters, return paginated results with `total`, `page`, `limit`, `data[]`.
3. Response rows include resolved `userName` (from `user.name`) and `contactName` (from `contact.firstName + ' ' + contact.lastName`) alongside the raw IDs. With `onDelete: SetNull`, when a `User` or `Contact` row is deleted, Prisma sets `userId`/`contactId` to `null` on the audit row — both the ID and the name will be `null` in that case.

**Response shape:**
```json
{
  "total": 1234,
  "page": 1,
  "limit": 50,
  "data": [
    {
      "id": "cuid123",
      "createdAt": "2026-03-24T10:00:00Z",
      "event": "login_failure",
      "actor": "attacker@example.com",
      "userId": null,
      "userName": null,
      "contactId": null,
      "contactName": null,
      "ip": "1.2.3.4",
      "userAgent": "Mozilla/5.0 ...",
      "meta": { "reason": "unknown_email" }
    }
  ]
}
```

`meta` is returned as a parsed object (not a raw string). If the stored value is not valid JSON, return `null` for that field.

`limit` values above 100 are silently clamped to 100. Values below 1 are clamped to 1. No 400 error is returned for out-of-range values.

---

## Admin UI — `/admin/security`

**Access:** Admin role only. Link added to existing admin sidebar.

**Layout:**
- Filter bar at top: event type filter (a set of checkbox toggles rendered as a dropdown button, matching the pattern used elsewhere in the admin UI), date range pickers (two `<input type="date">` fields for from/to), actor text input, IP text input
- Paginated table below

**Table columns:**
| Timestamp | Event | Actor | Subject | IP Address | User-Agent | Details |

- **Event** shown as a coloured badge (red for failures, green for successes, grey for neutral).
- **Actor** — the email address that was attempted.
- **Subject** — if `userId` is set, shows the user's name (no link — no per-user admin profile page exists; user management is via `/admin/settings`); if `contactId` is set (portal events), shows the contact's name as a link to `/admin/contacts/[contactId]`; otherwise blank.
- **Details** column: expand button that reveals the `meta` object inline.
- Pagination controls: prev/next with current page indicator.

---

## Retention

- 90-day rolling window.
- Pruning runs as a side-effect of each `GET /api/admin/security-audit` request (before the SELECT), **at most once per hour**. A `SiteSettings` row with `key = 'security_audit_last_pruned'` stores the last prune timestamp as an ISO 8601 UTC string (e.g. `"2026-03-24T10:00:00.000Z"`). If the row is absent, treat as "never pruned" and run the prune. If the stored value is less than 1 hour old (parsed via `new Date(value)`), skip the prune. After a successful prune, upsert the row with `value = new Date().toISOString()`. This prevents lock contention from concurrent or polling admin requests.
- No background job required.

---

## Error Handling

- `logAuditEvent()` wraps its Prisma write in try/catch. Logging failures are silent — they must never interrupt authentication flows.
- The admin API route returns 401 if no session, 403 if non-admin role.

---

## Out of Scope

- Email alerts on suspicious activity (e.g. brute-force detection)
- GeoIP lookups
- Export to CSV
- Webhook notifications
