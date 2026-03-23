# PROPTX MLS® Compliance — Design Spec

**Date:** 2026-03-23
**Status:** Approved

---

## Overview

Enforce full compliance of the real estate platform with PROPTX MLS® rules covering IDX (public website) and VOW (authenticated portal) data usage. The audit identified five compliance gaps, each addressed as an independent sub-project executed in sequence.

### System Classification

| Component | Type | Files |
|---|---|---|
| `/app/(public)/listings/*` | **IDX** — public, unauthenticated listing display |
| `/app/portal/*` | **VOW** — authenticated contact portal |
| `/app/admin/*` | Internal — not IDX/VOW |
| `/api/search` | IDX API |
| `/api/portal/listings` | VOW API |
| `/api/reso/sync` | Internal sync — not consumer-facing |

---

## Sub-project 1: Display Compliance

### Problem
All listing display pages (IDX + VOW) lack required MLS disclaimer text, have no consistent brokerage attribution component, and no enforced server-side result cap.

### New Components

#### `components/mls/MlsDisclaimer.tsx`
Renders the required legal disclaimer block. Accepts a `variant` prop:

- `variant="idx"` — appends: _"Displayed on an IDX-approved website."_
- `variant="vow"` — appends: _"Displayed in a VOW-compliant authenticated area. Access restricted to genuine consumers."_

Full disclaimer text:
> The trademarks MLS®, Multiple Listing Service® and the associated logos are owned by The Canadian Real Estate Association (CREA) and identify the quality of services provided by real estate professionals who are members of CREA. The trademarks REALTOR®, REALTORS®, and the REALTOR® logo are controlled by CREA and identify real estate professionals who are members of CREA. Data is deemed reliable but not guaranteed accurate by PROPTX.

Rendered as a `<footer>` element with `role="contentinfo"` and `aria-label="MLS Data Disclaimer"`. Styled subdued (small text, muted colour) but present on every listing surface.

#### `components/mls/BrokerageAttribution.tsx`
Renders listing agent name and office name with equal visual weight to other property details. Props: `listAgentFullName?: string`, `listOfficeName?: string`. Falls back gracefully if either is absent. Required on every listing card and detail page.

### Enforcement

**Result cap (server-side):**
- `app/api/search/route.ts` — `Math.min(pageSize, 100)` hard cap
- `app/api/portal/listings/route.ts` — same cap

**Display pages updated:**
- `app/(public)/listings/page.tsx` — add `<MlsDisclaimer variant="idx" />` at page footer; add `<BrokerageAttribution>` to each listing card
- `app/(public)/listings/[id]/page.tsx` — add `<MlsDisclaimer variant="idx" />` and `<BrokerageAttribution>` in listing detail
- `app/portal/page.tsx` — add `<MlsDisclaimer variant="vow" />`
- `app/portal/listings/[id]/page.tsx` — add `<MlsDisclaimer variant="vow" />` and `<BrokerageAttribution>`

### Files

| Action | Path |
|---|---|
| Create | `components/mls/MlsDisclaimer.tsx` |
| Create | `components/mls/BrokerageAttribution.tsx` |
| Modify | `app/(public)/listings/page.tsx` |
| Modify | `app/(public)/listings/[id]/page.tsx` |
| Modify | `app/portal/page.tsx` |
| Modify | `app/portal/listings/[id]/page.tsx` |
| Modify | `app/api/search/route.ts` |
| Modify | `app/api/portal/listings/route.ts` |

---

## Sub-project 2: AI Safety

### Problem
`generate_listing_description` in `services/ai/commands.ts` sends listing data to external AI APIs (Anthropic / OpenAI). If the listing originates from RESO/MLS sync, this violates PROPTX data usage rules. Additionally, the `/api/ai/analyze` endpoint's `popular_listings` type includes RESO property titles, prices, and cities in its response.

### Architecture

