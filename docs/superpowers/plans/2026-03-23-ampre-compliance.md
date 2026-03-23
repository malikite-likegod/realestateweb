# AMPRE Compliance Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the broken OAuth2 / `$top`+`$skip` RESO integration with a fully compliant Amplify (AMPRE) implementation using static Bearer tokens and timestamp+key cursor replication across four sync types.

**Architecture:** A new `AmpreClient` (`services/reso/client.ts`) holds three static tokens (IDX/DLA/VOX) and handles rate-limit retry. A rewritten `sync.ts` runs up to four independent cursor loops, each persisting a checkpoint to `AmpreSyncCheckpoint` after every batch. The API route gains a `?type=` selector; the mock is simplified to Bearer-only.

**Tech Stack:** Next.js 14 App Router, Prisma (SQLite dev / MySQL prod), TypeScript

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Modify | `prisma/schema.prisma` | Add `AmpreSyncCheckpoint`, `ResoMember`, `ResoOffice`; rename `ResoSyncLog.resourceType`→`syncType`; add DLA fields to `ResoProperty` |
| Generate | `prisma/migrations/<ts>_ampre_compliance/` | SQL migration (auto-generated) |
| Modify | `services/reso/types.ts` | Add `@odata.nextLink`; update `ResoMemberRaw`/`ResoOfficeRaw`; rename response type |
| Create | `lib/mock-ampre-auth.ts` | Validates Bearer token against three AMPRE env vars |
| Delete | `lib/mock-reso-auth.ts` | Replaced by `mock-ampre-auth.ts` |
| Delete | `app/api/mock-reso/token/route.ts` | No token exchange needed |
| Modify | `app/api/mock-reso/Property/route.ts` | Swap auth import; fix multi-field `$orderby` |
| Modify | `app/api/mock-reso/Member/route.ts` | Swap auth; add `$filter`/`$select`/`$top`/`$orderby` support |
| Modify | `app/api/mock-reso/Office/route.ts` | Swap auth; add `$filter`/`$select`/`$top`/`$orderby` support |
| Modify | `data/mock-reso-seed.ts` | Add `ModificationTimestamp`, phone/status fields to Member/Office |
| Rewrite | `services/reso/client.ts` | Static Bearer, three token configs, rate-limit retry, `ampreGet<T>` |
| Rewrite | `services/reso/sync.ts` | Four sync types, timestamp+key cursor, checkpoint persistence |
| Modify | `app/api/reso/sync/route.ts` | `?type=idx\|dla\|vox\|all` param; per-syncType GET response |
| Modify | `app/admin/settings/page.tsx` | Query per-syncType last sync logs |
| Modify | `components/admin/MlsSyncSettingsCard.tsx` | Display per-syncType sync status |
| Modify | `.env.example` | Swap RESO vars → AMPRE vars |

---

## Chunk 1: Foundation — Schema, Types, Mock Infrastructure

### Task 1: Prisma Schema + Migration

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add `AmpreSyncCheckpoint` model to schema**

In `prisma/schema.prisma`, add after the `ResoSyncLog` model (around line 398):

```prisma
model AmpreSyncCheckpoint {
  syncType      String    @id   // 'idx_property' | 'dla_property' | 'vox_member' | 'vox_office'
  lastTimestamp DateTime?
  lastKey       String    @default("0")
  updatedAt     DateTime  @updatedAt

  @@map("ampre_sync_checkpoints")
}
```

- [ ] **Step 2: Add `ResoMember` model**

```prisma
model ResoMember {
  id                    String    @id @default(cuid())
  memberKey             String    @unique
  memberFullName        String?
  memberEmail           String?
  memberMobilePhone     String?
  memberStatus          String?
  officeKey             String?
  officeName            String?
  modificationTimestamp DateTime?
  photosChangeTimestamp DateTime?
  lastSyncedAt          DateTime
  rawJson               String?

  @@map("reso_members")
}
```

- [ ] **Step 3: Add `ResoOffice` model**

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

- [ ] **Step 4: Rename `ResoSyncLog.resourceType` → `syncType`**

In the `ResoSyncLog` model, change:
```prisma
  resourceType String   @default("Property")
```
to:
```prisma
  syncType     String   @default("idx_property")
```

- [ ] **Step 5: Add DLA-enriched fields to `ResoProperty`**

After `modificationTimestamp DateTime?` in `ResoProperty`, add:
```prisma
  mlsStatus                 String?
  contractStatus            String?
  photosChangeTimestamp     DateTime?
  documentsChangeTimestamp  DateTime?
  mediaChangeTimestamp      DateTime?
  listAgentFullName         String?
  majorChangeTimestamp      DateTime?
```

Note: `listOfficeName` and `listAgentName` already exist in `ResoProperty` — do not add them again.

- [ ] **Step 6: Run migration**

```bash
cd "C:/Users/miket/Documents/realestateweb"
npx prisma migrate dev --name ampre_compliance
```

Expected output: `The following migration(s) have been applied: .../ampre_compliance`

- [ ] **Step 7: Verify TypeScript compiles cleanly**

```bash
npx tsc --noEmit
```

Expected: no errors related to schema changes.

- [ ] **Step 8: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add AmpreSyncCheckpoint, ResoMember, ResoOffice; rename syncType; add DLA fields"
```

---

### Task 2: Update `services/reso/types.ts`

**Files:**
- Modify: `services/reso/types.ts`

- [ ] **Step 1: Rewrite `services/reso/types.ts`**

Replace the entire file with:

```typescript
export interface ResoPropertyRaw {
  ListingKey:            string
  ListingId?:            string
  StandardStatus:        string
  PropertyType?:         string
  PropertySubType?:      string
  ListPrice?:            number
  OriginalListPrice?:    number
  ClosePrice?:           number
  BedroomsTotal?:        number
  BathroomsTotalInteger?: number
  LivingArea?:           number
  LotSizeAcres?:         number
  YearBuilt?:            number
  StreetNumber?:         string
  StreetName?:           string
  UnitNumber?:           string
  City?:                 string
  StateOrProvince?:      string
  PostalCode?:           string
  Latitude?:             number
  Longitude?:            number
  PublicRemarks?:        string
  Media?:                { url: string; order: number }[]
  ListAgentKey?:         string
  ListAgentFullName?:    string
  ListOfficeKey?:        string
  ListOfficeName?:       string
  ListingContractDate?:  string
  ModificationTimestamp?: string
  // DLA-enriched fields
  MlsStatus?:                string
  ContractStatus?:           string
  PhotosChangeTimestamp?:    string
  DocumentsChangeTimestamp?: string
  MediaChangeTimestamp?:     string
  MajorChangeTimestamp?:     string
}

export interface ResoMemberRaw {
  MemberKey:             string
  MemberFullName?:       string
  MemberEmail?:          string
  MemberMobilePhone?:    string
  MemberStatus?:         string
  OfficeKey?:            string
  OfficeName?:           string
  ModificationTimestamp?:  string
  PhotosChangeTimestamp?:  string
}

export interface ResoOfficeRaw {
  OfficeKey:             string
  OfficeName?:           string
  OfficeEmail?:          string
  OfficePhone?:          string
  ModificationTimestamp?:  string
  PhotosChangeTimestamp?:  string
}

