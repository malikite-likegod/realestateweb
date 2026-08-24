# PropTx / AMPRE API Integration Guide

This document describes how to integrate with the **PropTx AMPRE OData API** to sync MLS listing data into a local database. It covers authentication, all four sync pipelines, field mappings, data quirks, and gotchas discovered in production.

---

## Overview

PropTx (formerly AMPRE) exposes Canadian MLS® listing data via an **OData v4 REST API** at:

```
https://query.ampre.ca/odata
```

There is no OAuth2 handshake — credentials are **pre-issued bearer tokens**, one per data access tier. You receive up to three tokens:

| Token env var      | Tier | Resources available          |
|--------------------|------|------------------------------|
| `AMPRE_IDX_TOKEN`  | IDX  | `Property`, `Media`          |
| `AMPRE_DLA_TOKEN`  | DLA  | `Property` (enriched fields) |
| `AMPRE_VOX_TOKEN`  | VOX  | `Member`, `Office`           |

Set these in your environment. The base URL defaults to `https://query.ampre.ca/odata`; override with `AMPRE_API_BASE_URL` for local mocking.

---

## Making Requests

All requests are `GET` with an `Authorization: Bearer <token>` header. The URL pattern is:

```
GET {BASE_URL}/{Resource}?$filter=...&$select=...&$top=...&$orderby=...
```

**Critical:** Use `encodeURIComponent` on `$filter`, `$select`, and `$orderby` values. Do **not** use `URLSearchParams` — it encodes spaces as `+` but OData servers require `%20`.

```typescript
const parts: string[] = []
if (params.$filter)  parts.push(`$filter=${encodeURIComponent(params.$filter)}`)
if (params.$select)  parts.push(`$select=${encodeURIComponent(params.$select)}`)
if (params.$top)     parts.push(`$top=${params.$top}`)
if (params.$orderby) parts.push(`$orderby=${encodeURIComponent(params.$orderby)}`)
const url = `${BASE_URL}/${resource}?${parts.join('&')}`
```

### Response shape

```typescript
interface AmpreODataResponse<T> {
  '@odata.context'?:  string
  '@odata.count'?:    number
  '@odata.nextLink'?: string  // NOT used by this implementation; pagination is cursor-based
  value:              T[]
}
```

### Rate limiting

- HTTP 429 includes `X-Rate-Limit-Retry-After-Seconds` header
- Read that value, sleep that many seconds, then retry once
- If still 429 after one retry, throw and record the error — do not loop indefinitely

---

## Data Types — Quirks to Know

PropTx returns fields inconsistently typed. **Never assume a numeric field is a number.**

| Pattern                    | What PropTx sends                        | How to handle                               |
|----------------------------|------------------------------------------|---------------------------------------------|
| Numeric fields             | `number` or `"123"` (string)             | `parseInt(v, 10)` / `parseFloat(v)`         |
| Multi-value text fields    | `"Forced Air"` or `["Forced Air", "Gas"]`| `Array.isArray(v) ? v.join(', ') : v`       |
| Boolean-ish fields         | `true` / `false` (real boolean)          | Map to `"Yes"` / `"No"` strings if needed   |
| Timestamps                 | ISO 8601 string `"2024-03-15T10:00:00Z"` | `new Date(v)` — always check for `null`     |
| Missing fields             | Field absent from response entirely      | Use `?? null` — never assume present        |

**Utility functions used in this project:**

```typescript
function toStr(v: string | string[] | null | undefined): string | null {
  if (v == null) return null
  if (Array.isArray(v)) return v.length > 0 ? v.join(', ') : null
  return v || null
}

function toInt(v: number | string | null | undefined): number | null {
  if (v == null) return null
  const n = typeof v === 'string' ? parseInt(v, 10) : Math.round(v)
  return isNaN(n) ? null : n
}

function toFloat(v: number | string | null | undefined): number | null {
  if (v == null) return null
  const n = typeof v === 'string' ? parseFloat(v) : v
  return isNaN(n) ? null : n
}
```

---

## Field Name Mapping — PropTx vs. RESO Standard

