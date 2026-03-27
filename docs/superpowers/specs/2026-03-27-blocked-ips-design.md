# Blocked IP CSV Upload — Design Spec
**Date:** 2026-03-27
**Status:** Approved

## Overview

Allow admins to upload a CSV of known malicious IP addresses via the Security section of the admin panel. Uploaded IPs are blocked site-wide for 4 months via Next.js middleware using an in-process cache backed by an internal API route.

---

## Database

New Prisma model `BlockedIp`:

| Field      | Type     | Notes                                                      |
|------------|----------|------------------------------------------------------------|
| id         | String   | cuid, primary key                                          |
| ip         | String   | `@unique`; stored normalized (leading zeros stripped per octet) |
| blockedAt  | DateTime | set on first insert; **never updated on re-upload**        |
| expiresAt  | DateTime | always set to `now + 4 months` on upsert                   |

Table name: `blocked_ips`

Additional index:
- `@@index([expiresAt])` — required for efficient active-IP query

**Upsert Prisma field split (explicit):**
```
create: { ip, blockedAt: now, expiresAt: now + 4 months }
update: { expiresAt: now + 4 months }   ← blockedAt intentionally excluded
```

**IP normalization:** Before storage and before middleware lookup, strip leading zeros per octet (e.g., `192.168.001.001` → `192.168.1.1`).

---

## Internal Blocked-IPs Endpoint

Because Next.js `middleware.ts` runs in the **Edge Runtime** (Prisma is unavailable there), the middleware fetches blocked IPs from an internal server-side route instead.

### `GET /api/internal/blocked-ips`
- Protected by a shared secret: caller must send header `x-internal-secret: <INTERNAL_SECRET env var>`
- Returns `{ "ips": ["1.2.3.4", ...] }` — all IPs where `expiresAt > now`
- **Excluded from the middleware matcher** via a negative lookahead in `config.matcher` so it never goes through the block check itself (avoids circular middleware call)
- No admin session auth required (protected only by shared secret header)

---

## Admin API Routes

### `GET /api/admin/blocked-ips`
- Admin auth required
- Query params: `page` (default 1), `limit` (default 50, max 100), `includeExpired` (default `false`)
- When `includeExpired=false` (default), only returns rows where `expiresAt > now`
- Returns:
  ```json
  { "data": [{ "id": "...", "ip": "...", "blockedAt": "...", "expiresAt": "..." }], "total": 42 }
  ```
- Sorted by `blockedAt` descending

### `POST /api/admin/blocked-ips/upload`
- Admin auth required
- Body: `{ "csv": "<raw csv text>" }` — enforced max body size 5 MB (return `413` if exceeded)
- Max 10,000 IPs per upload — return `422 { error: "Too many IPs. Maximum is 10,000 per upload." }` if exceeded
- Parses, normalizes, and validates each row; upserts valid IPs with `expiresAt = now + 4 months`
- Upload is **partial** — valid rows are upserted even if some rows are invalid
- Returns:
  ```json
  { "added": 120, "updated": 5, "skipped": 0, "invalid": ["bad-value", "999.1.1.1"] }
  ```
  (`invalid` array is capped at first 50 entries)
- Writes a `securityAuditLog` entry: event `ip_blocklist_upload`, meta `{ added, updated, skipped, invalidCount }`

### `DELETE /api/admin/blocked-ips/[id]`
- Admin auth required
- Removes a single `BlockedIp` record by its cuid `id`
- Returns `{ "success": true }`
- Writes a `securityAuditLog` entry: event `ip_blocklist_remove`, meta `{ ip }`

---

## Audit Events

Two new events must be added to `AUDIT_EVENTS` in `lib/audit.ts` and to the `AuditEvent` union type:
- `ip_blocklist_upload`
- `ip_blocklist_remove`

The `SecurityAuditLog.event` column comment in `schema.prisma` should also be updated to list the new events.

---

## Middleware

### Runtime
`middleware.ts` remains in the **Edge Runtime** (default). No runtime change is needed.

### Cache
Module-level cache added to `middleware.ts`:

```ts
let blockedIpCache: { ips: Set<string>; refreshedAt: number } = {
  ips: new Set(),
  refreshedAt: 0,
}
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes
```

**Known limitations:**
- Cache is per-process. In multi-instance deployments, each instance refreshes independently — new blocks may take up to 5 minutes to propagate per instance.
- Expiry propagation has the same delay: an IP may continue to be blocked for up to 5 minutes after its `expiresAt` passes.

