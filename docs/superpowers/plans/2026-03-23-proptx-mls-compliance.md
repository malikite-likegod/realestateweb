# PROPTX MLS® Compliance Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enforce full PROPTX MLS® compliance across display, AI safety, rate limiting, data lifecycle, and access control.

**Architecture:** Five independent sub-projects executed in sequence. Each sub-project produces working, testable changes on its own. No test framework is configured — TypeScript compilation (`npx tsc --noEmit`) serves as the primary correctness check after each task.

**Tech Stack:** Next.js 15, Prisma, TypeScript, lru-cache (already installed)

---

## Chunk 1: Display Compliance

### Task 1: Create MlsDisclaimer component

**Files:**
- Create `components/mls/MlsDisclaimer.tsx`

- [ ] Create the directory `components/mls/` if it does not exist
- [ ] Create `components/mls/MlsDisclaimer.tsx` with the following content:

```tsx
export function MlsDisclaimer({ variant }: { variant: 'idx' | 'vow' }) {
  const variantText = variant === 'idx'
    ? 'Displayed on an IDX-approved website.'
    : 'Displayed in a VOW-compliant authenticated area. Access restricted to genuine consumers.'

  return (
    <footer
      role="contentinfo"
      aria-label="MLS Data Disclaimer"
      className="mt-8 border-t border-charcoal-100 pt-4 text-xs text-charcoal-400 leading-relaxed"
    >
      <p>
        The trademarks MLS®, Multiple Listing Service® and the associated logos are owned by The Canadian
        Real Estate Association (CREA) and identify the quality of services provided by real estate
        professionals who are members of CREA. The trademarks REALTOR®, REALTORS®, and the REALTOR® logo
        are controlled by CREA and identify real estate professionals who are members of CREA. Data is
        deemed reliable but not guaranteed accurate by PROPTX.{' '}
        <span>{variantText}</span>
      </p>
    </footer>
  )
}
```

- [ ] Run TypeScript check: `cd C:/Users/miket/Documents/realestateweb && npx tsc --noEmit`
- [ ] Commit: `git add components/mls/MlsDisclaimer.tsx && git commit -m "feat(compliance): add MlsDisclaimer component with IDX and VOW variants"`

---

### Task 2: Create BrokerageAttribution component

**Files:**
- Create `components/mls/BrokerageAttribution.tsx`

- [ ] Create `components/mls/BrokerageAttribution.tsx` with the following content:

```tsx
export function BrokerageAttribution({
  listAgentFullName,
  listOfficeName,
}: {
  listAgentFullName?: string | null
  listOfficeName?: string | null
}) {
  if (!listAgentFullName && !listOfficeName) return null
  return (
    <p className="text-sm text-charcoal-500 mt-2">
      {listAgentFullName && <span>Listed by <strong className="text-charcoal-700">{listAgentFullName}</strong></span>}
      {listAgentFullName && listOfficeName && <span> · </span>}
      {listOfficeName && <span><strong className="text-charcoal-700">{listOfficeName}</strong></span>}
    </p>
  )
}
```

- [ ] Run TypeScript check: `cd C:/Users/miket/Documents/realestateweb && npx tsc --noEmit`
- [ ] Commit: `git add components/mls/BrokerageAttribution.tsx && git commit -m "feat(compliance): add BrokerageAttribution component"`

---

### Task 3: Public listing detail page — add disclaimer and brokerage

**Files:**
- Modify `app/(public)/listings/[id]/page.tsx`

- [ ] Read `app/(public)/listings/[id]/page.tsx` to locate the exact structure
- [ ] Add imports at the top of the file (after existing imports):

```tsx
import { MlsDisclaimer } from '@/components/mls/MlsDisclaimer'
import { BrokerageAttribution } from '@/components/mls/BrokerageAttribution'
```

- [ ] Locate the address block — specifically the `<p className="flex items-center gap-1.5...">` city line. Add `<BrokerageAttribution>` immediately after it:

```tsx
<BrokerageAttribution
  listAgentFullName={property.listAgentFullName}
  listOfficeName={property.listOfficeName}
/>
```

- [ ] Locate the inner wrapper `<div className={showGate || showPending ? ...}>`. Add `<MlsDisclaimer variant="idx" />` just before its closing `</div>`:

