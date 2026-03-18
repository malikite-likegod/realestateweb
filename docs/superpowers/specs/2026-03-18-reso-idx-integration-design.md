# RESO IDX Integration — Design Spec

**Date:** 2026-03-18
**Status:** Approved

---

## Overview

Replace the existing IDX Broker service layer with a RESO Web API-compatible integration. The system is designed to run entirely against a local Mock RESO API today, and switch to the real PropTx / TRREB RESO Web API by changing three environment variables when credentials become available.

Two new features are also introduced:
1. **Saved Searches** — verified leads can save filter sets from the public listings page; agents can manage them from the CRM contact profile.
2. **RESO Sync Pipeline** — a cron-able sync job that pulls listings from the RESO API and caches them in the local database.

---

## Architecture

```
Public pages / Admin pages
        ↓
lib/property-service.ts        ← only thing the app touches
        ↓
ResoProperty table (Prisma)    ← local DB cache, always fast
        ↑
services/reso/sync.ts          ← runs on cron or manual trigger
        ↑
services/reso/client.ts        ← HTTP + OAuth2 + OData
        ↑
/api/mock-reso/* (or real PropTx RESO API URL)
```

**Swap to real PropTx:**
```
RESO_API_BASE_URL=https://api.proptx.com/reso/odata
RESO_CLIENT_ID=<real>
RESO_CLIENT_SECRET=<real>
```
Run sync. Done. No code changes.

---

## Data Model

### Drop `IdxProperty`
The existing `IdxProperty` model and all `services/idx/` files are removed. `ResoProperty` is the replacement.

### `ResoProperty` (new table)

RESO Data Dictionary-aligned fields:

| Field | Type | RESO Name | Notes |
|---|---|---|---|
| `id` | String (cuid) | — | Primary key |
| `listingKey` | String (unique) | `ListingKey` | Provider's stable ID |
| `listingId` | String? | `ListingId` | Board-assigned MLS number |
| `standardStatus` | String | `StandardStatus` | `Active`, `Closed`, `Pending`, etc. |
| `propertyType` | String? | `PropertyType` | `Residential`, `Commercial`, etc. |
| `propertySubType` | String? | `PropertySubType` | `Detached`, `Condo`, `Townhouse`, etc. |
| `listPrice` | Float? | `ListPrice` | |
| `originalListPrice` | Float? | `OriginalListPrice` | |
| `closePrice` | Float? | `ClosePrice` | Set when sold |
| `bedroomsTotal` | Int? | `BedroomsTotal` | |
| `bathroomsTotalInteger` | Int? | `BathroomsTotalInteger` | |
| `livingArea` | Float? | `LivingArea` | sq ft |
| `lotSizeAcres` | Float? | `LotSizeAcres` | |
| `yearBuilt` | Int? | `YearBuilt` | |
| `streetNumber` | String? | `StreetNumber` | |
| `streetName` | String? | `StreetName` | |
| `unitNumber` | String? | `UnitNumber` | |
| `city` | String? | `City` | |
| `stateOrProvince` | String? | `StateOrProvince` | |
| `postalCode` | String? | `PostalCode` | |
| `latitude` | Float? | `Latitude` | |
| `longitude` | Float? | `Longitude` | |
| `publicRemarks` | String? | `PublicRemarks` | |
| `media` | String? | — | JSON array of `{url, order}` |
| `listAgentKey` | String? | `ListAgentKey` | |
| `listAgentName` | String? | `ListAgentFullName` | |
| `listOfficeKey` | String? | `ListOfficeKey` | |
| `listOfficeName` | String? | `ListOfficeName` | |
| `listDate` | DateTime? | `ListingContractDate` | |
| `modificationTimestamp` | DateTime? | `ModificationTimestamp` | |
| `lastSyncedAt` | DateTime | — | Set by sync job |
| `rawData` | String? | — | Full JSON from API |

### `SavedSearch` (new table)

| Field | Type | Notes |
|---|---|---|
| `id` | String (cuid) | Primary key |
| `name` | String? | User-given label |
| `filters` | String | JSON blob of filter params |
| `contactId` | String? | FK → Contact (public lead) |
| `userId` | String? | FK → User (admin-created) |
| `lastRunAt` | DateTime? | Updated on re-run |
| `createdAt` | DateTime | |

- At least one of `contactId` or `userId` must be set (enforced in route handlers).
- `Contact` and `User` models gain `savedSearches SavedSearch[]` relation fields.

### `ResoSyncLog` (replaces `IdxUpdate`)

Same fields as `IdxUpdate`, renamed:

| Field | Type | Notes |
|---|---|---|
| `id` | String (cuid) | |
| `syncedAt` | DateTime | |
| `added` | Int | |
| `updated` | Int | |
| `removed` | Int | |
| `errors` | String? | Newline-joined error list |
| `duration` | Int? | ms |

---

## Mock RESO API

