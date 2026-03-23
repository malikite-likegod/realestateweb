# Amplify TREB/AMPRE Compliance — Design Spec

**Date:** 2026-03-23
**Status:** Approved

---

## Overview

Make the existing RESO/IDX integration 100% compliant with the official Amplify Syndication (RESO Web API) documentation for TREB/AMPRE. The current implementation has three critical compliance gaps:

1. **Wrong auth model** — uses OAuth2 client_credentials; Amplify uses static Bearer tokens
2. **Wrong replication** — uses `$top`/`$skip` pagination which Amplify explicitly warns against for replication
3. **Single token** — platform has three separate Amplify API tokens (DLA, VOX, IDX) that serve different purposes

---

## Architecture

```
Admin UI / Cron
      ↓
/api/reso/sync?type=idx|dla|vox|all
      ↓
services/reso/sync.ts          ← orchestrates each sync type
      ↓
services/reso/client.ts        ← AmpreClient (static Bearer, no OAuth2)
      ↓
https://query.ampre.ca/odata/  ← real Amplify API
  or  /api/mock-reso/           ← simplified mock (Bearer-only, local dev)
```

### Token → Resource Mapping

| Token | Env Var | Resources | Writes to |
|---|---|---|---|
| IDX | `AMPRE_IDX_TOKEN` | `Property` (public fields) | `ResoProperty` (base record) |
| DLA | `AMPRE_DLA_TOKEN` | `Property` (all fields) | `ResoProperty` (enriches same row) |
| VOX | `AMPRE_VOX_TOKEN` | `Member`, `Office` | `ResoMember`, `ResoOffice` (new tables) |

---

## Authentication

### Real API
Amplify uses static Bearer tokens — no OAuth2 token exchange. Every request includes:
```
Authorization: Bearer <token>
```

The current `getToken()` / `tokenCache` / `POST /token` flow is **removed entirely**.

### Mock API
The mock is simplified to match real auth. The token endpoint (`/api/mock-reso/token`) is deleted. Each mock route validates Bearer token against the three env var values:

```typescript
// lib/mock-ampre-auth.ts  (replaces lib/mock-reso-auth.ts)
export function validateMockToken(request: Request): boolean {
  const auth = request.headers.get('authorization') ?? ''
  if (!auth.startsWith('Bearer ')) return false
  const token = auth.slice(7)
  const valid = [
    process.env.AMPRE_IDX_TOKEN ?? 'mock-idx-token',
    process.env.AMPRE_DLA_TOKEN ?? 'mock-dla-token',
    process.env.AMPRE_VOX_TOKEN ?? 'mock-vox-token',
  ]
  return valid.includes(token)
}
```

---

## Client (`services/reso/client.ts`)

Complete rewrite. No OAuth2. Three static token configs.

```typescript
export type TokenType = 'idx' | 'dla' | 'vox'

export type ODataParams = {
  $filter?:  string
  $select?:  string
  $top?:     number
  $orderby?: string
}

export interface AmpreODataResponse<T> {
  '@odata.context'?: string
  '@odata.count'?:   number
  '@odata.nextLink'?: string
  value: T[]
}

export async function ampreGet<T>(
  tokenType: TokenType,
  resource: string,
  params: ODataParams
): Promise<AmpreODataResponse<T>>
```

**Base URL:** `process.env.AMPRE_API_BASE_URL ?? 'https://query.ampre.ca/odata'`
(Only set in `.env` for local dev; production has no override.)

**Rate limiting:** On `429` response, read `X-Rate-Limit-Retry-After-Seconds` header, `await sleep(seconds * 1000)`, retry once. If still `429`, throw.

**`@odata.nextLink`:** Returned in response — callers may follow it for ad-hoc queries. The replication loop uses timestamp+key instead.

---

## Replication Algorithm

Replaces `$top`/`$skip`. Uses Amplify's recommended timestamp+key cursor replication.

### Batch Query Template
```
GET /odata/Property
  ?$filter=ModificationTimestamp gt <lastTs>
    or (ModificationTimestamp eq <lastTs> and ListingKey gt '<lastKey>')
  &$orderby=ModificationTimestamp,ListingKey
  &$top=500
  &$select=<field list>
```

### Termination
When `records.length < batchSize`, the sync is complete.

### Checkpoint Persistence
After each successful batch, the last record's `ModificationTimestamp` and `ListingKey` are persisted to `AmpreSyncCheckpoint`:

- **First run:** `lastTimestamp = 1970-01-01T00:00:00Z`, `lastKey = '0'`
- **Subsequent runs:** reads checkpoint, resumes exactly where it left off
- **Restart safety:** if sync is interrupted mid-run, the next run resumes from the last persisted checkpoint

### Duplicate Record Handling
Per Amplify docs, records modified during a sync run may appear in multiple batches. The upsert-by-key approach handles this naturally — later batches overwrite earlier ones with fresher data.

---

## Data Model

### New: `AmpreSyncCheckpoint`
```prisma
model AmpreSyncCheckpoint {
  syncType      String    @id   // 'idx_property' | 'dla_property' | 'vox_member' | 'vox_office'
  lastTimestamp DateTime?
  lastKey       String    @default("0")
  updatedAt     DateTime  @updatedAt

  @@map("ampre_sync_checkpoints")
}
```

### New: `ResoMember`
```prisma
model ResoMember {
  id                    String    @id @default(cuid())
  memberKey             String    @unique
  memberFullName        String?
  memberEmail           String?
  memberMobilePhone     String?
  officeKey             String?
  officeName            String?
  memberStatus          String?
  modificationTimestamp DateTime?
  photosChangeTimestamp DateTime?
  lastSyncedAt          DateTime
  rawJson               String?

  @@map("reso_members")
}
```