```
AI command request
      ↓
services/ai/commands.ts
      ↓
lib/mls-guard.ts ← checks if listingId is in ResoProperty table
      ↓
  RESO listing?         Manual listing?
      ↓                       ↓
services/ai/local-client.ts   services/ai/client.ts
(Ollama, local only)          (Anthropic / OpenAI, unchanged)
```

#### `lib/mls-guard.ts`
```typescript
export class MlsDataError extends Error {}

export async function isMlsListing(listingId: string): Promise<boolean>
// Returns true if listingId maps to a ResoProperty record
// Checks by listingKey match against ResoProperty table
```

#### `services/ai/local-client.ts`
Thin wrapper around Ollama REST API (`POST /api/generate`).

```typescript
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434'

export async function localComplete(prompt: string, model = 'llama3'): Promise<string>
// If Ollama is unreachable, throws OllamaUnavailableError with message:
// "Local AI unavailable. MLS listing descriptions cannot be generated via external AI."
// Never silently falls back to external API.
```

When `localComplete` throws, `commands.ts` catches `OllamaUnavailableError` and returns a structured error result (same shape as a failed AI command): `{ status: 'error', message: 'MLS listing descriptions require a locally-running AI model. See OLLAMA_BASE_URL in .env.' }`. The error is recorded in `AiCommandLog` with `status = 'error'`. The external AI client is never called as a fallback.

#### `services/ai/commands.ts` — `generate_listing_description` refactor
```typescript
// Before calling external AI:
const isReso = await isMlsListing(payload.listingId)
if (isReso) {
  // Route to local Ollama — MLS data stays on-premises
  return localComplete(buildPrompt(listing))
} else {
  // Manual listing — external AI permitted
  return externalClient.complete(buildPrompt(listing))
}
```

#### `app/api/ai/analyze/route.ts` — `popular_listings` restriction
The `popular_listings` analysis type currently returns `title`, `price`, `city` from RESO properties. After this change:
- Only non-RESO (manual) listings are eligible for this endpoint
- RESO-sourced listings are excluded entirely from the response
- The response shape remains the same; RESO rows simply do not appear

> **Note:** This file is also modified in Sub-project 5 (auth tightening). Sub-project 2 applies the data filter; Sub-project 5 adds the admin session requirement. Implement Sub-project 2 first; Sub-project 5 adds on top.

### Environment Variables Added
```
# Local AI (Ollama) — required if using MLS listing descriptions
# Install Ollama: https://ollama.ai and run: ollama pull llama3
OLLAMA_BASE_URL=http://localhost:11434
```

> **Note:** `.env.example` is also modified in Sub-project 4 (cron note). Both changes are additive — append each block without overwriting the other.

### Files

| Action | Path |
|---|---|
| Create | `lib/mls-guard.ts` |
| Create | `services/ai/local-client.ts` |
| Modify | `services/ai/commands.ts` |
| Modify | `app/api/ai/analyze/route.ts` |
| Modify | `.env.example` |

---

## Sub-project 3: Rate Limiting & Anti-Scraping

### Problem
Public search and listing endpoints have no rate limiting. Automated clients can loop through all MLS listings without restriction.

### Architecture

#### `lib/rate-limit.ts`
Sliding window counter using `lru-cache`. No external dependency.

```typescript
export interface RateLimitOptions {
  windowMs:  number   // window duration in milliseconds
  max:       number   // max requests per window
  keyPrefix: string   // namespaces different limiters
}

export function createRateLimit(options: RateLimitOptions): {
  check(identifier: string): { allowed: boolean; retryAfterMs: number }
}
```

LRU map capped at 10,000 entries (bounds memory to ~2 MB). Entries expire after `windowMs`.

**Two tiers defined in `lib/rate-limit.ts`:**
```typescript
export const publicSearchLimit  = createRateLimit({ windowMs: 60_000, max: 30,  keyPrefix: 'pub' })
export const portalLimit        = createRateLimit({ windowMs: 60_000, max: 60,  keyPrefix: 'vow' })
export const loginLimit         = createRateLimit({ windowMs: 900_000, max: 5,  keyPrefix: 'login' })
```