PropTx uses **non-standard field names** for many common RESO fields. Using a wrong name in `$select` causes an immediate **HTTP 400** and the entire sync fails — there is no partial success.

| Standard RESO name      | PropTx actual name          | Notes                                      |
|-------------------------|-----------------------------|--------------------------------------------|
| `GarageSpaces`          | `GarageParkingSpaces`       | Returns as string, parse with `toInt()`    |
| `AirConditioning`       | `Cooling`                   | String or string array                     |
| `CommunityFeatures`     | `CityRegion`                | Maps to neighborhood/community name        |
| `CountyOrParish`        | `CountyOrParish`            | Maps to municipality                       |
| `Latitude`              | *(not available)*           | IDX tier has no geo coordinates            |
| `Longitude`             | *(not available)*           | IDX tier has no geo coordinates            |
| `LivingArea`            | `BuildingAreaTotal`         | Returns float                              |
| `StoriesTotal`          | `LegalStories`              | Returns number, store as string            |
| `WaterBodyName`         | `WaterfrontFeatures`        | String or array                            |
| `FrontingOn`            | `DirectionFaces`            | String or array                            |
| `DenFamilyRoom`         | `DenFamilyroomYN`           | Boolean — map to "Yes"/"No"                |
| `ListingDate`           | `OriginalEntryTimestamp`    | ISO timestamp string                       |
| `AssociationFee`        | `AssociationFee`            | Maintenance fee for condos                 |

**Confirmed valid IDX `$select` fields** (all 91 — any field not in this list will cause a 400):

```
ListingKey, StandardStatus, PropertyType, PropertySubType,
ListPrice, BedroomsTotal, BedroomsAboveGrade, BedroomsBelowGrade, BathroomsTotalInteger,
BuildingAreaTotal, LivingAreaRange, LotSizeArea, LotSizeUnits, LotWidth, LotDepth,
StreetNumber, StreetDirPrefix, StreetName, StreetSuffix, StreetDirSuffix, UnitNumber, UnparsedAddress,
TransactionType, City, CityRegion, CountyOrParish, StateOrProvince, PostalCode,
PublicRemarks, ListOfficeKey, ListOfficeName,
OriginalEntryTimestamp, ModificationTimestamp,
GarageParkingSpaces, ParkingTotal, ParkingFeatures,
KitchensTotal, KitchensAboveGrade, KitchensBelowGrade,
Basement, HeatSource, HeatType, Cooling, DenFamilyroomYN, FireplaceFeatures,
ExteriorFeatures, Roof, FoundationDetails, PoolFeatures,
DirectionFaces, WaterfrontFeatures, WaterfrontYN,
ArchitecturalStyle, LegalStories, ApproximateAge, ConstructionMaterials, Sewer, WaterSource,
CrossStreet, AssociationAmenities,
TaxAnnualAmount, TaxYear, AssociationFee, AssociationFeeIncludes, AssessmentYear
```

**Confirmed valid DLA `$select` fields:**

```
ListingKey, ModificationTimestamp,
MlsStatus, ContractStatus,
PhotosChangeTimestamp, DocumentsChangeTimestamp, MediaChangeTimestamp,
ListAgentFullName, ListOfficeName, MajorChangeTimestamp
```

**Confirmed valid Media `$select` fields:**

```
MediaKey, ResourceRecordKey, MediaURL, Order, MediaStatus, ImageSizeDescription
```

**Confirmed valid VOX Member `$select` fields:**

```
MemberKey, MemberFullName, MemberEmail, MemberMobilePhone,
MemberStatus, OfficeKey, ModificationTimestamp, PhotosChangeTimestamp
```

**Confirmed valid VOX Office `$select` fields:**

```
OfficeKey, OfficeName, OfficeEmail, OfficePhone, ModificationTimestamp
```

---

## Sync Pipeline — Four Jobs

The full sync runs four jobs, in this order:

```
1. IDX Property  →  core listing data (Active only)
2. DLA Property  →  enriched fields (agent name, MLS status, timestamps)
3. IDX Media     →  photo URLs (deferred, only for listings without photos)
4. VOX Member    →  agent directory
5. VOX Office    →  brokerage directory
```