Routes at `/api/mock-reso/` inside Next.js. Behaves identically to a real RESO Web API so the service layer cannot distinguish mock from real.

### Authentication

`POST /api/mock-reso/token`

Request body (`application/x-www-form-urlencoded`):
```
grant_type=client_credentials
client_id=<RESO_CLIENT_ID>
client_secret=<RESO_CLIENT_SECRET>
```

Response:
```json
{
  "access_token": "<signed JWT>",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

Token is a signed JWT (using `RESO_TOKEN_SECRET` env var). The mock Property/Member/Office routes validate the `Authorization: Bearer <token>` header.

### Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/mock-reso/token` | OAuth2 client_credentials token |
| `GET` | `/api/mock-reso/Property` | OData property collection |
| `GET` | `/api/mock-reso/Property/[ListingKey]` | Single property |
| `GET` | `/api/mock-reso/Member` | Agent records |
| `GET` | `/api/mock-reso/Office` | Office records |

### OData Query Parameters (`/Property`)

| Param | Supported expressions |
|---|---|
| `$filter` | `City eq 'Toronto'`, `ListPrice ge 500000`, `ListPrice le 900000`, `BedroomsTotal ge 3`, `StandardStatus eq 'Active'`, `and` combinations |
| `$select` | Comma-separated field list; trims response to those fields only |
| `$top` | Page size, max 100, default 20 |
| `$skip` | Offset for pagination |
| `$orderby` | e.g. `ListPrice desc`, `ModificationTimestamp desc` |

### Response Envelope

```json
{
  "@odata.context": "$metadata#Property",
  "@odata.count": 142,
  "value": [ ...listings ]
}
```

### Seed Data (`data/mock-reso-seed.ts`)

~60 Toronto/GTA listings with realistic data:
- **Neighbourhoods:** Leslieville, The Annex, Liberty Village, Roncesvalles, North York, Scarborough, Etobicoke, Mississauga, Vaughan
- **Property types:** Detached, Semi-Detached, Condo Apt, Townhouse, Condo Townhouse
- **Price range:** $549,000 – $2,100,000
- **Status mix:** ~80% Active, ~20% Closed
- Realistic agent names, office names, MLS-style `ListingKey` values (`TRREB-XXXXXXX`)

---

## Service Layer

### `services/reso/types.ts`

TypeScript interfaces mirroring the RESO Data Dictionary:
- `ResoPropertyRaw` — shape of a record returned by the RESO API
- `ResoMemberRaw` — agent record
- `ResoOfficeRaw` — office record
- `ResoODataResponse<T>` — standard OData envelope
- `ResoSyncResult` — `{ added, updated, removed, errors, durationMs }`

### `services/reso/client.ts`

OAuth token lifecycle:
- On first call, `POST /token` with `client_credentials` grant
- Caches token in memory with an expiry buffer (refresh 60s before expiry)
- `client.get<T>(resource, oDataParams)` — builds OData URL, attaches `Authorization: Bearer` header, returns typed response
- `RESO_API_BASE_URL` is the only env var that changes between mock and real

### `services/reso/sync.ts`

1. Paginate through `GET /Property?$filter=StandardStatus eq 'Active'&$top=100` until all pages consumed
2. For each record: upsert `ResoProperty` by `listingKey` (`prisma.resoProperty.upsert`)
3. Mark listings absent from feed (present in DB as Active, absent from response) as `Closed`
4. Write `ResoSyncLog` record with counts, errors, duration

### `lib/property-service.ts`

Public-facing abstraction over `ResoProperty`. Pages never touch Prisma directly.

```typescript
PropertyService.getProperties(filters: PropertyFilters): Promise<{ listings: ResoProperty[], total: number }>
PropertyService.getProperty(listingKey: string): Promise<ResoProperty | null>
```

`PropertyFilters`:
```typescript
{
  city?: string
  minPrice?: number
  maxPrice?: number
  minBeds?: number
  minBaths?: number
  propertyType?: string
  status?: string       // default: 'Active'
  page?: number         // default: 1
  pageSize?: number     // default: 20
}
```

### `lib/cache.ts`

```typescript
withCache<T>(key: string, ttlSeconds: number, fn: () => Promise<T>): Promise<T>
```

Initially uses an in-memory `Map` with TTL tracking. Replacing with Redis = swap the implementation of `withCache` only. `PropertyService.getProperties` wraps its Prisma query with `withCache`.

---

## API Routes

### Sync

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/reso/sync` | Admin JWT or `x-cron-secret` | Trigger sync |
| `GET` | `/api/reso/sync` | Admin JWT | Last sync status + active listing count |

### Saved Searches (Public)

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/saved-searches` | `re_verified` cookie | List own saved searches |
| `POST` | `/api/saved-searches` | `re_verified` cookie | Save a search |
| `DELETE` | `/api/saved-searches/[id]` | `re_verified` cookie | Remove own saved search |