export interface AmpreODataResponse<T> {
  '@odata.context'?:  string
  '@odata.count'?:    number
  '@odata.nextLink'?: string
  value:              T[]
}

/** @deprecated Use AmpreODataResponse */
export type ResoODataResponse<T> = AmpreODataResponse<T>

export interface ResoSyncResult {
  added:      number
  updated:    number
  removed:    number
  errors:     string[]
  durationMs: number
}
```

- [ ] **Step 2: Verify TypeScript compiles cleanly**

```bash
npx tsc --noEmit
```

Expected: no new errors (existing code importing `ResoODataResponse` still works via the alias).

- [ ] **Step 3: Commit**

```bash
git add services/reso/types.ts
git commit -m "feat: update RESO types — AmpreODataResponse, full Member/Office raw types"
```

---

### Task 3: Mock Infrastructure — New Auth, Updated Routes, Seed Data

**Files:**
- Create: `lib/mock-ampre-auth.ts`
- Delete: `lib/mock-reso-auth.ts`
- Delete: `app/api/mock-reso/token/route.ts`
- Modify: `app/api/mock-reso/Property/route.ts`
- Modify: `app/api/mock-reso/Member/route.ts`
- Modify: `app/api/mock-reso/Office/route.ts`
- Modify: `data/mock-reso-seed.ts`

- [ ] **Step 1: Create `lib/mock-ampre-auth.ts`**

```typescript
/**
 * Mock auth for local development — validates Bearer token against the three
 * AMPRE env vars. No HMAC, no expiry. Not a security boundary.
 */
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

- [ ] **Step 2: Add `ModificationTimestamp`, phone, and status fields to mock seed data**

In `data/mock-reso-seed.ts`, replace the `MOCK_RESO_MEMBERS` and `MOCK_RESO_OFFICES` exports:

```typescript
export const MOCK_RESO_MEMBERS = [
  { MemberKey: 'AGT-001', MemberFullName: 'Sarah Mitchell', MemberEmail: 'sarah@royallepage.ca', MemberMobilePhone: '416-555-0101', MemberStatus: 'Active', OfficeKey: 'OFF-001', OfficeName: 'Royal LePage Urban Realty',      ModificationTimestamp: '2024-01-15T10:00:00Z', PhotosChangeTimestamp: '2024-01-15T10:00:00Z' },
  { MemberKey: 'AGT-002', MemberFullName: 'James Okafor',   MemberEmail: 'james@remax.ca',       MemberMobilePhone: '416-555-0102', MemberStatus: 'Active', OfficeKey: 'OFF-002', OfficeName: 'RE/MAX Hallmark Realty',         ModificationTimestamp: '2024-01-16T10:00:00Z', PhotosChangeTimestamp: '2024-01-16T10:00:00Z' },
  { MemberKey: 'AGT-003', MemberFullName: 'Priya Sharma',   MemberEmail: 'priya@sothebys.ca',    MemberMobilePhone: '416-555-0103', MemberStatus: 'Active', OfficeKey: 'OFF-003', OfficeName: "Sotheby's International Realty", ModificationTimestamp: '2024-01-17T10:00:00Z', PhotosChangeTimestamp: '2024-01-17T10:00:00Z' },
  { MemberKey: 'AGT-004', MemberFullName: 'Marcus Chen',    MemberEmail: 'marcus@kw.ca',         MemberMobilePhone: '416-555-0104', MemberStatus: 'Active', OfficeKey: 'OFF-004', OfficeName: 'Keller Williams Referred Urban', ModificationTimestamp: '2024-01-18T10:00:00Z', PhotosChangeTimestamp: '2024-01-18T10:00:00Z' },
  { MemberKey: 'AGT-005', MemberFullName: 'Linda Kowalski', MemberEmail: 'linda@c21.ca',         MemberMobilePhone: '416-555-0105', MemberStatus: 'Active', OfficeKey: 'OFF-005', OfficeName: 'Century 21 Leading Edge',        ModificationTimestamp: '2024-01-19T10:00:00Z', PhotosChangeTimestamp: '2024-01-19T10:00:00Z' },
]

export const MOCK_RESO_OFFICES = [
  { OfficeKey: 'OFF-001', OfficeName: 'Royal LePage Urban Realty',      OfficeEmail: 'info@royallepage.ca', OfficePhone: '416-555-1001', ModificationTimestamp: '2024-01-10T10:00:00Z', PhotosChangeTimestamp: '2024-01-10T10:00:00Z' },
  { OfficeKey: 'OFF-002', OfficeName: 'RE/MAX Hallmark Realty',         OfficeEmail: 'info@remax.ca',       OfficePhone: '416-555-1002', ModificationTimestamp: '2024-01-11T10:00:00Z', PhotosChangeTimestamp: '2024-01-11T10:00:00Z' },
  { OfficeKey: 'OFF-003', OfficeName: "Sotheby's International Realty", OfficeEmail: 'info@sothebys.ca',    OfficePhone: '416-555-1003', ModificationTimestamp: '2024-01-12T10:00:00Z', PhotosChangeTimestamp: '2024-01-12T10:00:00Z' },
  { OfficeKey: 'OFF-004', OfficeName: 'Keller Williams Referred Urban', OfficeEmail: 'info@kw.ca',          OfficePhone: '416-555-1004', ModificationTimestamp: '2024-01-13T10:00:00Z', PhotosChangeTimestamp: '2024-01-13T10:00:00Z' },
  { OfficeKey: 'OFF-005', OfficeName: 'Century 21 Leading Edge',        OfficeEmail: 'info@c21.ca',         OfficePhone: '416-555-1005', ModificationTimestamp: '2024-01-14T10:00:00Z', PhotosChangeTimestamp: '2024-01-14T10:00:00Z' },
]
```

- [ ] **Step 3: Update `app/api/mock-reso/Property/route.ts`**

Replace the file. Key changes: swap auth import; fix `applyOrderBy` to handle comma-separated multi-field sort:

```typescript
import { NextResponse } from 'next/server'
import { validateMockToken } from '@/lib/mock-ampre-auth'
import { parseODataFilter, applyFilter } from '@/lib/odata-filter'
import { MOCK_RESO_LISTINGS } from '@/data/mock-reso-seed'

function applySelect(item: Record<string, unknown>, select: string): Record<string, unknown> {
  const fields = select.split(',').map(s => s.trim())
  return Object.fromEntries(fields.filter(f => f in item).map(f => [f, item[f]]))
}

function applyOrderBy(items: typeof MOCK_RESO_LISTINGS, orderby: string): typeof MOCK_RESO_LISTINGS {
  // Support comma-separated multi-field sort: "ModificationTimestamp,ListingKey"
  // Each field may optionally be followed by " asc" or " desc"
  const fields = orderby.split(',').map(s => {
    const parts = s.trim().split(/\s+/)
    return { field: parts[0], desc: parts[1]?.toLowerCase() === 'desc' }
  })
  return [...items].sort((a, b) => {
    for (const { field, desc } of fields) {
      const av = (a as unknown as Record<string, unknown>)[field]
      const bv = (b as unknown as Record<string, unknown>)[field]
      if (av == null && bv == null) continue
      if (av == null) return 1
      if (bv == null) return -1
      const cmp = av < bv ? -1 : av > bv ? 1 : 0
      if (cmp !== 0) return desc ? -cmp : cmp
    }
    return 0
  })
}

export async function GET(request: Request) {
  if (!validateMockToken(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const filter  = searchParams.get('$filter')  ?? ''
  const select  = searchParams.get('$select')  ?? ''
  const top     = Math.min(500, parseInt(searchParams.get('$top')  ?? '20', 10))
  const skip    = parseInt(searchParams.get('$skip') ?? '0', 10)
  const orderby = searchParams.get('$orderby') ?? ''

  const clauses = parseODataFilter(filter)
  let data: typeof MOCK_RESO_LISTINGS = applyFilter(MOCK_RESO_LISTINGS as unknown as Record<string, unknown>[], clauses) as unknown as typeof MOCK_RESO_LISTINGS

  if (orderby) data = applyOrderBy(data, orderby)

  const count = data.length
  const page  = data.slice(skip, skip + top)

  const value = select
    ? page.map(item => applySelect(item as unknown as Record<string, unknown>, select))
    : page

  return NextResponse.json({
    '@odata.context': `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/api/mock-reso/$metadata#Property`,
    '@odata.count':   count,
    value,
  })
}
```

- [ ] **Step 4: Update `app/api/mock-reso/Member/route.ts`**

Replace with full query support:

```typescript
import { NextResponse } from 'next/server'
import { validateMockToken } from '@/lib/mock-ampre-auth'
import { parseODataFilter, applyFilter } from '@/lib/odata-filter'
import { MOCK_RESO_MEMBERS } from '@/data/mock-reso-seed'

function applySelect(item: Record<string, unknown>, select: string): Record<string, unknown> {
  const fields = select.split(',').map(s => s.trim())
  return Object.fromEntries(fields.filter(f => f in item).map(f => [f, item[f]]))
}

function applyOrderBy(items: typeof MOCK_RESO_MEMBERS, orderby: string): typeof MOCK_RESO_MEMBERS {
  const fields = orderby.split(',').map(s => {
    const parts = s.trim().split(/\s+/)
    return { field: parts[0], desc: parts[1]?.toLowerCase() === 'desc' }
  })
  return [...items].sort((a, b) => {
    for (const { field, desc } of fields) {
      const av = (a as unknown as Record<string, unknown>)[field]
      const bv = (b as unknown as Record<string, unknown>)[field]
      if (av == null && bv == null) continue
      if (av == null) return 1
      if (bv == null) return -1
      const cmp = av < bv ? -1 : av > bv ? 1 : 0
      if (cmp !== 0) return desc ? -cmp : cmp
    }
    return 0
  })
}