Jobs 1–3 run sequentially (DLA references rows written by IDX). Jobs 4–5 can run in parallel with 1–3.

### Checkpoint-based incremental sync

All sync jobs except Media use a **cursor checkpoint** stored in the database:

```typescript
// AmpreSyncCheckpoint table
{
  syncType:      string   // 'idx_property' | 'dla_property' | 'vox_member' | 'vox_office'
  lastTimestamp: Date
  lastKey:       string
}
```

On each page, after upserting records, save the timestamp and key from the last record. On the next run, filter from that point forward:

```
$filter=ModificationTimestamp gt 2024-03-15T10:00:00Z
$orderby=ModificationTimestamp asc
$top=1000
```

**Important timestamp format:** AMPRE rejects milliseconds in timestamps. Strip them:

```typescript
date.toISOString().replace(/\.\d{3}Z$/, 'Z')
// "2024-03-15T10:00:00.000Z" → "2024-03-15T10:00:00Z"
```

Start with `lastTimestamp = new Date('1970-01-01T00:00:00Z')` for the first full scan.

### Stale listing cleanup

After a **complete** full scan (first run after epoch, where all pages were fetched without interruption), listings not seen in the feed should be marked inactive. The logic:

1. Record `syncStartedAt = new Date()` at the start of the sync
2. After all pages are fetched, find `Active` listings where `lastSyncedAt < syncStartedAt`
3. Mark them `Closed`

Only do this on full-scan completion — not on interrupted runs or incremental updates. This avoids falsely closing listings when a sync was rate-limited partway through.

---

## IDX Property Sync — Detailed

```typescript
// Filter: Active listings modified after cursor
const filter = `(ModificationTimestamp gt ${toODataTs(lastTimestamp)}) and (StandardStatus eq 'Active')`

// Page through all results
while (true) {
  const batch = await ampreGet<ResoPropertyRaw>('idx', 'Property', {
    $filter:  filter,
    $orderby: 'ModificationTimestamp asc',
    $top:     1000,
    $select:  IDX_SELECT,
  })

  // Upsert records
  // ...

  if (batch.value.length < 1000) break  // last page
}
```

**Key field mapping from API response to local DB:**