### Saved Searches (Admin / CRM)

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/contacts/[id]/saved-searches` | Admin JWT | List contact's saved searches |
| `POST` | `/api/contacts/[id]/saved-searches` | Admin JWT | Create on behalf of contact |
| `DELETE` | `/api/contacts/[id]/saved-searches/[searchId]` | Admin JWT | Delete |

`/api/admin` is already in `PROTECTED_PATHS` in `middleware.ts`. The `/api/saved-searches` routes read the `re_verified` cookie directly — no middleware protection needed.

---

## Frontend

### Modified Pages

- **`app/(public)/listings/page.tsx`** — reads query params from URL, calls `PropertyService.getProperties(filters)`, renders `ListingFilters` + results grid + pagination. URL params: `city`, `minPrice`, `maxPrice`, `minBeds`, `minBaths`, `type`, `page`.
- **`app/(public)/listings/[id]/page.tsx`** — calls `PropertyService.getProperty(listingKey)`. Field names updated to RESO names. Gate logic unchanged.
- **`app/admin/listings/page.tsx`** — reads from `PropertyService` (or direct Prisma on `ResoProperty` — admin doesn't need the cache layer).
- **`app/admin/settings/page.tsx`** — sync widget reads from `ResoSyncLog`; "Sync Now" posts to `/api/reso/sync`.
- **`app/admin/contacts/[id]/page.tsx`** — adds Saved Searches tab to the existing `PropertyInterestsPanel` tab set.

### New Components

- **`components/public/ListingFilters.tsx`** — client component; city text input, price range inputs, bed/bath selects, property type select. Updates URL search params on submit. Shows "Save this search" button when `re_verified` cookie is present.
- **`components/public/SaveSearchButton.tsx`** — calls `POST /api/saved-searches`, shows confirmation toast on save.
- **`components/admin/contacts/SavedSearchesTab.tsx`** — lists saved searches for a contact with filter summary, last-run date, run button (links to `/listings?...`), delete button. Agent can create a new saved search from a filter form.

---

## Environment Variables

Add to `.env.example`:

```
# ─── RESO / PropTx ────────────────────────────────────────────────────────────
RESO_API_BASE_URL=http://localhost:3000/api/mock-reso
RESO_CLIENT_ID=mock-client
RESO_CLIENT_SECRET=mock-secret
RESO_TOKEN_SECRET=some-random-local-secret
RESO_SYNC_SECRET=some-cron-secret
```

When real credentials arrive, only `RESO_API_BASE_URL`, `RESO_CLIENT_ID`, and `RESO_CLIENT_SECRET` change.

---

## Removed Files

- `services/idx/` — entire folder (client.ts, parser.ts, sync.ts, types.ts)
- `app/api/idx/` — replaced by `app/api/reso/`

---

## Affected Files

### New Files
- `prisma/migrations/` — new migration
- `data/mock-reso-seed.ts` — ~60 GTA seed listings
- `services/reso/types.ts`
- `services/reso/client.ts`
- `services/reso/sync.ts`
- `lib/property-service.ts`
- `lib/cache.ts`
- `app/api/mock-reso/token/route.ts`
- `app/api/mock-reso/Property/route.ts`
- `app/api/mock-reso/Property/[ListingKey]/route.ts`
- `app/api/mock-reso/Member/route.ts`
- `app/api/mock-reso/Office/route.ts`
- `app/api/reso/sync/route.ts`
- `app/api/saved-searches/route.ts`
- `app/api/saved-searches/[id]/route.ts`
- `app/api/contacts/[id]/saved-searches/route.ts`
- `app/api/contacts/[id]/saved-searches/[searchId]/route.ts`
- `components/public/ListingFilters.tsx`
- `components/public/SaveSearchButton.tsx`
- `components/admin/contacts/SavedSearchesTab.tsx`

### Modified Files
- `prisma/schema.prisma` — add ResoProperty, SavedSearch, ResoSyncLog; drop IdxProperty
- `app/(public)/listings/page.tsx` — use PropertyService + ListingFilters
- `app/(public)/listings/[id]/page.tsx` — use PropertyService + RESO field names
- `app/admin/listings/page.tsx` — use ResoProperty
- `app/admin/settings/page.tsx` — use ResoSyncLog
- `app/admin/contacts/[id]/page.tsx` — add SavedSearchesTab

### Deleted Files
- `services/idx/client.ts`
- `services/idx/parser.ts`
- `services/idx/sync.ts`
- `services/idx/types.ts`
- `app/api/idx/sync/route.ts`

---

## Out of Scope

- Real PropTx OAuth flow setup (no credentials yet)
- Map view for listings
- Listing detail page public URL slug (uses `listingKey` as route param)
- Agent/office profile pages
- Webhook-based listing updates (polling sync is sufficient for now)
- Redis cache implementation (in-memory LRU is the placeholder)