### Logic (prepended before rate limiting and auth)

```
1. Skip block check entirely if pathname starts with '/api/internal/'
   (avoids circular middleware call for the cache refresh endpoint)

2. If cache is stale (Date.now() - refreshedAt > TTL):
   a. fetch('/api/internal/blocked-ips', { headers: { 'x-internal-secret': env.INTERNAL_SECRET } })
   b. Rebuild Set with normalized IPs
   c. Update refreshedAt

3. Extract client IP (x-forwarded-for first octet → x-real-ip → 'unknown'), normalize

4. Skip block check for:
   - pathname starting with '/admin/login' (admin must be able to log in)
   - pathname === '/api/auth/login' or '/api/auth/2fa/verify'
   - pathname === '/api/portal/login' (portal users are not blocked; only public/API traffic is)

5. If IP is in Set:
   return NextResponse.json({ "error": "Your IP has been blocked." }, { status: 403 })
   Content-Type: application/json — distinguishable from 401 (auth) and 429 (rate limit)

6. Otherwise continue to existing middleware logic (rate limiting, JWT auth)
```

### Middleware Matcher Update
Add a negative lookahead to exclude `/api/internal/`:
```ts
export const config = {
  matcher: ['/admin/:path*', '/api/((?!internal/).*)', '/listings/:path*'],
}
```

---

## Admin UI

### Tab Structure
The existing `/admin/security` page is a single-purpose page with no tabs. As part of this feature, the page is refactored to use a tab layout with two tabs:
1. **Audit Log** — existing content moved here unchanged
2. **Blocked IPs** — new content described below

### Blocked IPs Tab

**Upload Section:**
- Drag-and-drop or click-to-browse file input (`.csv` only, max 5 MB — enforced client-side before parsing)
- Client-side parsing and validation on file select
- Preview table shows first 500 rows: **IP** | **Status** (Valid / Invalid)
- If the file has more than 500 rows, a note reads: "Showing first 500 of X rows — all valid IPs will be uploaded."
- "Block X IPs" confirm button (disabled if 0 valid IPs)
- Calls `POST /api/admin/blocked-ips/upload` on confirm
- Result summary banner: `X added, X updated (expiry reset), X invalid (skipped)`
- **Download template** button generates a single-column CSV with header `ip`

**Current Blocked IPs Table:**
- Loads from `GET /api/admin/blocked-ips` (active IPs only, `includeExpired=false`)
- Columns: **IP Address** | **Blocked** | **Expires** | **Remove**
- Sorted by most recently blocked first
- Paginated (50 per page)
- Remove button (trash icon) calls `DELETE /api/admin/blocked-ips/[id]` using the `id` stored in component state (not displayed in the table)
- Table refreshes after each remove

---

## CSV Format

```
ip
192.168.1.1
10.0.0.5
203.0.113.42
```

- Header row (`ip`) required; header matching is case-insensitive
- One IPv4 address per row
- Validation: regex `/^(\d{1,3}\.){3}\d{1,3}$/` with each octet in range 0–255
- CIDR notation (e.g., `192.168.1.0/24`) is **not** supported; rows with CIDR are counted as invalid
- Invalid rows are collected and returned in the API `invalid` array (capped at first 50)
- Duplicate IPs (already in DB) are upserted: `expiresAt` reset, counted as `updated`

---

## Environment Variable

A new required env var `INTERNAL_SECRET` must be set. Used as the shared secret for `GET /api/internal/blocked-ips`. Should be a random string (e.g., 32-character hex). Must be documented in `.env.example`.

---

## Security Considerations

- `GET /api/internal/blocked-ips` is protected by shared secret header and excluded from the middleware matcher — it is never publicly accessible via normal routing
- Admin and portal login paths are exempt from the block check
- All write operations require admin session auth
- IPv4 normalization prevents duplicate entries from differently-formatted identical IPs
- Upload body capped at 5 MB server-side; max 10,000 rows per upload enforced server-side

---

## Out of Scope

- IPv6 support
- CIDR range blocking
- Per-IP custom block durations (all blocks are fixed at 4 months)
- Auto-expiry cleanup job (expired IPs remain in DB but are excluded from the active cache query)
- Bulk delete / clear all
- Cache invalidation signal between multiple app instances