```typescript
{
  listingKey:            r.ListingKey,            // unique MLS identifier
  listingId:             r.ListingKey,            // PropTx has no separate ListingId
  standardStatus:        r.StandardStatus,        // 'Active', 'Closed', 'Pending', etc.
  propertyType:          r.PropertyType,          // 'Residential', 'Commercial Lease', etc.
  propertySubType:       r.PropertySubType,       // 'Detached', 'Condo Apt', 'Semi-Detached', etc.
  transactionType:       r.TransactionType,       // 'For Sale', 'For Lease'
  listPrice:             toFloat(r.ListPrice),
  bedroomsTotal:         toInt(r.BedroomsTotal),
  bedroomsPlus:          toInt(r.BedroomsBelowGrade),   // below-grade bedrooms = "plus"
  bathroomsTotalInteger: toInt(r.BathroomsTotalInteger),
  livingArea:            toFloat(r.BuildingAreaTotal),
  sqftRange:             r.LivingAreaRange,              // e.g. "1500-2000"
  lotSizeSquareFeet:     toFloat(r.LotSizeArea),
  lotFront:              toFloat(r.LotWidth),
  lotDepth:              toFloat(r.LotDepth),
  // Address — 5 separate components, NO single unparsedAddress field in DB
  streetNumber:          r.StreetNumber,
  streetDirPrefix:       r.StreetDirPrefix,
  streetName:            r.StreetName,
  streetSuffix:          r.StreetSuffix,
  streetDirSuffix:       r.StreetDirSuffix,
  unitNumber:            r.UnitNumber,
  city:                  r.City,
  community:             r.CityRegion,           // neighborhood/district
  municipality:          r.CountyOrParish,
  stateOrProvince:       r.StateOrProvince,
  postalCode:            r.PostalCode,
  // Interior
  garageSpaces:          toInt(r.GarageParkingSpaces),  // NOT GarageSpaces
  parkingTotal:          toInt(r.ParkingTotal),
  parkingFeatures:       toStr(r.ParkingFeatures),
  kitchensTotal:         toInt(r.KitchensTotal),
  kitchensPlusTotal:     toInt(r.KitchensBelowGrade),
  basement:              toStr(r.Basement),
  heatSource:            toStr(r.HeatSource),
  heatType:              toStr(r.HeatType),
  airConditioning:       toStr(r.Cooling),              // NOT AirConditioning
  familyRoom:            r.DenFamilyroomYN ? 'Yes' : 'No',
  fireplaceFeatures:     toStr(r.FireplaceFeatures),
  // Exterior
  exteriorFeatures:      toStr(r.ExteriorFeatures),
  roof:                  toStr(r.Roof),
  foundationDetails:     toStr(r.FoundationDetails),
  poolFeatures:          toStr(r.PoolFeatures),
  frontingOn:            toStr(r.DirectionFaces),       // NOT FrontingOn
  waterFrontType:        toStr(r.WaterfrontFeatures),
  // Building
  style:                 toStr(r.ArchitecturalStyle),
  storiesTotal:          r.LegalStories != null ? String(r.LegalStories) : null,
  approximateAge:        r.ApproximateAge,
  constructionMaterials: toStr(r.ConstructionMaterials),
  sewer:                 toStr(r.Sewer),
  water:                 toStr(r.WaterSource),
  // Community & taxes
  crossStreet:           r.CrossStreet,
  amenities:             toStr(r.AssociationAmenities),
  taxAnnualAmount:       toFloat(r.TaxAnnualAmount),
  taxYear:               toInt(r.TaxYear),
  maintenanceFee:        toFloat(r.AssociationFee),
  maintenanceFeeIncludes: toStr(r.AssociationFeeIncludes),
  assessmentYear:        toInt(r.AssessmentYear),
  // Timestamps
  listingContractDate:   new Date(r.OriginalEntryTimestamp),   // listing date
  modificationTimestamp: new Date(r.ModificationTimestamp),
  // NOT available in IDX tier:
  //   latitude, longitude, flooring, ownershipType, inclusions, exclusions
  //   listAgentKey, listAgentName (come from DLA)
  //   media (fetched separately)
}
```

---

## DLA Property Sync — Enrichment Pass

The DLA tier provides additional fields not in IDX. Run **after** IDX to enrich existing rows. It uses the same cursor pattern but does **not** filter by `StandardStatus` — it enriches all statuses.

```typescript
// DLA enrichment — only writes its own fields, never touches IDX fields
await db.property.upsert({
  where:  { listingKey: r.ListingKey },
  update: {
    mlsStatus:                r.MlsStatus       || undefined,
    contractStatus:           r.ContractStatus  || undefined,
    listAgentName:            r.ListAgentFullName || undefined,
    majorChangeTimestamp:     r.MajorChangeTimestamp ? new Date(r.MajorChangeTimestamp) : undefined,
    photosChangeTimestamp:    r.PhotosChangeTimestamp ? new Date(r.PhotosChangeTimestamp) : undefined,
    // ...
  },
  create: { listingKey: r.ListingKey, city: '', stateOrProvince: '', standardStatus: 'Active', ... }
})
```

Use `|| undefined` (not `|| null`) on update so absent fields are skipped entirely rather than overwriting IDX-owned data with null.

---

## IDX Media Sync — Photo URLs

Photos live in a separate `Media` resource. Fetch them in batches of **10 listings at a time** — larger batches time out on the AMPRE server.