```tsx
<MlsDisclaimer variant="idx" />
```

- [ ] Run TypeScript check: `cd C:/Users/miket/Documents/realestateweb && npx tsc --noEmit`
- [ ] Commit: `git add "app/(public)/listings/[id]/page.tsx" && git commit -m "feat(compliance): add MLS disclaimer and brokerage attribution to public listing detail"`

---

### Task 4: Public listings browse page — add disclaimer

**Files:**
- Modify `app/(public)/listings/page.tsx`

- [ ] Read `app/(public)/listings/page.tsx` to locate the exact structure
- [ ] Add import at the top of the file (after existing imports):

```tsx
import { MlsDisclaimer } from '@/components/mls/MlsDisclaimer'
```

- [ ] Locate the outer `<div className="pt-20">` wrapper. Inside it, after the closing `</Container>` of `<Container className="py-8">` (the results container), add:

```tsx
<MlsDisclaimer variant="idx" />
```

- [ ] Run TypeScript check: `cd C:/Users/miket/Documents/realestateweb && npx tsc --noEmit`
- [ ] Commit: `git add "app/(public)/listings/page.tsx" && git commit -m "feat(compliance): add MLS disclaimer to public listings browse page"`

---

### Task 5: Portal pages — add disclaimer and brokerage

**Files:**
- Modify `app/portal/listings/[id]/page.tsx`
- Modify `app/portal/page.tsx`

- [ ] Read `app/portal/listings/[id]/page.tsx` to locate the exact structure
- [ ] Add imports at the top of `app/portal/listings/[id]/page.tsx`:

```tsx
import { MlsDisclaimer } from '@/components/mls/MlsDisclaimer'
import { BrokerageAttribution } from '@/components/mls/BrokerageAttribution'
```

- [ ] In the listing detail section of `app/portal/listings/[id]/page.tsx`, add `<BrokerageAttribution>` after the title/address `<p>` tag:

```tsx
<BrokerageAttribution
  listAgentFullName={property.listAgentFullName}
  listOfficeName={property.listOfficeName}
/>
```

- [ ] Add `<MlsDisclaimer variant="vow" />` before the closing `</main>` in `app/portal/listings/[id]/page.tsx`:

```tsx
<MlsDisclaimer variant="vow" />
```

- [ ] Read `app/portal/page.tsx` to locate the exact structure
- [ ] Add import at the top of `app/portal/page.tsx`:

```tsx
import { MlsDisclaimer } from '@/components/mls/MlsDisclaimer'
```

- [ ] Add `<MlsDisclaimer variant="vow" />` before the closing `</main>` in `app/portal/page.tsx`:

```tsx
<MlsDisclaimer variant="vow" />
```

- [ ] Run TypeScript check: `cd C:/Users/miket/Documents/realestateweb && npx tsc --noEmit`
- [ ] Commit: `git add app/portal/listings/[id]/page.tsx app/portal/page.tsx && git commit -m "feat(compliance): add MLS disclaimer and brokerage attribution to portal pages"`

---

### Task 6: Enforce result cap in API routes

**Files:**
- Modify `app/api/search/route.ts`
- Modify `app/api/portal/listings/route.ts`

- [ ] Read `app/api/search/route.ts` to locate the `pageSize` assignment
- [ ] In `app/api/search/route.ts`, change the `pageSize` line from:

```typescript
pageSize: searchParams.get('pageSize') ? Number(searchParams.get('pageSize')) : 12,
```

to:

```typescript
pageSize: Math.min(searchParams.get('pageSize') ? Number(searchParams.get('pageSize')) : 12, 100),
```

- [ ] Read `app/api/portal/listings/route.ts` to locate the `prisma.listing.findMany` call
- [ ] In `app/api/portal/listings/route.ts`, add `take: 100` to the `prisma.listing.findMany` call options so the query is capped at 100 results. For example:

```typescript
const listings = await prisma.listing.findMany({
  // ... existing options ...
  take: 100,
})
```

- [ ] Run TypeScript check: `cd C:/Users/miket/Documents/realestateweb && npx tsc --noEmit`
- [ ] Commit: `git add app/api/search/route.ts app/api/portal/listings/route.ts && git commit -m "feat(compliance): enforce 100-result server-side cap on search and portal listing APIs"`