#### `middleware.ts` (Next.js root middleware)
Runs on every request before route handlers. Extracts client IP from `x-forwarded-for` or `x-real-ip`. Applies rate limit based on path prefix:

| Path prefix | Limiter | Identifier |
|---|---|---|
| `/api/search` | `publicSearchLimit` | IP address |
| `/api/listings` (GET) | `publicSearchLimit` | IP address |
| `/api/portal/listings` | `portalLimit` | contact session ID |
| `/api/portal/login` | `loginLimit` | IP address |

Returns `429 Too Many Requests` with `Retry-After` header (seconds) on breach. All other paths pass through unchanged.

#### `public/robots.txt`
```
User-agent: *
Disallow: /api/
Disallow: /portal/
Disallow: /admin/

User-agent: Googlebot
Allow: /
Disallow: /api/
Disallow: /portal/
Disallow: /admin/
```

### Files

| Action | Path |
|---|---|
| Create | `lib/rate-limit.ts` |
| Modify | `middleware.ts` |
| Create | `public/robots.txt` |

---

## Sub-project 4: Data Lifecycle

### Problem
No retention policy for search logs and behavior events. No purge capability for PROPTX agreement termination. No contact data deletion path.

### Architecture

#### `services/data-lifecycle.ts`

```typescript
export async function purgeOldBehaviorEvents(): Promise<{ deleted: number }>
// Deletes BehaviorEvent rows with createdAt < 90 days ago

export async function purgeOldSearchLogs(): Promise<{ deleted: number }>
// Deletes PropertySearchLog rows with occurredAt < 180 days ago

export async function purgeContactData(contactId: string): Promise<{ deleted: Record<string, number> }>
// Deletes for a single contact:
//   - BehaviorEvent rows
//   - PropertySearchLog rows
//   - ContactSavedListing rows
//   - SavedSearch rows
//   - CommunicationOptLog rows
// Does NOT delete: Activity rows (anonymized, retained for audit)
// Returns counts per table

export async function purgeMlsData(): Promise<{ deleted: Record<string, number> }>
// Nuclear option — terminates all MLS data:
//   - ResoProperty (all rows)
//   - ResoMember (all rows)
//   - ResoOffice (all rows)
//   - AmpreSyncCheckpoint (all rows)
//   - ResoSyncLog (all rows)
// Returns counts per table
```

#### `app/api/admin/purge/route.ts`
Authentication rules per operation type:

| Operation | Accepted auth |
|---|---|
| `type=retention` | Admin session **or** `x-cron-secret` header (same secret as RESO sync cron) |
| `type=contact` | Admin session only |
| `type=mls-termination` | Admin session only |

```
POST /api/admin/purge?type=retention
  → runs purgeOldBehaviorEvents() + purgeOldSearchLogs()
  → returns { behaviorEvents: N, searchLogs: N }

POST /api/admin/purge?type=contact&contactId=<id>
  → runs purgeContactData(contactId)
  → returns per-table deleted counts

POST /api/admin/purge?type=mls-termination
  → requires body: { confirm: "TERMINATE_MLS_DATA" }
  → runs purgeMlsData()
  → returns per-table deleted counts
  → logs the termination event to Activity table
```

### Cron Note (added to `.env.example`)
```
# Data retention cron — run daily (same secret as sync cron)
# POST /api/admin/purge?type=retention
# Header: x-cron-secret: <RESO_SYNC_SECRET value>
```

### Files

| Action | Path |
|---|---|
| Create | `services/data-lifecycle.ts` |
| Create | `app/api/admin/purge/route.ts` |
| Modify | `.env.example` |

---

## Sub-project 5: Access Control Hardening

### Problem
Mock RESO routes are accessible in production. The AI analyze endpoint exposes MLS aggregate data to any API key holder. The portal login endpoint has no brute-force protection. AI command logs are missing IP address.

### Architecture