```typescript
// Filter by listing keys using `in` operator
const inList = keys.map(k => `'${k.replace(/'/g, "''")}'`).join(',')
const batch = await ampreGet<ResoMediaRaw>('idx', 'Media', {
  $filter:  `ResourceRecordKey in (${inList})`,
  $orderby: 'ResourceRecordKey,Order',
  $top:     10000,
  $select:  'MediaKey,ResourceRecordKey,MediaURL,Order,MediaStatus,ImageSizeDescription',
})
```

**Photo deduplication by size:** AMPRE returns multiple records per photo (one per size variant). Pick the best quality per `Order` slot:

```typescript
const SIZE_RANK = { Thumbnail: 0, Small: 1, Medium: 2, Large: 3, Largest: 4 }
// For each (listingKey, order) pair, keep the record with highest SIZE_RANK
```

**Skip deleted photos:** `if (m.MediaStatus === 'Deleted') continue`

**Store as JSON array:**

```typescript
// Stored in media column as JSON string
[{ url: "https://...", order: 0 }, { url: "https://...", order: 1 }, ...]
```

**Mark listings with no photos** so they aren't re-fetched every sync run:

```typescript
// Set media = '[]' (empty array string) for listings that had no results
```

**Re-fetch on change, not just once:** fetching only `media IS NULL` means a listing's
photos are pulled exactly once and never revisited — a seller swapping photos on an
already-synced listing would never show up. Instead, also re-fetch listings where
`mediaChangeTimestamp` (written by DLA sync, see above) is newer than `mediaSyncedAt`
(stamped on every listing — including the no-photos `'[]'` case — each time media is
actually fetched for it, separate from `lastSyncedAt` which every sync type bumps):

```typescript
// candidates = media IS NULL
//   OR (mediaChangeTimestamp IS NOT NULL AND (mediaSyncedAt IS NULL OR mediaSyncedAt < mediaChangeTimestamp))
```

Comparing two columns on the same row isn't supported by Prisma's `where` without
preview features, so this is done as two queries plus a JS filter — see `syncIdxMedia`
in `services/reso/sync.ts`.

---

## VOX Member & Office Sync

The `Member` and `Office` endpoints **do not support `ModificationTimestamp` in `$filter`**. Paginate by the primary key instead (full table scan each run):

```typescript
// Member sync — paginate by MemberKey
let lastKey = '0'
while (true) {
  const batch = await ampreGet('vox', 'Member', {
    $filter:  `MemberKey gt '${lastKey.replace(/'/g, "''")}'`,
    $orderby: 'MemberKey asc',
    $top:     1000,
    $select:  VOX_MEMBER_SELECT,
  })
  // upsert batch...
  if (batch.value.length < 1000) break
  lastKey = records[records.length - 1].MemberKey
}
```

The same pattern applies to `Office` with `OfficeKey`. These datasets are small enough that a full scan per run is acceptable.

**Escape single quotes in key values:** Use `key.replace(/'/g, "''")` when interpolating into OData filter strings.

---

## Triggering Syncs

Expose an API endpoint to trigger syncs. This project uses `POST /api/reso/sync`:

| Query param  | Value   | Effect                                          |
|--------------|---------|-------------------------------------------------|
| `type`       | `idx`   | IDX property sync only                         |
| `type`       | `dla`   | DLA enrichment only                            |
| `type`       | `media` | Photo sync only                                |
| `type`       | `vox`   | Members + Offices                              |
| `type`       | `all`   | Full pipeline (IDX → DLA → Media + VOX)        |
| `force`      | `true`  | Skip interval check (for cron jobs)            |

**Authentication:** Require either an admin session cookie OR a pre-shared `x-cron-secret` header (store in `RESO_SYNC_SECRET` env var). Never expose the sync endpoint without auth.

**Background execution:** Return 200 immediately, run the sync in `setImmediate()`. Syncs can take minutes; the caller should not wait.

---

## Environment Variables

```bash
# PropTx API — one token per tier
AMPRE_IDX_TOKEN=your-idx-token
AMPRE_DLA_TOKEN=your-dla-token
AMPRE_VOX_TOKEN=your-vox-token

# Override base URL (omit to use production endpoint)
# AMPRE_API_BASE_URL=https://query.ampre.ca/odata

# Cron endpoint authentication
RESO_SYNC_SECRET=your-random-secret

# Optional: filter listings to a specific brokerage
# AMPRE_OFFICE_KEY=your-office-key
```

For **local development without real credentials**, implement a mock OData server at the `AMPRE_API_BASE_URL` path that serves seed data from a local array. This project's mock is at `app/api/mock-reso/*` and uses the same OData response shape.

---

## Database Schema (Prisma)

Minimum required tables for the sync pipeline:

```prisma
model ResoProperty {
  id                    String    @id @default(cuid())
  listingKey            String    @unique          // e.g. "TRREB-1001234"
  standardStatus        String                     // "Active", "Closed", etc.
  // ... all field columns ...
  media                 String?                    // JSON string: [{url, order}]
  mediaChangeTimestamp  DateTime?                  // from DLA — when photos changed on the feed
  mediaSyncedAt         DateTime?                  // when we last actually fetched media; drives re-fetch
  onDemand              Boolean   @default(false)  // true = fetched ad-hoc, skip stale check
  lastSyncedAt          DateTime?
  modificationTimestamp DateTime?
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt

  @@index([standardStatus])
  @@index([lastSyncedAt])
}

model AmpreSyncCheckpoint {
  syncType      String   @id   // 'idx_property' | 'dla_property' | 'vox_member' | 'vox_office'
  lastTimestamp DateTime
  lastKey       String
  updatedAt     DateTime @updatedAt
}

model ResoSyncLog {
  id         String   @id @default(cuid())
  syncType   String
  added      Int      @default(0)
  updated    Int      @default(0)
  deleted    Int      @default(0)
  errors     Int      @default(0)
  notes      String?
  durationMs Int      @default(0)
  syncedAt   DateTime @default(now())

  @@index([syncType, syncedAt])
}

model ResoMember {
  memberKey             String    @id
  memberFullName        String?
  memberEmail           String?
  memberMobilePhone     String?
  memberStatus          String?
  officeKey             String?
  modificationTimestamp DateTime?
  photosChangeTimestamp DateTime?
  lastSyncedAt          DateTime?
}

model ResoOffice {
  officeKey             String    @id
  officeName            String?
  officeEmail           String?
  officePhone           String?
  modificationTimestamp DateTime?
  lastSyncedAt          DateTime?
}
```

---

## On-Demand Fetch

For listing detail pages where the listing is not in the local database (e.g., linked from an external source), fetch it on demand:

```typescript
async function fetchPropertyOnDemand(listingKey: string): Promise<void> {
  const batch = await ampreGet<ResoPropertyRaw>('idx', 'Property', {
    $filter:  `ListingKey eq '${listingKey.replace(/'/g, "''")}'`,
    $select:  IDX_SELECT,
    $top:     1,
  })
  if (batch.value.length > 0) {
    await db.resoProperty.upsert({
      where:  { listingKey },
      update: { ...mappedFields, onDemand: true },
      create: { ...mappedFields, listingKey, onDemand: true },
    })
  }
}
```

Mark `onDemand: true` so the stale-cleanup job does not delete it (it won't appear in the regular IDX feed if it's from another brokerage).

---

## Known Limitations

| Limitation | Detail |
|------------|--------|
| No geo coordinates | IDX tier does not include `Latitude`/`Longitude` — map features require a geocoding step |
| No flooring field | Not available in PropTx IDX; must source elsewhere |
| No inclusions/exclusions | Not available in PropTx IDX |
| No `ownershipType` | Not available in PropTx IDX |
| Member endpoint no delta | `Member` and `Office` don't support `ModificationTimestamp` filter — full scan required each run |
| Numeric fields as strings | Many numeric fields arrive as strings — always parse, never cast |
| Single-quote escaping | Key values in OData filters must escape `'` as `''` |
| `$select` is strict | Any single invalid field name in `$select` causes a 400 for the entire request |
| Media batch size | Fetching media for more than ~10 listings per request causes timeouts |

---

## MLS Compliance Requirements

When displaying synced data publicly, PropTx/TRREB MLS® compliance rules require:

1. **Disclaimer footer** on all pages showing IDX data — display the required MLS® disclaimer text
2. **Brokerage attribution** — show `ListOfficeName` on every listing card and detail page
3. **Result cap** — enforce a maximum of 100 listings per query response to end users
4. **No data export** — listings must not be exportable in bulk by end users
5. **Status accuracy** — only show `Active` listings in search results; never display `Closed` as available
6. **Contact capture before full details** — a lead gate before showing address/agent details is common compliance practice

Obtain the current official disclaimer text from PropTx/TRREB directly — it changes periodically.