---

## Chunk 2: AI Safety

### Task 7: Create lib/mls-guard.ts

**Files:**
- Create `lib/mls-guard.ts`

- [ ] Create `lib/mls-guard.ts` with the following content:

```typescript
import { prisma } from './prisma'

export async function isMlsListing(listingId: string): Promise<boolean> {
  const count = await prisma.resoProperty.count({
    where: { listingKey: listingId },
  })
  return count > 0
}
```

- [ ] Run TypeScript check: `cd C:/Users/miket/Documents/realestateweb && npx tsc --noEmit`
- [ ] Commit: `git add lib/mls-guard.ts && git commit -m "feat(compliance): add MLS guard to detect RESO-sourced listings"`

---

### Task 8: Create services/ai/local-client.ts

**Files:**
- Create `services/ai/local-client.ts`

- [ ] Create `services/ai/local-client.ts` with the following content:

```typescript
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434'

export class OllamaUnavailableError extends Error {
  constructor() {
    super('Local AI unavailable. MLS listing descriptions cannot be generated via external AI.')
    this.name = 'OllamaUnavailableError'
  }
}

export async function localComplete(prompt: string, model = 'llama3'): Promise<string> {
  let response: Response
  try {
    response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ model, prompt, stream: false }),
    })
  } catch {
    throw new OllamaUnavailableError()
  }
  if (!response.ok) throw new OllamaUnavailableError()
  const json = await response.json() as { response?: string }
  if (!json.response) throw new OllamaUnavailableError()
  return json.response
}
```

- [ ] Run TypeScript check: `cd C:/Users/miket/Documents/realestateweb && npx tsc --noEmit`
- [ ] Commit: `git add services/ai/local-client.ts && git commit -m "feat(compliance): add Ollama local AI client for MLS listing descriptions"`

---

### Task 9: Update services/ai/commands.ts — MLS guard on generate_listing_description

**Files:**
- Modify `services/ai/commands.ts`

- [ ] Read `services/ai/commands.ts` to locate the `generate_listing_description` case (around line 98)
- [ ] Replace the entire `generate_listing_description` case body with:

```typescript
case 'generate_listing_description': {
  const propertyDetails = data.propertyDetails ? String(data.propertyDetails) : 'a luxury property'
  const listingId       = data.listingId ? String(data.listingId) : null
  const prompt = `Write a compelling luxury real estate listing description for: ${propertyDetails}. Keep it under 200 words. Focus on lifestyle and premium features.`
  const systemPrompt = 'You are an expert luxury real estate copywriter.'

  // If a listingId is provided and it maps to a RESO/MLS property, use local AI only
  if (listingId) {
    const { isMlsListing } = await import('@/lib/mls-guard')
    const isMls = await isMlsListing(listingId)
    if (isMls) {
      try {
        const { localComplete } = await import('./local-client')
        const description = await localComplete(prompt)
        return { success: true, data: { description, tokensUsed: 0 } }
      } catch (err) {
        const { OllamaUnavailableError } = await import('./local-client')
        if (err instanceof OllamaUnavailableError) {
          return { success: false, error: 'MLS listing descriptions require a locally-running AI model. See OLLAMA_BASE_URL in .env.' }
        }
        throw err
      }
    }
  }

  // Non-MLS or no listingId — external AI permitted
  const { callAI } = await import('./client')
  const response = await callAI(prompt, { systemPrompt })
  return { success: true, data: { description: response.content, tokensUsed: response.tokensUsed } }
}
```

- [ ] Run TypeScript check: `cd C:/Users/miket/Documents/realestateweb && npx tsc --noEmit`
- [ ] Commit: `git add services/ai/commands.ts && git commit -m "feat(compliance): route MLS listing descriptions to local Ollama, block external AI"`

---

### Task 10: Update app/api/ai/analyze/route.ts — clarify popular_listings is manual-only and add OLLAMA_BASE_URL to .env.example

**Files:**
- Modify `app/api/ai/analyze/route.ts`
- Modify `.env.example`

- [ ] Read `app/api/ai/analyze/route.ts` to locate the `popular_listings` branch
- [ ] In `app/api/ai/analyze/route.ts`, update the `popular_listings` branch to make the manual-only intent explicit with a comment:

```typescript
if (type === 'popular_listings') {
  // Manual listings only — ResoProperty data is never included here
  const topListings = await prisma.listing.findMany({
    orderBy: { views: 'desc' },
    take: 20,
    include: { property: { select: { title: true, price: true, city: true } } },
  })
  return NextResponse.json({ data: topListings })
}
```

- [ ] Read `.env.example` to see existing content
- [ ] Append the following block to `.env.example` (do not overwrite existing content):

```
# Local AI (Ollama) — required if using MLS listing descriptions
# Install Ollama: https://ollama.ai and run: ollama pull llama3
OLLAMA_BASE_URL=http://localhost:11434
```

- [ ] Run TypeScript check: `cd C:/Users/miket/Documents/realestateweb && npx tsc --noEmit`
- [ ] Commit: `git add app/api/ai/analyze/route.ts .env.example && git commit -m "feat(compliance): annotate popular_listings as manual-only and document OLLAMA_BASE_URL"`

---

## Chunk 3: Rate Limiting

### Task 11: Create lib/rate-limit.ts

**Files:**
- Create `lib/rate-limit.ts`

- [ ] Create `lib/rate-limit.ts` with the following content:

```typescript
import { LRUCache } from 'lru-cache'

export interface RateLimitOptions {
  windowMs:  number
  max:       number
  keyPrefix: string
}

interface Entry { count: number; resetAt: number }

export function createRateLimit(options: RateLimitOptions) {
  const cache = new LRUCache<string, Entry>({ max: 10_000, ttl: options.windowMs })

  return {
    check(identifier: string): { allowed: boolean; retryAfterMs: number } {
      const key   = `${options.keyPrefix}:${identifier}`
      const now   = Date.now()
      const entry = cache.get(key) ?? { count: 0, resetAt: now + options.windowMs }

      if (now > entry.resetAt) {
        // Window expired — reset
        const fresh = { count: 1, resetAt: now + options.windowMs }
        cache.set(key, fresh)
        return { allowed: true, retryAfterMs: 0 }
      }

      if (entry.count >= options.max) {
        return { allowed: false, retryAfterMs: entry.resetAt - now }
      }

      cache.set(key, { count: entry.count + 1, resetAt: entry.resetAt })
      return { allowed: true, retryAfterMs: 0 }
    },
  }
}

export const publicSearchLimit = createRateLimit({ windowMs: 60_000,  max: 30, keyPrefix: 'pub'   })
export const portalLimit       = createRateLimit({ windowMs: 60_000,  max: 60, keyPrefix: 'vow'   })
export const loginLimit        = createRateLimit({ windowMs: 900_000, max: 5,  keyPrefix: 'login' })
```

- [ ] Run TypeScript check: `cd C:/Users/miket/Documents/realestateweb && npx tsc --noEmit`
- [ ] Commit: `git add lib/rate-limit.ts && git commit -m "feat(compliance): add LRU-based rate limiter with public, portal, and login tiers"`

---

### Task 12: Update middleware.ts — add rate limiting

**Files:**
- Modify `middleware.ts`

- [ ] Read `middleware.ts` to see the current imports and the start of the `middleware` function body
- [ ] Add the following import at the top of `middleware.ts` (alongside existing imports):

```typescript
import { publicSearchLimit, portalLimit, loginLimit } from '@/lib/rate-limit'
```

- [ ] At the top of the `middleware` function body, before the existing `listingMatch` check (or before any other gate logic), insert the following rate limiting block:

```typescript
// ── Rate limiting ───────────────────────────────────────────────────────────
const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim()
        ?? request.headers.get('x-real-ip')
        ?? 'unknown'

if (pathname.startsWith('/api/search') || (pathname.startsWith('/api/listings') && request.method === 'GET')) {
  const { allowed, retryAfterMs } = publicSearchLimit.check(ip)
  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(retryAfterMs / 1000)) } }
    )
  }
}

if (pathname.startsWith('/api/portal/listings')) {
  const sessionId = request.cookies.get('contact_token')?.value ?? ip
  const { allowed, retryAfterMs } = portalLimit.check(sessionId)
  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(retryAfterMs / 1000)) } }
    )
  }
}

if (pathname === '/api/portal/login') {
  const { allowed, retryAfterMs } = loginLimit.check(ip)
  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(retryAfterMs / 1000)) } }
    )
  }
}
```