export async function GET(request: Request) {
  if (!validateMockToken(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const filter  = searchParams.get('$filter')  ?? ''
  const select  = searchParams.get('$select')  ?? ''
  const top     = Math.min(500, parseInt(searchParams.get('$top') ?? '500', 10))
  const orderby = searchParams.get('$orderby') ?? ''

  const clauses = parseODataFilter(filter)
  let data: typeof MOCK_RESO_MEMBERS = applyFilter(MOCK_RESO_MEMBERS as unknown as Record<string, unknown>[], clauses) as unknown as typeof MOCK_RESO_MEMBERS

  if (orderby) data = applyOrderBy(data, orderby)

  const page  = data.slice(0, top)
  const value = select
    ? page.map(item => applySelect(item as unknown as Record<string, unknown>, select))
    : page

  return NextResponse.json({
    '@odata.context': `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/api/mock-reso/$metadata#Member`,
    '@odata.count':   data.length,
    value,
  })
}
```

- [ ] **Step 5: Update `app/api/mock-reso/Office/route.ts`**

Replace with full query support (same pattern as Member):

```typescript
import { NextResponse } from 'next/server'
import { validateMockToken } from '@/lib/mock-ampre-auth'
import { parseODataFilter, applyFilter } from '@/lib/odata-filter'
import { MOCK_RESO_OFFICES } from '@/data/mock-reso-seed'

function applySelect(item: Record<string, unknown>, select: string): Record<string, unknown> {
  const fields = select.split(',').map(s => s.trim())
  return Object.fromEntries(fields.filter(f => f in item).map(f => [f, item[f]]))
}

function applyOrderBy(items: typeof MOCK_RESO_OFFICES, orderby: string): typeof MOCK_RESO_OFFICES {
  const fields = orderby.split(',').map(s => {
    const parts = s.trim().split(/\s+/)
    return { field: parts[0], desc: parts[1]?.toLowerCase() === 'desc' }
  })
  return [...items].sort((a, b) => {
    for (const { field, desc } of fields) {
      const av = (a as unknown as Record<string, unknown>)[field]
      const bv = (b as unknown as Record<string, unknown>)[field]
      if (av == null && bv == null) continue
      if (av == null) return 1
      if (bv == null) return -1
      const cmp = av < bv ? -1 : av > bv ? 1 : 0
      if (cmp !== 0) return desc ? -cmp : cmp
    }
    return 0
  })
}

export async function GET(request: Request) {
  if (!validateMockToken(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const filter  = searchParams.get('$filter')  ?? ''
  const select  = searchParams.get('$select')  ?? ''
  const top     = Math.min(500, parseInt(searchParams.get('$top') ?? '500', 10))
  const orderby = searchParams.get('$orderby') ?? ''

  const clauses = parseODataFilter(filter)
  let data: typeof MOCK_RESO_OFFICES = applyFilter(MOCK_RESO_OFFICES as unknown as Record<string, unknown>[], clauses) as unknown as typeof MOCK_RESO_OFFICES

  if (orderby) data = applyOrderBy(data, orderby)

  const page  = data.slice(0, top)
  const value = select
    ? page.map(item => applySelect(item as unknown as Record<string, unknown>, select))
    : page

  return NextResponse.json({
    '@odata.context': `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/api/mock-reso/$metadata#Office`,
    '@odata.count':   data.length,
    value,
  })
}
```

- [ ] **Step 6: Delete the old auth file and token route**

```bash
git rm lib/mock-reso-auth.ts app/api/mock-reso/token/route.ts
```

- [ ] **Step 7: Verify TypeScript compiles cleanly**

```bash
npx tsc --noEmit
```

Expected: no errors. (Any remaining import of `mock-reso-auth` would be an error — confirm none remain with `grep -r "mock-reso-auth" --include="*.ts" src/ app/ lib/ services/`.)

- [ ] **Step 8: Manual smoke test — mock auth**

Start the dev server (`npm run dev`), then:

```bash
# Should return 401
curl -s http://localhost:3000/api/mock-reso/Member | jq .error

# Should return member list
curl -s -H "Authorization: Bearer mock-vox-token" \
  "http://localhost:3000/api/mock-reso/Member" | jq '."@odata.count"'

# Should return 401 (wrong token)
curl -s -H "Authorization: Bearer wrong-token" \
  "http://localhost:3000/api/mock-reso/Member" | jq .error
```

- [ ] **Step 9: Commit**

```bash
git add lib/mock-ampre-auth.ts data/mock-reso-seed.ts \
  app/api/mock-reso/Property/route.ts \
  app/api/mock-reso/Member/route.ts \
  app/api/mock-reso/Office/route.ts
git commit -m "feat: replace mock OAuth2 with Bearer-only auth; add Member/Office query support"
```

---

## Chunk 2: Core Services — Client and Sync Rewrite

### Task 4: Rewrite `services/reso/client.ts`

**Files:**
- Rewrite: `services/reso/client.ts`

- [ ] **Step 1: Rewrite the client**

Replace the entire file:

```typescript
import type { AmpreODataResponse } from './types'

export type TokenType = 'idx' | 'dla' | 'vox'

export type ODataParams = {
  $filter?:  string
  $select?:  string
  $top?:     number
  $orderby?: string
}

const BASE_URL = process.env.AMPRE_API_BASE_URL ?? 'https://query.ampre.ca/odata'

function getToken(tokenType: TokenType): string {
  switch (tokenType) {
    case 'idx': return process.env.AMPRE_IDX_TOKEN ?? 'mock-idx-token'
    case 'dla': return process.env.AMPRE_DLA_TOKEN ?? 'mock-dla-token'
    case 'vox': return process.env.AMPRE_VOX_TOKEN ?? 'mock-vox-token'
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function fetchOData<T>(
  tokenType: TokenType,
  resource: string,
  params: ODataParams
): Promise<Response> {
  const qs = new URLSearchParams()
  if (params.$filter)       qs.set('$filter',  params.$filter)
  if (params.$select)       qs.set('$select',  params.$select)
  if (params.$top  != null) qs.set('$top',     String(params.$top))
  if (params.$orderby)      qs.set('$orderby', params.$orderby)

  const url = `${BASE_URL}/${resource}?${qs}`
  return fetch(url, {
    headers: { Authorization: `Bearer ${getToken(tokenType)}` },
    next:    { revalidate: 0 },
  })
}

/**
 * Fetch a single page from the Amplify OData API.
 *
 * Rate limit (429): reads X-Rate-Limit-Retry-After-Seconds, waits, retries once.
 * If still 429 on retry, throws — callers should write a failed log and return early.
 */
export async function ampreGet<T>(
  tokenType: TokenType,
  resource:  string,
  params:    ODataParams
): Promise<AmpreODataResponse<T>> {
  let res = await fetchOData<T>(tokenType, resource, params)

  if (res.status === 429) {
    const retryAfter = parseInt(res.headers.get('X-Rate-Limit-Retry-After-Seconds') ?? '60', 10)
    await sleep(retryAfter * 1000)
    res = await fetchOData<T>(tokenType, resource, params)
    if (res.status === 429) {
      throw new Error(`AMPRE rate limited on ${resource} — retry after ${retryAfter}s`)
    }
  }

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`AMPRE API error: ${res.status} ${resource} — ${text}`)
  }

  return res.json() as Promise<AmpreODataResponse<T>>
}
```

- [ ] **Step 2: Verify TypeScript compiles cleanly**

```bash
npx tsc --noEmit
```

Expected: no errors. `sync.ts` will have errors because it still imports `resoGetAll` — those will be fixed in Task 5.

- [ ] **Step 3: Commit**

```bash
git add services/reso/client.ts
git commit -m "feat: rewrite AMPRE client — static Bearer tokens, rate-limit retry, no OAuth2"
```

---

### Task 5: Rewrite `services/reso/sync.ts`

**Files:**
- Rewrite: `services/reso/sync.ts`

This is the largest task. The sync uses a timestamp+key cursor loop. Read the spec at `docs/superpowers/specs/2026-03-23-ampre-compliance-design.md` for the full algorithm before writing.

- [ ] **Step 1: Write the cursor helper and IDX property sync**

Replace the entire file with the following. Write it in stages — first the helper and IDX sync, then add the other three sync types.

```typescript
import { prisma } from '@/lib/prisma'
import { ampreGet } from './client'
import type { ResoPropertyRaw, ResoMemberRaw, ResoOfficeRaw, ResoSyncResult } from './types'

const BATCH_SIZE = 500
const EPOCH      = new Date('1970-01-01T00:00:00Z')

// ─── Checkpoint helpers ────────────────────────────────────────────────────

async function loadCheckpoint(syncType: string): Promise<{ lastTimestamp: Date; lastKey: string }> {
  const cp = await prisma.ampreSyncCheckpoint.findUnique({ where: { syncType } })
  return {
    lastTimestamp: cp?.lastTimestamp ?? EPOCH,
    lastKey:       cp?.lastKey       ?? '0',
  }
}

async function saveCheckpoint(syncType: string, lastTimestamp: Date, lastKey: string): Promise<void> {
  await prisma.ampreSyncCheckpoint.upsert({
    where:  { syncType },
    update: { lastTimestamp, lastKey },
    create: { syncType, lastTimestamp, lastKey },
  })
}

// ─── Cursor filter builder ─────────────────────────────────────────────────

function cursorFilter(tsField: string, keyField: string, lastTs: Date, lastKey: string): string {
  const ts = lastTs.toISOString()
  return `${tsField} gt ${ts} or (${tsField} eq ${ts} and ${keyField} gt '${lastKey}')`
}

// ─── IDX Property Sync ─────────────────────────────────────────────────────

const IDX_SELECT = [
  'ListingKey', 'ListingId', 'StandardStatus', 'PropertyType', 'PropertySubType',
  'ListPrice', 'OriginalListPrice', 'ClosePrice', 'BedroomsTotal', 'BathroomsTotalInteger',
  'LivingArea', 'LotSizeAcres', 'YearBuilt', 'StreetNumber', 'StreetName', 'UnitNumber',
  'City', 'StateOrProvince', 'PostalCode', 'Latitude', 'Longitude', 'PublicRemarks',
  'Media', 'ListAgentKey', 'ListAgentFullName', 'ListOfficeKey', 'ListOfficeName',
  'ListingContractDate', 'ModificationTimestamp',
].join(',')

export async function syncIdxProperty(): Promise<ResoSyncResult> {
  const start  = Date.now()
  const result: ResoSyncResult = { added: 0, updated: 0, removed: 0, errors: [], durationMs: 0 }
  const syncType = 'idx_property'

  let { lastTimestamp, lastKey } = await loadCheckpoint(syncType)
  let fullRun = false

  try {
    while (true) {
      const batch = await ampreGet<ResoPropertyRaw>('idx', 'Property', {
        $filter:  cursorFilter('ModificationTimestamp', 'ListingKey', lastTimestamp, lastKey),
        $orderby: 'ModificationTimestamp,ListingKey',
        $top:     BATCH_SIZE,
        $select:  IDX_SELECT,
      })

      const records = batch.value.filter(r => {
        if (!r.ModificationTimestamp) {
          console.warn(`[idx_property] Skipping ${r.ListingKey} — null ModificationTimestamp`)
          return false
        }
        return true
      })

      for (const r of records) {
        try {
          const data = {
            listingId:             r.ListingId             ?? null,
            standardStatus:        r.StandardStatus,
            propertyType:          r.PropertyType          ?? null,
            propertySubType:       r.PropertySubType       ?? null,
            listPrice:             r.ListPrice             ?? null,
            originalListPrice:     r.OriginalListPrice     ?? null,
            closePrice:            r.ClosePrice            ?? null,
            bedroomsTotal:         r.BedroomsTotal         ?? null,
            bathroomsTotalInteger: r.BathroomsTotalInteger ?? null,
            livingArea:            r.LivingArea            ?? null,
            lotSizeSquareFeet:     r.LotSizeAcres          ?? null,
            yearBuilt:             r.YearBuilt             ?? null,
            streetNumber:          r.StreetNumber          ?? null,
            streetName:            r.StreetName            ?? null,
            unitNumber:            r.UnitNumber            ?? null,
            city:                  r.City                  ?? '',
            stateOrProvince:       r.StateOrProvince       ?? '',
            postalCode:            r.PostalCode            ?? null,
            latitude:              r.Latitude              ?? null,
            longitude:             r.Longitude             ?? null,
            publicRemarks:         r.PublicRemarks         ?? null,
            media:                 r.Media ? JSON.stringify(r.Media) : null,
            listAgentKey:          r.ListAgentKey          ?? null,
            listAgentName:         r.ListAgentFullName     ?? null,
            listOfficeKey:         r.ListOfficeKey         ?? null,
            listOfficeName:        r.ListOfficeName        ?? null,
            listingContractDate:   r.ListingContractDate ? new Date(r.ListingContractDate) : null,
            modificationTimestamp: new Date(r.ModificationTimestamp!),
            lastSyncedAt:          new Date(),
            rawJson:               JSON.stringify(r),
          }

          const existing = await prisma.resoProperty.findUnique({ where: { listingKey: r.ListingKey }, select: { id: true } })
          await prisma.resoProperty.upsert({
            where:  { listingKey: r.ListingKey },
            update: data,
            create: { ...data, listingKey: r.ListingKey },
          })
          if (existing) { result.updated++ } else { result.added++ }
        } catch (e) {
          result.errors.push(`${r.ListingKey}: ${e instanceof Error ? e.message : String(e)}`)
        }
      }

      if (records.length > 0) {
        const last = records[records.length - 1]
        lastTimestamp = new Date(last.ModificationTimestamp!)
        lastKey       = last.ListingKey
        await saveCheckpoint(syncType, lastTimestamp, lastKey)
      }

      if (batch.value.length < BATCH_SIZE) {
        fullRun = true
        break
      }
    }

    // Mark active listings absent from this full run as Closed
    // Only fires on full completion — not on interrupted/rate-limited runs
    if (fullRun) {
      const cutoff = new Date(Date.now() - 60_000) // listings not synced in last 60s
      const stale = await prisma.resoProperty.findMany({
        where:  { standardStatus: 'Active', lastSyncedAt: { lt: cutoff } },
        select: { listingKey: true },
      })
      if (stale.length > 0) {
        await prisma.resoProperty.updateMany({
          where: { listingKey: { in: stale.map(p => p.listingKey) } },
          data:  { standardStatus: 'Closed' },
        })
        result.removed = stale.length
      }
    }
  } catch (e) {
    result.errors.push(`Sync failed: ${e instanceof Error ? e.message : String(e)}`)
  }

  result.durationMs = Date.now() - start
  await prisma.resoSyncLog.create({
    data: {
      syncType,
      added:      result.added,
      updated:    result.updated,
      deleted:    result.removed,
      errors:     result.errors.length,
      notes:      result.errors.length ? result.errors.join('\n') : null,
      durationMs: result.durationMs,
    },
  })

  return result
}

// ─── DLA Property Sync ─────────────────────────────────────────────────────

const DLA_SELECT = [
  'ListingKey', 'ModificationTimestamp',
  'MlsStatus', 'ContractStatus',
  'PhotosChangeTimestamp', 'DocumentsChangeTimestamp', 'MediaChangeTimestamp',
  'ListAgentFullName', 'ListOfficeName', 'MajorChangeTimestamp',
].join(',')

export async function syncDlaProperty(): Promise<ResoSyncResult> {
  const start  = Date.now()
  const result: ResoSyncResult = { added: 0, updated: 0, removed: 0, errors: [], durationMs: 0 }
  const syncType = 'dla_property'

  let { lastTimestamp, lastKey } = await loadCheckpoint(syncType)

  try {
    while (true) {
      const batch = await ampreGet<ResoPropertyRaw>('dla', 'Property', {
        $filter:  cursorFilter('ModificationTimestamp', 'ListingKey', lastTimestamp, lastKey),
        $orderby: 'ModificationTimestamp,ListingKey',
        $top:     BATCH_SIZE,
        $select:  DLA_SELECT,
      })

      const records = batch.value.filter(r => {
        if (!r.ModificationTimestamp) {
          console.warn(`[dla_property] Skipping ${r.ListingKey} — null ModificationTimestamp`)
          return false
        }
        return true
      })

      for (const r of records) {
        try {
          // DLA only writes its enriched fields — never touches IDX-owned fields
          await prisma.resoProperty.upsert({
            where:  { listingKey: r.ListingKey },
            update: {
              mlsStatus:                r.MlsStatus                ? r.MlsStatus                : undefined,
              contractStatus:           r.ContractStatus           ? r.ContractStatus           : undefined,
              photosChangeTimestamp:    r.PhotosChangeTimestamp    ? new Date(r.PhotosChangeTimestamp)    : undefined,
              documentsChangeTimestamp: r.DocumentsChangeTimestamp ? new Date(r.DocumentsChangeTimestamp) : undefined,
              mediaChangeTimestamp:     r.MediaChangeTimestamp     ? new Date(r.MediaChangeTimestamp)     : undefined,
              listAgentFullName:        r.ListAgentFullName        ? r.ListAgentFullName        : undefined,
              listOfficeName:           r.ListOfficeName           ? r.ListOfficeName           : undefined,
              majorChangeTimestamp:     r.MajorChangeTimestamp     ? new Date(r.MajorChangeTimestamp)     : undefined,
              lastSyncedAt:             new Date(),
            },
            create: {
              listingKey:               r.ListingKey,
              city:                     '',
              stateOrProvince:          '',
              standardStatus:           'Active',
              mlsStatus:                r.MlsStatus                ?? null,
              contractStatus:           r.ContractStatus           ?? null,
              photosChangeTimestamp:    r.PhotosChangeTimestamp    ? new Date(r.PhotosChangeTimestamp)    : null,
              documentsChangeTimestamp: r.DocumentsChangeTimestamp ? new Date(r.DocumentsChangeTimestamp) : null,
              mediaChangeTimestamp:     r.MediaChangeTimestamp     ? new Date(r.MediaChangeTimestamp)     : null,
              listAgentFullName:        r.ListAgentFullName        ?? null,
              listOfficeName:           r.ListOfficeName           ?? null,
              majorChangeTimestamp:     r.MajorChangeTimestamp     ? new Date(r.MajorChangeTimestamp)     : null,
              lastSyncedAt:             new Date(),
            },
          })
          result.updated++
        } catch (e) {
          result.errors.push(`${r.ListingKey}: ${e instanceof Error ? e.message : String(e)}`)
        }
      }

      if (records.length > 0) {
        const last = records[records.length - 1]
        lastTimestamp = new Date(last.ModificationTimestamp!)
        lastKey       = last.ListingKey
        await saveCheckpoint(syncType, lastTimestamp, lastKey)
      }

      if (batch.value.length < BATCH_SIZE) break
    }
  } catch (e) {
    result.errors.push(`Sync failed: ${e instanceof Error ? e.message : String(e)}`)
  }

  result.durationMs = Date.now() - start
  await prisma.resoSyncLog.create({
    data: {
      syncType,
      added:      result.added,
      updated:    result.updated,
      deleted:    result.removed,
      errors:     result.errors.length,
      notes:      result.errors.length ? result.errors.join('\n') : null,
      durationMs: result.durationMs,
    },
  })

  return result
}

// ─── VOX Member Sync ───────────────────────────────────────────────────────

const VOX_MEMBER_SELECT = [
  'MemberKey', 'MemberFullName', 'MemberEmail', 'MemberMobilePhone',
  'MemberStatus', 'OfficeKey', 'OfficeName', 'ModificationTimestamp',
].join(',')

export async function syncVoxMember(): Promise<ResoSyncResult> {
  const start  = Date.now()
  const result: ResoSyncResult = { added: 0, updated: 0, removed: 0, errors: [], durationMs: 0 }
  const syncType = 'vox_member'

  let { lastTimestamp, lastKey } = await loadCheckpoint(syncType)

  try {
    while (true) {
      const batch = await ampreGet<ResoMemberRaw>('vox', 'Member', {
        $filter:  cursorFilter('ModificationTimestamp', 'MemberKey', lastTimestamp, lastKey),
        $orderby: 'ModificationTimestamp,MemberKey',
        $top:     BATCH_SIZE,
        $select:  VOX_MEMBER_SELECT,
      })

      const records = batch.value.filter(r => {
        if (!r.ModificationTimestamp) {
          console.warn(`[vox_member] Skipping ${r.MemberKey} — null ModificationTimestamp`)
          return false
        }
        return true
      })

      for (const r of records) {
        try {
          const data = {
            memberFullName:        r.MemberFullName        ?? null,
            memberEmail:           r.MemberEmail           ?? null,
            memberMobilePhone:     r.MemberMobilePhone     ?? null,
            memberStatus:          r.MemberStatus          ?? null,
            officeKey:             r.OfficeKey             ?? null,
            officeName:            r.OfficeName            ?? null,
            modificationTimestamp: new Date(r.ModificationTimestamp!),
            lastSyncedAt:          new Date(),
            rawJson:               JSON.stringify(r),
          }
          const existing = await prisma.resoMember.findUnique({ where: { memberKey: r.MemberKey }, select: { id: true } })
          await prisma.resoMember.upsert({
            where:  { memberKey: r.MemberKey },
            update: data,
            create: { ...data, memberKey: r.MemberKey },
          })
          if (existing) { result.updated++ } else { result.added++ }
        } catch (e) {
          result.errors.push(`${r.MemberKey}: ${e instanceof Error ? e.message : String(e)}`)
        }
      }

      if (records.length > 0) {
        const last = records[records.length - 1]
        lastTimestamp = new Date(last.ModificationTimestamp!)
        lastKey       = last.MemberKey
        await saveCheckpoint(syncType, lastTimestamp, lastKey)
      }

      if (batch.value.length < BATCH_SIZE) break
    }
  } catch (e) {
    result.errors.push(`Sync failed: ${e instanceof Error ? e.message : String(e)}`)
  }

  result.durationMs = Date.now() - start
  await prisma.resoSyncLog.create({
    data: {
      syncType,
      added:      result.added,
      updated:    result.updated,
      deleted:    result.removed,
      errors:     result.errors.length,
      notes:      result.errors.length ? result.errors.join('\n') : null,
      durationMs: result.durationMs,
    },
  })

  return result
}

// ─── VOX Office Sync ───────────────────────────────────────────────────────

const VOX_OFFICE_SELECT = [
  'OfficeKey', 'OfficeName', 'OfficeEmail', 'OfficePhone', 'ModificationTimestamp',
].join(',')

export async function syncVoxOffice(): Promise<ResoSyncResult> {
  const start  = Date.now()
  const result: ResoSyncResult = { added: 0, updated: 0, removed: 0, errors: [], durationMs: 0 }
  const syncType = 'vox_office'

  let { lastTimestamp, lastKey } = await loadCheckpoint(syncType)

  try {
    while (true) {
      const batch = await ampreGet<ResoOfficeRaw>('vox', 'Office', {
        $filter:  cursorFilter('ModificationTimestamp', 'OfficeKey', lastTimestamp, lastKey),
        $orderby: 'ModificationTimestamp,OfficeKey',
        $top:     BATCH_SIZE,
        $select:  VOX_OFFICE_SELECT,
      })

      const records = batch.value.filter(r => {
        if (!r.ModificationTimestamp) {
          console.warn(`[vox_office] Skipping ${r.OfficeKey} — null ModificationTimestamp`)
          return false
        }
        return true
      })

      for (const r of records) {
        try {
          const data = {
            officeName:            r.OfficeName            ?? null,
            officeEmail:           r.OfficeEmail           ?? null,
            officePhone:           r.OfficePhone           ?? null,
            modificationTimestamp: new Date(r.ModificationTimestamp!),
            lastSyncedAt:          new Date(),
            rawJson:               JSON.stringify(r),
          }
          const existing = await prisma.resoOffice.findUnique({ where: { officeKey: r.OfficeKey }, select: { id: true } })
          await prisma.resoOffice.upsert({
            where:  { officeKey: r.OfficeKey },
            update: data,
            create: { ...data, officeKey: r.OfficeKey },
          })
          if (existing) { result.updated++ } else { result.added++ }
        } catch (e) {
          result.errors.push(`${r.OfficeKey}: ${e instanceof Error ? e.message : String(e)}`)
        }
      }

      if (records.length > 0) {
        const last = records[records.length - 1]
        lastTimestamp = new Date(last.ModificationTimestamp!)
        lastKey       = last.OfficeKey
        await saveCheckpoint(syncType, lastTimestamp, lastKey)
      }

      if (batch.value.length < BATCH_SIZE) break
    }
  } catch (e) {
    result.errors.push(`Sync failed: ${e instanceof Error ? e.message : String(e)}`)
  }

  result.durationMs = Date.now() - start
  await prisma.resoSyncLog.create({
    data: {
      syncType,
      added:      result.added,
      updated:    result.updated,
      deleted:    result.removed,
      errors:     result.errors.length,
      notes:      result.errors.length ? result.errors.join('\n') : null,
      durationMs: result.durationMs,
    },
  })

  return result
}

// ─── Legacy export (backward compat for existing route.ts) ────────────────

/** @deprecated Use the type-specific sync functions */
export async function syncResoListings(): Promise<ResoSyncResult> {
  return syncIdxProperty()
}
```

- [ ] **Step 2: Verify TypeScript compiles cleanly**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Manual end-to-end smoke test with mock**

Ensure dev server is running with `.env` containing:
```
AMPRE_IDX_TOKEN=mock-idx-token
AMPRE_DLA_TOKEN=mock-dla-token
AMPRE_VOX_TOKEN=mock-vox-token
AMPRE_API_BASE_URL=http://localhost:3000/api/mock-reso
```

Trigger IDX sync and check response:

```bash
# Trigger IDX sync (requires admin session or cron secret)
curl -s -X POST http://localhost:3000/api/reso/sync \
  -H "x-cron-secret: change-me-in-production" | jq .
```

Expected: `{ "success": true, "result": { "added": <N>, "updated": 0, "removed": 0, ... } }`

Verify checkpoint was saved:
```bash
# In prisma studio or sqlite directly:
# SELECT * FROM ampre_sync_checkpoints;
# Should show: { syncType: 'idx_property', lastTimestamp: ..., lastKey: ... }
```

- [ ] **Step 4: Commit**

```bash
git add services/reso/sync.ts
git commit -m "feat: rewrite sync — timestamp+key cursor, four sync types, checkpoint persistence"
```

---

## Chunk 3: API Route, Admin UI, and Cleanup

### Task 6: Update `app/api/reso/sync/route.ts`

**Files:**
- Modify: `app/api/reso/sync/route.ts`

- [ ] **Step 1: Rewrite the route**

```typescript
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { syncIdxProperty, syncDlaProperty, syncVoxMember, syncVoxOffice } from '@/services/reso/sync'
import { prisma } from '@/lib/prisma'
import { getMlsSyncInterval } from '@/lib/site-settings'

type SyncType = 'idx_property' | 'dla_property' | 'vox_member' | 'vox_office'

export async function POST(request: Request) {
  const cronSecret = request.headers.get('x-cron-secret')
  const isCron = cronSecret === process.env.RESO_SYNC_SECRET

  if (!isCron) {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Cron: skip if interval hasn't elapsed since last idx_property sync
  if (isCron) {
    const [lastSync, intervalMinutes] = await Promise.all([
      prisma.resoSyncLog.findFirst({
        where:   { syncType: 'idx_property' },
        orderBy: { syncedAt: 'desc' },
      }),
      getMlsSyncInterval(),
    ])
    if (lastSync) {
      const elapsedMs  = Date.now() - lastSync.syncedAt.getTime()
      const intervalMs = intervalMinutes * 60 * 1000
      if (elapsedMs < intervalMs) {
        return NextResponse.json({
          skipped: true,
          reason: 'Interval not elapsed',
          nextSyncInSeconds: Math.ceil((intervalMs - elapsedMs) / 1000),
        })
      }
    }
  }

  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type') ?? 'idx'

  try {
    if (type === 'dla') {
      const result = await syncDlaProperty()
      return NextResponse.json({ success: true, result })
    }

    if (type === 'vox') {
      const [memberResult, officeResult] = await Promise.all([syncVoxMember(), syncVoxOffice()])
      return NextResponse.json({ success: true, result: { member: memberResult, office: officeResult } })
    }

    if (type === 'all') {
      const idxResult    = await syncIdxProperty()
      const dlaResult    = await syncDlaProperty()
      const memberResult = await syncVoxMember()
      const officeResult = await syncVoxOffice()
      return NextResponse.json({ success: true, result: { idx: idxResult, dla: dlaResult, member: memberResult, office: officeResult } })
    }

    // Default: idx
    const result = await syncIdxProperty()
    return NextResponse.json({ success: true, result })
  } catch (error) {
    return NextResponse.json(
      { error: 'Sync failed', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const syncTypes: SyncType[] = ['idx_property', 'dla_property', 'vox_member', 'vox_office']

  const [logs, activeCount] = await Promise.all([
    Promise.all(
      syncTypes.map(syncType =>
        prisma.resoSyncLog.findFirst({
          where:   { syncType },
          orderBy: { syncedAt: 'desc' },
        })
      )
    ),
    prisma.resoProperty.count({ where: { standardStatus: 'Active' } }),
  ])

  const lastSync: Record<string, unknown> = {}
  for (let i = 0; i < syncTypes.length; i++) {
    const log = logs[i]
    lastSync[syncTypes[i]] = log
      ? { syncedAt: log.syncedAt, added: log.added, updated: log.updated, deleted: log.deleted, errors: log.errors }
      : null
  }

  return NextResponse.json({ lastSync, activeListings: activeCount })
}
```

- [ ] **Step 2: Verify TypeScript compiles cleanly**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add app/api/reso/sync/route.ts
git commit -m "feat: add ?type=idx|dla|vox|all to sync route; per-syncType GET response"
```

---

### Task 7: Admin Settings Page + MlsSyncSettingsCard

**Files:**
- Modify: `app/admin/settings/page.tsx`
- Modify: `components/admin/MlsSyncSettingsCard.tsx`

- [ ] **Step 1: Update `app/admin/settings/page.tsx`**

In the `Promise.all` array, replace the single `prisma.resoSyncLog.findFirst(...)` call with a query for all four sync types:

```typescript
// Replace:
prisma.resoSyncLog.findFirst({ orderBy: { syncedAt: 'desc' } }),

// With:
Promise.all([
  prisma.resoSyncLog.findFirst({ where: { syncType: 'idx_property' }, orderBy: { syncedAt: 'desc' } }),
  prisma.resoSyncLog.findFirst({ where: { syncType: 'dla_property' }, orderBy: { syncedAt: 'desc' } }),
  prisma.resoSyncLog.findFirst({ where: { syncType: 'vox_member'   }, orderBy: { syncedAt: 'desc' } }),
  prisma.resoSyncLog.findFirst({ where: { syncType: 'vox_office'   }, orderBy: { syncedAt: 'desc' } }),
]),
```

Update the destructured variable name from `lastSync` to `syncLogs` and the type annotation in `Promise.all`:

```typescript
const [syncLogs, apiKeyCount, commandLogCount, queueStats, tfaUser, gateSettingsRows, activeListings, mlsSyncIntervalRow] = await Promise.all([
  Promise.all([
    prisma.resoSyncLog.findFirst({ where: { syncType: 'idx_property' }, orderBy: { syncedAt: 'desc' } }),
    prisma.resoSyncLog.findFirst({ where: { syncType: 'dla_property' }, orderBy: { syncedAt: 'desc' } }),
    prisma.resoSyncLog.findFirst({ where: { syncType: 'vox_member'   }, orderBy: { syncedAt: 'desc' } }),
    prisma.resoSyncLog.findFirst({ where: { syncType: 'vox_office'   }, orderBy: { syncedAt: 'desc' } }),
  ]),
  prisma.apiKey.count({ where: { userId: session.id } }),
  prisma.aiCommandLog.count(),
  prisma.jobQueue.groupBy({ by: ['status'], _count: { id: true } }),
  prisma.user.findUnique({ where: { id: session.id }, select: { totpEnabled: true } }),
  prisma.siteSettings.findMany({ where: { key: { in: ['listing_gate_limit', 'listing_gate_enabled'] } } }),
  prisma.resoProperty.count({ where: { standardStatus: 'Active' } }),
  prisma.siteSettings.findUnique({ where: { key: 'mls_sync_interval_minutes' } }),
])
```

Then `const [idxSync, dlaSync, voxMemberSync, voxOfficeSync] = syncLogs`

And replace the `<MlsSyncSettingsCard .../>` section:

```tsx
function toSyncInfo(log: typeof idxSync) {
  return log ? {
    syncedAt: log.syncedAt.toISOString(),
    added:    log.added,
    updated:  log.updated,
    deleted:  log.deleted,
  } : null
}
```

Actually, define the helper inline as a local function above the return statement, then:

```tsx
<MlsSyncSettingsCard
  initialIntervalMinutes={mlsSyncInterval}
  activeListings={activeListings}
  idxSync={toSyncInfo(idxSync)}
  dlaSync={toSyncInfo(dlaSync)}
  voxMemberSync={toSyncInfo(voxMemberSync)}
  voxOfficeSync={toSyncInfo(voxOfficeSync)}
/>
```

- [ ] **Step 2: Update `components/admin/MlsSyncSettingsCard.tsx`**

Replace the Props interface and the card rendering:

```typescript
type SyncInfo = { syncedAt: string; added: number; updated: number; deleted: number } | null

interface Props {
  initialIntervalMinutes: number
  activeListings:         number
  idxSync:                SyncInfo
  dlaSync:                SyncInfo
  voxMemberSync:          SyncInfo
  voxOfficeSync:          SyncInfo
}

export function MlsSyncSettingsCard({ initialIntervalMinutes, activeListings, idxSync, dlaSync, voxMemberSync, voxOfficeSync }: Props) {
```

Update the status section to show four rows:

```tsx
{/* Status row */}
<div className="rounded-lg bg-charcoal-50 px-4 py-3 text-sm flex flex-col gap-1">
  <div className="flex justify-between">
    <span className="text-charcoal-500">Active listings</span>
    <span className="font-medium text-charcoal-900">{activeListings.toLocaleString()}</span>
  </div>
  {([
    { label: 'IDX last sync',    sync: idxSync       },
    { label: 'DLA last sync',    sync: dlaSync       },
    { label: 'VOX members',      sync: voxMemberSync },
    { label: 'VOX offices',      sync: voxOfficeSync },
  ] as const).map(({ label, sync }) => (
    <div key={label} className="flex justify-between">
      <span className="text-charcoal-500">{label}</span>
      <span className="font-medium text-charcoal-900">
        {sync
          ? `${new Date(sync.syncedAt).toLocaleString()} — ${sync.added} added, ${sync.updated} updated`
          : 'Never'}
      </span>
    </div>
  ))}
</div>
```

Update `handleSyncNow` to show a summary appropriate for IDX sync result:

```typescript
async function handleSyncNow() {
  setSyncing(true)
  setSyncMsg(null)
  try {
    const res  = await fetch('/api/reso/sync', { method: 'POST' })
    const data = await res.json()
    if (data.success) {
      const r = data.result
      setSyncMsg(`IDX sync complete — ${r.added} added, ${r.updated} updated, ${r.removed} removed`)
    } else {
      setSyncMsg(data.error ?? 'Sync failed')
    }
  } catch {
    setSyncMsg('Sync request failed')
  } finally {
    setSyncing(false)
  }
}
```

- [ ] **Step 3: Verify TypeScript compiles cleanly**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Manual smoke test**

Start dev server, navigate to `/admin/settings`. Confirm:
- The MLS Sync card shows four status rows (IDX, DLA, VOX members, VOX offices)
- All rows show "Never" on a fresh database
- Clicking "Sync Now" triggers the IDX sync and updates the IDX row

- [ ] **Step 5: Commit**

```bash
git add app/admin/settings/page.tsx components/admin/MlsSyncSettingsCard.tsx
git commit -m "feat: show per-syncType status in admin settings MLS card"
```

---

### Task 8: Environment Variables and Cleanup

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Update `.env.example`**

Replace the `# ─── RESO / PropTx ───` section with:

```
# ─── Amplify TREB/AMPRE ────────────────────────────────────────────────────────
# For local dev, mock Amplify API runs inside Next.js — no external service needed.
# Production: remove AMPRE_API_BASE_URL and set real tokens below.
AMPRE_IDX_TOKEN=mock-idx-token
AMPRE_DLA_TOKEN=mock-dla-token
AMPRE_VOX_TOKEN=mock-vox-token
# Local dev only — points to the mock. Omit in production.
AMPRE_API_BASE_URL=http://localhost:3000/api/mock-reso
# Cron authentication (unchanged)
RESO_SYNC_SECRET=change-me-in-production
```

Remove lines: `RESO_API_BASE_URL`, `RESO_CLIENT_ID`, `RESO_CLIENT_SECRET`, `RESO_TOKEN_SECRET`

- [ ] **Step 2: Confirm no remaining references to old env vars**

```bash
grep -r "RESO_CLIENT_ID\|RESO_CLIENT_SECRET\|RESO_TOKEN_SECRET\|RESO_API_BASE_URL" \
  --include="*.ts" --include="*.tsx" --include="*.js" \
  app/ lib/ services/ components/ 2>/dev/null
```

Expected: no output (zero matches).

- [ ] **Step 3: Final TypeScript compile check**

```bash
npx tsc --noEmit
```

Expected: clean compile.

- [ ] **Step 4: Full end-to-end test**

With dev server running, run all four sync types:

```bash
# IDX
curl -s -X POST "http://localhost:3000/api/reso/sync" \
  -H "x-cron-secret: change-me-in-production" | jq .result.added

# DLA
curl -s -X POST "http://localhost:3000/api/reso/sync?type=dla" \
  -H "x-cron-secret: change-me-in-production" | jq .result.updated

# VOX
curl -s -X POST "http://localhost:3000/api/reso/sync?type=vox" \
  -H "x-cron-secret: change-me-in-production" | jq .result

# All
curl -s -X POST "http://localhost:3000/api/reso/sync?type=all" \
  -H "x-cron-secret: change-me-in-production" | jq .result

# GET status
curl -s "http://localhost:3000/api/reso/sync" \
  -H "Cookie: <admin-session-cookie>" | jq .lastSync
```

Verify:
- IDX sync inserts mock listings (N added > 0)
- DLA sync enriches the same rows (updated > 0 on second run)
- VOX sync inserts 5 members and 5 offices
- GET returns per-syncType last sync info

- [ ] **Step 5: Commit**

```bash
git add .env.example
git commit -m "feat: replace RESO env vars with AMPRE vars in .env.example"
```

---

## Done

All four sync types are now compliant with the Amplify Syndication API spec:
- Static Bearer tokens (no OAuth2)
- Timestamp+key cursor replication (no `$top`/`$skip`)
- Checkpoint persistence per sync type
- Member and Office resources via VOX token
- DLA enrichment isolated to DLA-owned fields