### New: `ResoOffice`
```prisma
model ResoOffice {
  id                    String    @id @default(cuid())
  officeKey             String    @unique
  officeName            String?
  officeEmail           String?
  officePhone           String?
  modificationTimestamp DateTime?
  photosChangeTimestamp DateTime?
  lastSyncedAt          DateTime
  rawJson               String?

  @@map("reso_offices")
}
```

### Modified: `ResoSyncLog` — add `syncType`
```prisma
syncType  String  @default("idx_property")
```

### Modified: `ResoProperty` — add DLA-enriched fields
| Field | Type | Source | Notes |
|---|---|---|---|
| `mlsStatus` | String? | DLA | e.g. `Active`, `Sold` |
| `contractStatus` | String? | DLA | e.g. `Available`, `Sold` |
| `photosChangeTimestamp` | DateTime? | DLA | Separate from `ModificationTimestamp` |
| `documentsChangeTimestamp` | DateTime? | DLA | |
| `mediaChangeTimestamp` | DateTime? | DLA | Combined photos+docs indicator |
| `listAgentFullName` | String? | DLA | |
| `listOfficeName` | String? | DLA | |
| `majorChangeTimestamp` | DateTime? | DLA | |

All existing `ResoProperty` fields remain unchanged.

---

## Sync Flows

### IDX Property Sync (`syncType = 'idx_property'`)
1. Load checkpoint from `AmpreSyncCheckpoint` where `syncType = 'idx_property'`
2. Batch-fetch `Property` with IDX token using timestamp+key cursor; `$select` = public fields only
3. For each record: upsert `ResoProperty` by `listingKey` — write IDX fields
4. Persist checkpoint after each batch
5. On completion (batch < batchSize): mark Active listings absent from this run as `Closed`
6. Write `ResoSyncLog` with `syncType = 'idx_property'`

### DLA Property Sync (`syncType = 'dla_property'`)
1. Same cursor loop with DLA token + separate checkpoint (`dla_property`)
2. Upsert `ResoProperty` — write only DLA-enriched fields; do not touch IDX-only fields
3. Does **not** trigger removed-listing logic (DLA enriches, IDX owns status)
4. Write `ResoSyncLog` with `syncType = 'dla_property'`

### VOX Member Sync (`syncType = 'vox_member'`)
1. Cursor loop on `Member` resource with VOX token; key field = `MemberKey`
2. Upsert `ResoMember` by `memberKey`
3. Write `ResoSyncLog` with `syncType = 'vox_member'`

### VOX Office Sync (`syncType = 'vox_office'`)
1. Cursor loop on `Office` resource with VOX token; key field = `OfficeKey`
2. Upsert `ResoOffice` by `officeKey`
3. Write `ResoSyncLog` with `syncType = 'vox_office'`

---

## API Route

`/api/reso/sync` — auth unchanged (admin session or `x-cron-secret` header).

| Request | Runs |
|---|---|
| `POST /api/reso/sync` | `idx_property` (default, backward-compatible) |
| `POST /api/reso/sync?type=dla` | `dla_property` |
| `POST /api/reso/sync?type=vox` | `vox_member` + `vox_office` |
| `POST /api/reso/sync?type=all` | All four in sequence |

`GET /api/reso/sync` returns last sync log per type + active listing count. Response shape:
```json
{
  "lastSync": { "idx_property": {...}, "dla_property": {...}, "vox_member": {...}, "vox_office": {...} },
  "activeListings": 1234
}
```

---

## Environment Variables

### `.env.example` (after)
```
# ─── Amplify TREB/AMPRE ────────────────────────────────────────────────────────
AMPRE_IDX_TOKEN=mock-idx-token
AMPRE_DLA_TOKEN=mock-dla-token
AMPRE_VOX_TOKEN=mock-vox-token
# Local dev only — points to mock. Omit in production.
AMPRE_API_BASE_URL=http://localhost:3000/api/mock-reso
# Cron authentication (unchanged)
RESO_SYNC_SECRET=change-me-in-production
```

### Removed
`RESO_API_BASE_URL`, `RESO_CLIENT_ID`, `RESO_CLIENT_SECRET`, `RESO_TOKEN_SECRET`

---

## Files Changed

### New Files
- `lib/mock-ampre-auth.ts` — replaces `lib/mock-reso-auth.ts`
- `prisma/migrations/<timestamp>_ampre_compliance/` — new migration

### Modified Files
- `services/reso/client.ts` — complete rewrite (static Bearer, no OAuth2)
- `services/reso/sync.ts` — timestamp+key replication, four sync types
- `services/reso/types.ts` — add `ResoMemberRaw`, `ResoOfficeRaw` full types; update `ResoODataResponse` with `@odata.nextLink`
- `app/api/reso/sync/route.ts` — add `?type=` param support; update GET response
- `prisma/schema.prisma` — add `AmpreSyncCheckpoint`, `ResoMember`, `ResoOffice`; add `syncType` to `ResoSyncLog`; add DLA fields to `ResoProperty`
- `app/api/mock-reso/Property/route.ts` — use `validateMockToken`
- `app/api/mock-reso/Member/route.ts` — use `validateMockToken`
- `app/api/mock-reso/Office/route.ts` — use `validateMockToken`
- `.env.example` — replace RESO vars with AMPRE vars

### Deleted Files
- `app/api/mock-reso/token/route.ts` — no token exchange needed
- `lib/mock-reso-auth.ts` — replaced by `lib/mock-ampre-auth.ts`

---

## Out of Scope

- Media resource sync (photos/documents — separate pipeline)
- PropertyRooms / PropertyLandmark resources
- Add/Edit (PATCH/POST/DELETE to Amplify)
- Admin UI changes for per-token sync status
- Webhook-based listing updates