- [ ] Verify `pathname` is already extracted from the request URL in the existing middleware. If not, add: `const { pathname } = new URL(request.url)`
- [ ] Run TypeScript check: `cd C:/Users/miket/Documents/realestateweb && npx tsc --noEmit`
- [ ] Commit: `git add middleware.ts && git commit -m "feat(compliance): add IP-based rate limiting to public search, portal, and login endpoints"`

---

### Task 13: Create public/robots.txt

**Files:**
- Create `public/robots.txt`

- [ ] Create `public/robots.txt` with the following content:

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

- [ ] Run TypeScript check: `cd C:/Users/miket/Documents/realestateweb && npx tsc --noEmit`
- [ ] Commit: `git add public/robots.txt && git commit -m "feat(compliance): add robots.txt to block API and portal crawling"`

---

## Chunk 4: Data Lifecycle

### Task 14: Create services/data-lifecycle.ts

**Files:**
- Create `services/data-lifecycle.ts`

- [ ] Create `services/data-lifecycle.ts` with the following content:

```typescript
import { prisma } from '@/lib/prisma'

export async function purgeOldBehaviorEvents(): Promise<{ deleted: number }> {
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
  const { count } = await prisma.behaviorEvent.deleteMany({
    where: { createdAt: { lt: cutoff } },
  })
  return { deleted: count }
}

export async function purgeOldSearchLogs(): Promise<{ deleted: number }> {
  const cutoff = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000)
  const { count } = await prisma.propertySearchLog.deleteMany({
    where: { occurredAt: { lt: cutoff } },
  })
  return { deleted: count }
}

export async function purgeContactData(contactId: string): Promise<{ deleted: Record<string, number> }> {
  const [behaviorEvents, searchLogs, savedListings, savedSearches, optLogs] = await Promise.all([
    prisma.behaviorEvent.deleteMany({ where: { contactId } }),
    prisma.propertySearchLog.deleteMany({ where: { contactId } }),
    prisma.contactSavedListing.deleteMany({ where: { contactId } }),
    prisma.savedSearch.deleteMany({ where: { contactId } }),
    prisma.communicationOptLog.deleteMany({ where: { contactId } }),
  ])
  return {
    deleted: {
      behaviorEvents:  behaviorEvents.count,
      searchLogs:      searchLogs.count,
      savedListings:   savedListings.count,
      savedSearches:   savedSearches.count,
      optLogs:         optLogs.count,
    },
  }
}

export async function purgeMlsData(): Promise<{ deleted: Record<string, number> }> {
  // Order matters: delete checkpoints and logs before properties/members/offices
  const [checkpoints, syncLogs, members, offices, properties] = await Promise.all([
    prisma.ampreSyncCheckpoint.deleteMany({}),
    prisma.resoSyncLog.deleteMany({}),
    prisma.resoMember.deleteMany({}),
    prisma.resoOffice.deleteMany({}),
    prisma.resoProperty.deleteMany({}),
  ])
  return {
    deleted: {
      checkpoints: checkpoints.count,
      syncLogs:    syncLogs.count,
      members:     members.count,
      offices:     offices.count,
      properties:  properties.count,
    },
  }
}
```

- [ ] Run TypeScript check: `cd C:/Users/miket/Documents/realestateweb && npx tsc --noEmit`
- [ ] Commit: `git add services/data-lifecycle.ts && git commit -m "feat(compliance): add data lifecycle service for retention purges and MLS termination"`

---

### Task 15: Create app/api/admin/purge/route.ts and update .env.example

**Files:**
- Create `app/api/admin/purge/route.ts`
- Modify `.env.example`

- [ ] Create `app/api/admin/purge/route.ts` with the following content:

```typescript
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import {
  purgeOldBehaviorEvents,
  purgeOldSearchLogs,
  purgeContactData,
  purgeMlsData,
} from '@/services/data-lifecycle'

function isCronRequest(request: Request): boolean {
  return request.headers.get('x-cron-secret') === process.env.RESO_SYNC_SECRET
}

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type')

  // type=retention accepts admin session OR cron secret
  if (type === 'retention') {
    const isCron = isCronRequest(request)
    if (!isCron) {
      const session = await getSession()
      if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const [behaviorEvents, searchLogs] = await Promise.all([
      purgeOldBehaviorEvents(),
      purgeOldSearchLogs(),
    ])
    return NextResponse.json({ behaviorEvents: behaviorEvents.deleted, searchLogs: searchLogs.deleted })
  }

  // All other types require admin session
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (type === 'contact') {
    const contactId = searchParams.get('contactId')
    if (!contactId) return NextResponse.json({ error: 'contactId required' }, { status: 400 })
    const result = await purgeContactData(contactId)
    return NextResponse.json(result)
  }

  if (type === 'mls-termination') {
    const body = await request.json().catch(() => ({})) as Record<string, unknown>
    if (body.confirm !== 'TERMINATE_MLS_DATA') {
      return NextResponse.json({ error: 'Confirmation required: { "confirm": "TERMINATE_MLS_DATA" }' }, { status: 400 })
    }
    const result = await purgeMlsData()
    return NextResponse.json(result)
  }

  return NextResponse.json({ error: 'Invalid type. Use: retention | contact | mls-termination' }, { status: 400 })
}
```

- [ ] Read `.env.example` to confirm the OLLAMA_BASE_URL block from Task 10 is present
- [ ] Append the following cron note block to `.env.example` (after the OLLAMA_BASE_URL block added in Task 10, do not overwrite):

```
# Data retention cron — run daily (same secret as sync cron)
# POST /api/admin/purge?type=retention
# Header: x-cron-secret: <RESO_SYNC_SECRET value>
```

- [ ] Run TypeScript check: `cd C:/Users/miket/Documents/realestateweb && npx tsc --noEmit`
- [ ] Commit: `git add app/api/admin/purge/route.ts .env.example && git commit -m "feat(compliance): add admin purge endpoint for retention, contact deletion, and MLS termination"`

---

## Chunk 5: Access Control

### Task 16: Create lib/mock-guard.ts

**Files:**
- Create `lib/mock-guard.ts`

- [ ] Create `lib/mock-guard.ts` with the following content:

```typescript
import { NextResponse } from 'next/server'

export function mockGuard(): NextResponse | null {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  return null
}
```

- [ ] Run TypeScript check: `cd C:/Users/miket/Documents/realestateweb && npx tsc --noEmit`
- [ ] Commit: `git add lib/mock-guard.ts && git commit -m "feat(compliance): add production guard to block mock routes"`

---

### Task 17: Update mock routes with production guard

**Files:**
- Modify `app/api/mock-reso/Property/route.ts`
- Modify `app/api/mock-reso/Member/route.ts`
- Modify `app/api/mock-reso/Office/route.ts`
- Modify `app/api/mock-reso/Property/[ListingKey]/route.ts`

- [ ] Read `app/api/mock-reso/Property/route.ts` to see the handler structure (known: imports `validateMockToken` from `@/lib/mock-ampre-auth`, handler starts immediately after imports)
- [ ] Add the import and guard to `app/api/mock-reso/Property/route.ts`. Add import line:

```typescript
import { mockGuard } from '@/lib/mock-guard'
```

Then add as the very first line inside each exported handler function:

```typescript
const guard = mockGuard(); if (guard) return guard
```

- [ ] Read `app/api/mock-reso/Member/route.ts` and apply the same pattern:
  - Add `import { mockGuard } from '@/lib/mock-guard'`
  - Add `const guard = mockGuard(); if (guard) return guard` as the first line of each exported handler

- [ ] Read `app/api/mock-reso/Office/route.ts` and apply the same pattern:
  - Add `import { mockGuard } from '@/lib/mock-guard'`
  - Add `const guard = mockGuard(); if (guard) return guard` as the first line of each exported handler

- [ ] Read `app/api/mock-reso/Property/[ListingKey]/route.ts` and apply the same pattern:
  - Add `import { mockGuard } from '@/lib/mock-guard'`
  - Add `const guard = mockGuard(); if (guard) return guard` as the first line of each exported handler

