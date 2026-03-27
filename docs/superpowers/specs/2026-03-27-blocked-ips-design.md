# Blocked IP CSV Upload — Design Spec
**Date:** 2026-03-27
**Status:** Approved

## Overview

Allow admins to upload a CSV of known hacker/malicious IP addresses via the Security section of the admin panel. Uploaded IPs are blocked site-wide for 4 months via Next.js middleware.

---

## Database

New Prisma model `BlockedIp`:

| Field      | Type     | Notes                          |
|------------|----------|--------------------------------|
| id         | String   | cuid, primary key              |
| ip         | String   | unique                         |
| blockedAt  | DateTime | auto (now)                     |
| expiresAt  | DateTime | blockedAt + 4 months           |

Table name: `blocked_ips`

**Upsert behavior:** If an IP already exists, `expiresAt` is reset to 4 months from the current upload time. `blockedAt` is left unchanged.

---

## API Routes

### `GET /api/blocked-ips`
- No auth required (internal use only)
- Returns `{ ips: string[] }` — all IPs where `expiresAt > now`
- Used exclusively by the middleware cache refresh
- Exempt from the IP block check itself

### `GET /api/admin/blocked-ips`
- Admin auth required
- Returns paginated list: `{ data: BlockedIp[], total: number }`
- Sorted by `blockedAt` descending
- Default limit: 50 per page

### `POST /api/admin/blocked-ips/upload`
- Admin auth required
- Body: `{ csv: string }` (raw CSV text)
- Parses and validates IPv4 addresses
- Upserts each valid IP with `expiresAt = now + 4 months`
- Returns `{ added: number, updated: number, skipped: number, invalid: string[] }`

### `DELETE /api/admin/blocked-ips/[id]`
- Admin auth required
- Removes a single `BlockedIp` record by id
- Returns `{ success: true }`

---

## Middleware

A module-level cache is added to `middleware.ts`:

```ts
let blockedIpCache: { ips: Set<string>; refreshedAt: number } = {
  ips: new Set(),
  refreshedAt: 0,
}
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes
```

**Logic (runs first, before rate limiting and auth):**

1. Skip if `pathname === '/api/blocked-ips'` (avoid circular fetch)
2. If `Date.now() - refreshedAt > TTL`, fetch `/api/blocked-ips` and rebuild the Set
3. Extract client IP: `x-forwarded-for` → `x-real-ip` → `'unknown'`
4. If IP is in the Set → return `NextResponse.json({ error: 'Forbidden' }, { status: 403 })`

**Cache delay:** Up to 5 minutes before a newly uploaded block list takes effect.

---

## Admin UI

Location: New "Blocked IPs" tab on `/admin/security` page (alongside the existing "Audit Log" tab).

### Upload Section

- Drag-and-drop or click-to-browse file input (`.csv` only, max 5 MB)
- Client-side parsing and validation on file select
- Preview table: **IP** | **Status** (Valid / Invalid — shown inline)
- "Block X IPs" confirm button (disabled if 0 valid IPs)
- Calls `POST /api/admin/blocked-ips/upload` on confirm
- Result summary banner: `X added, X updated (expiry reset), X skipped (invalid format)`
- Download template button generates a single-column CSV with header `ip`

### Current Blocked IPs Table

- Columns: **IP Address** | **Blocked** | **Expires** | **Remove**
- Sorted by most recently blocked first
- Remove button (trash icon) calls `DELETE /api/admin/blocked-ips/[id]` and refreshes the list
- Paginated (50 per page)

---

## CSV Format

```
ip
192.168.1.1
10.0.0.5
203.0.113.42
```

- Header row (`ip`) required
- One IP per row
- Only IPv4 addresses accepted (validated via regex)
- Invalid rows are skipped silently and reported in the result summary
- Duplicate IPs (already in DB) are upserted (expiry reset, counted as `updated`)

---

## Security Considerations

- The `GET /api/blocked-ips` endpoint returns only IPs, no sensitive metadata — acceptable to skip auth since data is not sensitive
- The endpoint is excluded from the block check to prevent middleware from blocking its own cache refresh
- All write operations (`upload`, `delete`) require admin session auth
- IPv4 validation prevents injection of malformed data into the DB

---

## Out of Scope

- IPv6 support
- Per-IP custom block durations (all blocks are 4 months)
- Automatic expiry cleanup job (expired IPs are simply excluded from the cache; a future prune job could clean them up)
- Bulk delete / clear all