#### `lib/mock-guard.ts`
```typescript
export function mockGuard(): NextResponse | null
// Returns a NextResponse 404 if NODE_ENV === 'production'; returns null otherwise.
// Callers return early when a non-null value is received:
//   const guard = mockGuard(); if (guard) return guard;
// Rationale: belt-and-suspenders runtime guard in addition to any
// build-time exclusions — ensures mock routes are unreachable even
// if a deployment misconfiguration leaves them in the build.
```

Applied to:
- `app/api/mock-reso/Property/route.ts`
- `app/api/mock-reso/Member/route.ts`
- `app/api/mock-reso/Office/route.ts`
- `app/api/mock-reso/Property/[ListingKey]/route.ts`

#### `app/api/ai/analyze/route.ts` — access tightening
Two changes:
1. Require **admin session** (not just API key) — this is internal tooling. Remove the Bearer API key path from this route entirely.
2. `buyer_intent` response is paginated. Query params: `?type=buyer_intent&page=1&limit=20` (default `limit=20`, max `limit=50`). Response shape:
```json
{
  "data": [ /* search log entries */ ],
  "total": 842,
  "page": 1,
  "limit": 20
}
```

> **Note:** This file is also modified in Sub-project 2 (RESO data filter). Sub-project 2 must be implemented first. This sub-project adds the admin session requirement and pagination on top of those changes.

#### `lib/auth.ts` — IP address logging
`validateApiKey()` gains a second parameter: `request: NextRequest`. Signature after change:
```typescript
export async function validateApiKey(
  authHeader: string | null,
  request: NextRequest
): Promise<ApiKey | null>
```
The IP address is extracted from `request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? request.ip` and written to `AiCommandLog.ipAddress`. Field already exists in schema — just needs to be populated. All existing callers of `validateApiKey` must pass the request object.

#### `app/api/portal/login/route.ts` — brute-force protection
`loginLimit` is applied in `middleware.ts` (Sub-project 3) for all requests to `/api/portal/login`. No additional rate-limit call is needed inside the route handler itself — the middleware handles it centrally. Sub-project 5's only change to this file is confirming the existing generic error message is in place (no enumeration risk). No new code is added to the route handler.

### Files

| Action | Path |
|---|---|
| Create | `lib/mock-guard.ts` |
| Modify | `app/api/mock-reso/Property/route.ts` |
| Modify | `app/api/mock-reso/Member/route.ts` |
| Modify | `app/api/mock-reso/Office/route.ts` |
| Modify | `app/api/mock-reso/Property/[ListingKey]/route.ts` |
| Modify | `app/api/ai/analyze/route.ts` |
| Modify | `lib/auth.ts` |

---

## Out of Scope

- CAPTCHA on public forms (not required by PROPTX rules)
- Immutable external audit log forwarding (Datadog/CloudTrail)
- Phone OTP brute-force protection (separate from MLS compliance)
- Database encryption at rest (infrastructure concern, not code)
- GDPR-specific data subject access requests
- VOW user registration flow changes

---

## Compliance Checklist (Post-Implementation)

| Requirement | Sub-project | Status |
|---|---|---|
| MLS disclaimer on all IDX displays | 1 | ✅ |
| MLS disclaimer on all VOW displays | 1 | ✅ |
| Listing brokerage shown clearly | 1 | ✅ |
| Max 100 results per query | 1 | ✅ |
| AI never receives MLS data externally | 2 | ✅ |
| MLS data excluded from analyze endpoint | 2 | ✅ |
| Rate limiting on public endpoints | 3 | ✅ |
| robots.txt blocks API crawlers | 3 | ✅ |
| Portal login brute-force protection | 5 | ✅ |
| Retention policy enforced | 4 | ✅ |
| MLS termination purge capability | 4 | ✅ |
| Contact data deletion path | 4 | ✅ |
| Mock routes blocked in production | 5 | ✅ |
| Analyze endpoint requires admin session | 5 | ✅ |
| AI command logs include IP address | 5 | ✅ |