- [ ] Run TypeScript check: `cd C:/Users/miket/Documents/realestateweb && npx tsc --noEmit`
- [ ] Commit: `git add app/api/mock-reso/Property/route.ts app/api/mock-reso/Member/route.ts app/api/mock-reso/Office/route.ts "app/api/mock-reso/Property/[ListingKey]/route.ts" && git commit -m "feat(compliance): block all mock RESO routes in production"`

---

### Task 18: Update app/api/ai/analyze/route.ts — admin session and buyer_intent pagination

**Files:**
- Modify `app/api/ai/analyze/route.ts`

Note: This task builds on the changes made in Task 10 (popular_listings comment). Replace the entire route file with the updated version that uses admin session auth and paginated buyer_intent.

- [ ] Read `app/api/ai/analyze/route.ts` to see the current full content (after Task 10 changes)
- [ ] Replace the entire content of `app/api/ai/analyze/route.ts` with:

```typescript
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const type  = searchParams.get('type') ?? 'overview'

  if (type === 'buyer_intent') {
    const page  = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)))
    const [topSearches, total] = await Promise.all([
      prisma.propertySearchLog.findMany({
        orderBy: { occurredAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.propertySearchLog.count(),
    ])
    return NextResponse.json({
      data:  topSearches.map(s => ({ query: JSON.parse(s.query), results: s.results, occurredAt: s.occurredAt })),
      total,
      page,
      limit,
    })
  }

  if (type === 'popular_listings') {
    // Manual listings only — ResoProperty data is never included here
    const topListings = await prisma.listing.findMany({
      orderBy: { views: 'desc' },
      take: 20,
      include: { property: { select: { title: true, price: true, city: true } } },
    })
    return NextResponse.json({ data: topListings })
  }

  if (type === 'lead_scores') {
    const hotLeads = await prisma.contact.findMany({
      where:   { leadScore: { gte: 50 } },
      orderBy: { leadScore: 'desc' },
      take:    20,
      select:  { id: true, firstName: true, lastName: true, email: true, leadScore: true, source: true },
    })
    return NextResponse.json({ data: hotLeads })
  }

  // Overview
  const [contacts, deals, listings, searchLogs] = await Promise.all([
    prisma.contact.count(),
    prisma.deal.count(),
    prisma.property.count({ where: { status: 'active' } }),
    prisma.propertySearchLog.count({ where: { occurredAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } }),
  ])
  return NextResponse.json({ data: { contacts, deals, activeListings: listings, searchesThisWeek: searchLogs } })
}
```

- [ ] Run TypeScript check: `cd C:/Users/miket/Documents/realestateweb && npx tsc --noEmit`
- [ ] Commit: `git add app/api/ai/analyze/route.ts && git commit -m "feat(compliance): require admin session and add pagination to AI analyze endpoint"`

---

### Task 19: Update lib/auth.ts and app/api/ai/command/route.ts — forward-compat request parameter

**Files:**
- Modify `lib/auth.ts`
- Modify `app/api/ai/command/route.ts`

- [ ] Read `lib/auth.ts` to locate the `validateApiKey` function signature
- [ ] Update the `validateApiKey` function signature in `lib/auth.ts` to accept an optional `request` parameter for forward-compatibility. Change the signature from:

```typescript
export async function validateApiKey(key: string): Promise<User | null>
```

to:

```typescript
export async function validateApiKey(key: string, request?: { headers: { get(name: string): string | null } }): Promise<User | null>
```

The body of the function remains unchanged. The `request` parameter is accepted for forward-compatibility — IP is already captured directly in `command/route.ts` and passed to `dispatchCommand`. No behavioral change.

- [ ] Read `app/api/ai/command/route.ts` to locate the `validateApiKey` call (known: `const user = await validateApiKey(apiKey)` where `apiKey = authHeader.slice(7)`)
- [ ] Update the `validateApiKey` call in `app/api/ai/command/route.ts` to pass `request` as the second argument:

```typescript
const user = await validateApiKey(apiKey, request)
```

- [ ] Run TypeScript check: `cd C:/Users/miket/Documents/realestateweb && npx tsc --noEmit`
- [ ] Commit: `git add lib/auth.ts app/api/ai/command/route.ts && git commit -m "feat(compliance): add forward-compat request param to validateApiKey for IP logging"`
