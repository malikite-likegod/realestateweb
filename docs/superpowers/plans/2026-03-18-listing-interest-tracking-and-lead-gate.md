# Listing Interest Tracking & Lead Capture Gate — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add property interest tracking per contact and a configurable anonymous-visitor gate that captures leads before allowing unlimited listing browsing.

**Architecture:** Three Prisma models (`ContactPropertyInterest`, `SiteSettings`, `EmailVerificationToken`) back a split middleware/Server Component gate system and a new admin Property Interests panel. Middleware handles cookie writes (Edge-safe); Server Components read settings via `unstable_cache` and make gate decisions from request headers.

**Tech Stack:** Next.js 15 App Router, Prisma 5 (SQLite dev/MySQL prod), Zod validation, Nodemailer (existing email service), Tailwind CSS, TypeScript.

**Spec:** `docs/superpowers/specs/2026-03-18-listing-interest-tracking-and-lead-gate-design.md`

---

## Chunk 1: Database Schema & Migration

### Task 1: Add three new Prisma models

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add the new models to schema.prisma**

Open `prisma/schema.prisma`. After the `PropertySearchLog` model (around line 795), add:

```prisma
// ─── Site Settings ────────────────────────────────────────────────────────────

model SiteSettings {
  id        String   @id @default(cuid())
  key       String   @unique
  value     String
  updatedAt DateTime @updatedAt

  @@map("site_settings")
}

// ─── Email Verification Tokens ────────────────────────────────────────────────

model EmailVerificationToken {
  id         String    @id @default(cuid())
  email      String
  firstName  String
  lastName   String
  tokenHash  String    @unique
  sessionId  String
  returnUrl  String?
  expiresAt  DateTime
  usedAt     DateTime?
  createdAt  DateTime  @default(now())

  @@index([email, sessionId])
  @@map("email_verification_tokens")
}

// ─── Contact Property Interests ───────────────────────────────────────────────

model ContactPropertyInterest {
  id         String   @id @default(cuid())
  contactId  String
  contact    Contact  @relation(fields: [contactId], references: [id], onDelete: Cascade)
  propertyId String
  property   Property @relation(fields: [propertyId], references: [id], onDelete: Cascade)
  source     String   @default("auto") // manual | auto
  notes      String?
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@unique([contactId, propertyId])
  @@map("contact_property_interests")
}
```

Also add relation fields inside the **existing** model bodies in `prisma/schema.prisma`:

In the `Contact` model, insert **before** `@@map("contacts")`:
```prisma
  propertyInterests ContactPropertyInterest[]
```

In the `Property` model, insert **before** `@@map("properties")`:
```prisma
  contactInterests  ContactPropertyInterest[]
```

These must be inside the model body braces — not after the closing brace. Without them `prisma generate` will fail with a "missing opposite relation field" error.

- [ ] **Step 2: Run migration**

```bash
npx prisma migrate dev --name add_listing_interest_tracking_and_gate
```

Expected output: Migration created and applied. Three new tables in the database.

- [ ] **Step 3: Verify Prisma client regenerated**

```bash
npx prisma generate
```

Expected: "Generated Prisma Client" with no errors.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add ContactPropertyInterest, SiteSettings, EmailVerificationToken models"
```

---

## Chunk 2: Site Settings API

### Task 2: Settings API route

**Files:**
- Create: `app/api/admin/settings/route.ts`
- Modify: `middleware.ts`

- [ ] **Step 1: Add /api/admin to PROTECTED_PATHS in middleware.ts**

In `middleware.ts`, update line 4–5:

```typescript
const PROTECTED_PATHS = ['/admin', '/api/contacts', '/api/deals', '/api/tasks',
  '/api/activities', '/api/listings', '/api/blog', '/api/stages', '/api/api-keys',
  '/api/admin']
```

- [ ] **Step 2: Create the settings route**

Create `app/api/admin/settings/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const settings = await prisma.siteSettings.findMany()
  const result: Record<string, string> = {}
  for (const s of settings) result[s.key] = s.value
  return NextResponse.json(result)
}

export async function PATCH(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json() as Record<string, string>
    await Promise.all(
      Object.entries(body).map(([key, value]) =>
        prisma.siteSettings.upsert({
          where:  { key },
          update: { value },
          create: { key, value },
        })
      )
    )
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
```

- [ ] **Step 3: Create a helper to fetch gate settings server-side with caching**

Create `lib/site-settings.ts`:

```typescript
import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/prisma'

export const getGateSettings = unstable_cache(
  async () => {
    const rows = await prisma.siteSettings.findMany({
      where: { key: { in: ['listing_gate_limit', 'listing_gate_enabled'] } },
    })
    const map: Record<string, string> = {}
    for (const r of rows) map[r.key] = r.value
    return {
      limit:   parseInt(map['listing_gate_limit']   ?? '3', 10),
      enabled: (map['listing_gate_enabled'] ?? 'true') === 'true',
    }
  },
  ['gate-settings'],
  { revalidate: 60 }
)
```

- [ ] **Step 4: Commit**

```bash
git add app/api/admin/settings/route.ts lib/site-settings.ts middleware.ts
git commit -m "feat: add site settings API and gate settings cache helper"
```

---

## Chunk 3: Admin Settings UI

### Task 3: Lead Capture card in settings page

**Files:**
- Create: `components/admin/LeadCaptureSettingsCard.tsx`
- Modify: `app/admin/settings/page.tsx`

- [ ] **Step 1: Create the client component**

Create `components/admin/LeadCaptureSettingsCard.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { Card } from '@/components/layout'
import { Button, Input } from '@/components/ui'

interface Props {
  initialLimit:   number
  initialEnabled: boolean
}

export function LeadCaptureSettingsCard({ initialLimit, initialEnabled }: Props) {
  const [limit,   setLimit]   = useState(String(initialLimit))
  const [enabled, setEnabled] = useState(initialEnabled)
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)

  async function handleSave() {
    setSaving(true)
    await fetch('/api/admin/settings', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        listing_gate_limit:   limit,
        listing_gate_enabled: String(enabled),
      }),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <Card>
      <h3 className="font-semibold text-charcoal-900 mb-1">Lead Capture Gate</h3>
      <p className="text-sm text-charcoal-400 mb-4">
        Limit how many listings anonymous visitors can view before being prompted to register.
      </p>

      <div className="flex flex-col gap-4">
        {/* Toggle */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-charcoal-900">Enable gate</p>
            <p className="text-xs text-charcoal-400">When off, all visitors browse freely</p>
          </div>
          <button
            type="button"
            onClick={() => setEnabled(e => !e)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              enabled ? 'bg-gold-500' : 'bg-charcoal-200'
            }`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
              enabled ? 'translate-x-6' : 'translate-x-1'
            }`} />
          </button>
        </div>

        {/* Limit */}
        <Input
          label="Free listing views before registration required"
          type="number"
          min={1}
          value={limit}
          onChange={e => setLimit(e.target.value)}
        />

        <Button
          variant="primary"
          className="self-start"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving…' : saved ? 'Saved!' : 'Save'}
        </Button>
      </div>
    </Card>
  )
}
```

- [ ] **Step 2: Add the card to settings page**

In `app/admin/settings/page.tsx`, import and fetch gate settings:

At the top, add import:
```typescript
import { LeadCaptureSettingsCard } from '@/components/admin/LeadCaptureSettingsCard'
```

Replace the existing `Promise.all` destructuring with:
```typescript
const [lastSync, apiKeyCount, commandLogCount, queueStats, tfaUser, gateSettingsRows] = await Promise.all([
  prisma.idxUpdate.findFirst({ orderBy: { syncedAt: 'desc' } }),
  prisma.apiKey.count({ where: { userId: session.id } }),
  prisma.aiCommandLog.count(),
  prisma.jobQueue.groupBy({ by: ['status'], _count: { id: true } }),
  prisma.user.findUnique({ where: { id: session.id }, select: { totpEnabled: true } }),
  prisma.siteSettings.findMany({ where: { key: { in: ['listing_gate_limit', 'listing_gate_enabled'] } } }),
])
```

After the existing constants, add:
```typescript
const gateSettingsMap: Record<string, string> = {}
for (const r of gateSettingsRows) gateSettingsMap[r.key] = r.value
const gateLimit   = parseInt(gateSettingsMap['listing_gate_limit']   ?? '3', 10)
const gateEnabled = (gateSettingsMap['listing_gate_enabled'] ?? 'true') === 'true'
```

Add the card in the JSX, before the `<Divider />` that precedes the IDX section (or at the end of the settings cards):
```tsx
<LeadCaptureSettingsCard initialLimit={gateLimit} initialEnabled={gateEnabled} />

<Divider />
```

- [ ] **Step 3: Verify the settings page loads without errors**

Start the dev server (`npm run dev`) and open `/admin/settings`. The Lead Capture card should appear with toggle and number input. Save should hit `PATCH /api/admin/settings` and return success.

- [ ] **Step 4: Commit**

```bash
git add components/admin/LeadCaptureSettingsCard.tsx app/admin/settings/page.tsx
git commit -m "feat: add lead capture gate settings card to admin settings page"
```

---

## Chunk 4: Middleware Gate Logic

### Task 4: Cookie tracking in middleware

**Files:**
- Modify: `middleware.ts`

The middleware must:
1. Set `re_session` UUID cookie on first visit to any public page.
2. On listing pages: read/update `re_views`, set `x-view-count`, `x-gate-bypass`, `x-gate-pending` headers.

- [ ] **Step 1: Update middleware.ts**

Replace the full contents of `middleware.ts` with:

```typescript
import { NextResponse, type NextRequest } from 'next/server'
import { verifyJwt } from './lib/jwt'

const PROTECTED_PATHS = ['/admin', '/api/contacts', '/api/deals', '/api/tasks',
  '/api/activities', '/api/listings', '/api/blog', '/api/stages', '/api/api-keys',
  '/api/admin']

// Public listing detail pages: /listings/[id]
const LISTING_PATH_RE = /^\/listings\/([^/]+)$/

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ── Gate cookie logic (public listing pages only) ──────────────────────────
  const listingMatch = pathname.match(LISTING_PATH_RE)
  if (listingMatch) {
    const propertyId = listingMatch[1]

    // Ensure re_session exists
    let sessionId = request.cookies.get('re_session')?.value
    if (!sessionId) sessionId = crypto.randomUUID()

    // Read + update re_views (JSON array of property IDs)
    const isVerified = !!request.cookies.get('re_verified')?.value
    const isPending  = !!request.cookies.get('re_pending')?.value

    let views: string[] = []
    try {
      views = JSON.parse(request.cookies.get('re_views')?.value ?? '[]')
      if (!Array.isArray(views)) views = []
    } catch { views = [] }

    if (!views.includes(propertyId)) views.push(propertyId)

    // IMPORTANT: To pass headers to the Server Component via `await headers()`,
    // we must mutate the *forwarded request headers* using NextResponse.next({ request }).
    // Setting headers on response.headers sends them to the browser, NOT the Server Component.
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-view-count', String(views.length))
    requestHeaders.set('x-session-id', sessionId)
    if (isVerified) requestHeaders.set('x-gate-bypass',  'true')
    if (isPending)  requestHeaders.set('x-gate-pending', 'true')

    const response = NextResponse.next({ request: { headers: requestHeaders } })

    // Set cookies on the response (written to browser)
    if (!request.cookies.get('re_session')?.value) {
      response.cookies.set('re_session', sessionId, {
        maxAge:   365 * 24 * 60 * 60,
        httpOnly: true,
        sameSite: 'lax',
        path:     '/',
      })
    }

    // Always write updated re_views if the array changed
    const originalViews = request.cookies.get('re_views')?.value ?? '[]'
    if (JSON.stringify(views) !== originalViews) {
      response.cookies.set('re_views', JSON.stringify(views), {
        maxAge:   30 * 24 * 60 * 60,
        sameSite: 'lax',
        path:     '/',
      })
    }

    return response
  }

  // ── Admin / API auth ────────────────────────────────────────────────────────
  const isProtected = PROTECTED_PATHS.some(p => pathname.startsWith(p))
  const isLoginFlow = pathname === '/admin/login' || pathname.startsWith('/admin/login/')

  if (!isProtected || isLoginFlow) {
    return NextResponse.next()
  }

  // AI routes accept Bearer API key OR JWT
  if (pathname.startsWith('/api/ai/')) {
    const auth = request.headers.get('authorization')
    if (auth?.startsWith('Bearer ')) {
      return NextResponse.next()
    }
  }

  // JWT cookie check
  const token = request.cookies.get('auth_token')?.value
  if (!token) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const url = request.nextUrl.clone()
    url.pathname = '/admin/login'
    return NextResponse.redirect(url)
  }

  const payload = await verifyJwt(token)
  if (!payload) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }
    const url = request.nextUrl.clone()
    url.pathname = '/admin/login'
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*', '/api/:path*', '/listings/:path*'],
}
```

- [ ] **Step 2: Verify middleware compiles**

```bash
npx tsc --noEmit
```

Expected: No errors on middleware.ts.

- [ ] **Step 3: Commit**

```bash
git add middleware.ts
git commit -m "feat: add gate cookie tracking to middleware (re_session, re_views, x-view-count headers)"
```

---

## Chunk 5: Gate Modal Component & Listing Page

### Task 5: ListingGateModal client component

**Files:**
- Create: `components/public/ListingGateModal.tsx`

- [ ] **Step 1: Create the gate modal**

Create `components/public/ListingGateModal.tsx`:

```typescript
'use client'

import { useState } from 'react'

type State = 'gate' | 'pending' | 'error'

interface Props {
  initialState: State
  returnUrl:    string
}

export function ListingGateModal({ initialState, returnUrl }: Props) {
  const [state,     setState]     = useState<State>(initialState)
  const [firstName, setFirstName] = useState('')
  const [lastName,  setLastName]  = useState('')
  const [email,     setEmail]     = useState('')
  const [pendingEmail, setPendingEmail] = useState('')
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')
  const [resent,    setResent]    = useState(false)
  const [resending, setResending] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await fetch('/api/gate/submit', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ firstName, lastName, email, returnUrl }),
    })
    setLoading(false)
    if (res.ok) {
      setPendingEmail(email)
      setState('pending')
    } else {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'Something went wrong. Please try again.')
    }
  }

  async function handleResend() {
    setResending(true)
    await fetch('/api/gate/resend', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email: pendingEmail }),
    })
    setResending(false)
    setResent(true)
    setTimeout(() => setResent(false), 5000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md mx-4 bg-white rounded-2xl shadow-2xl p-8">
        {state === 'gate' && (
          <>
            <h2 className="font-serif text-2xl font-bold text-charcoal-900 mb-2">
              Unlock Full Access
            </h2>
            <p className="text-charcoal-500 text-sm mb-6">
              Enter your details to continue browsing listings without limits.
            </p>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-charcoal-700 mb-1">First Name</label>
                  <input
                    required
                    value={firstName}
                    onChange={e => setFirstName(e.target.value)}
                    className="w-full rounded-lg border border-charcoal-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-charcoal-700 mb-1">Last Name</label>
                  <input
                    required
                    value={lastName}
                    onChange={e => setLastName(e.target.value)}
                    className="w-full rounded-lg border border-charcoal-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-charcoal-700 mb-1">Email</label>
                <input
                  required
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-charcoal-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500"
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-gold-500 hover:bg-gold-600 text-white font-semibold py-2.5 transition-colors disabled:opacity-60"
              >
                {loading ? 'Sending…' : 'Get Full Access'}
              </button>
              <p className="text-center text-xs text-charcoal-400">
                We&apos;ll send you a quick verification link — then you can browse freely.
              </p>
            </form>
          </>
        )}

        {state === 'pending' && (
          <>
            <div className="text-center mb-6">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gold-50">
                <svg className="h-7 w-7 text-gold-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className="font-serif text-2xl font-bold text-charcoal-900 mb-2">Check Your Inbox</h2>
              <p className="text-charcoal-500 text-sm">
                We sent a verification link to <strong>{pendingEmail}</strong>.<br />
                Click it to start browsing freely.
              </p>
            </div>
            <button
              type="button"
              onClick={handleResend}
              disabled={resending}
              className="w-full text-sm text-charcoal-500 hover:text-gold-600 transition-colors disabled:opacity-60"
            >
              {resent ? 'Email resent!' : resending ? 'Resending…' : 'Resend verification email'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/public/ListingGateModal.tsx
git commit -m "feat: add ListingGateModal client component (gate + pending states)"
```

### Task 6: Update listing detail page with gate logic

**Files:**
- Modify: `app/(public)/listings/[id]/page.tsx`

- [ ] **Step 1: Update the listing detail page**

Replace the full contents of `app/(public)/listings/[id]/page.tsx` with:

```typescript
import { headers, cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getGateSettings } from '@/lib/site-settings'
import { Container } from '@/components/layout'
import { PropertyGallery } from '@/components/real-estate'
import { PropertyInquiryForm } from '@/components/forms'
import { ListingGateModal } from '@/components/public/ListingGateModal'
import { Badge } from '@/components/ui'
import { formatPrice, parseJsonSafe } from '@/lib/utils'
import { Bed, Bath, Square, MapPin, Calendar, Car } from 'lucide-react'
import type { Metadata } from 'next'

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const property = await prisma.property.findUnique({ where: { id } })
  if (!property) return {}
  return { title: property.title, description: property.description ?? undefined }
}

export default async function ListingDetailPage({ params }: Props) {
  const { id } = await params
  const property = await prisma.property.findUnique({
    where: { id },
    include: { listings: true },
  })
  if (!property) notFound()

  // ── Gate decision ──────────────────────────────────────────────────────────
  const reqHeaders  = await headers()
  const isBypass    = reqHeaders.get('x-gate-bypass')  === 'true'
  const isPending   = reqHeaders.get('x-gate-pending') === 'true'
  const viewCount   = parseInt(reqHeaders.get('x-view-count') ?? '0', 10)
  const { limit, enabled } = await getGateSettings()
  const showGate    = enabled && !isBypass && !isPending && viewCount >= limit
  const showPending = enabled && !isBypass && isPending

  // ── Track view for verified contacts ──────────────────────────────────────
  // The re_verified cookie stores the contactId string set during email verification.
  // We call the server-side tracking function directly (no internal HTTP fetch).
  if (isBypass) {
    const cookieStore = await cookies()
    const contactId   = cookieStore.get('re_verified')?.value // e.g. "clxyz123..."
    const sessionId   = reqHeaders.get('x-session-id') ?? undefined
    if (contactId) {
      const { trackBehaviorEvent } = await import('@/services/ai/lead-scoring')
      void trackBehaviorEvent('listing_view', id, contactId, sessionId, undefined).catch(() => null)
      // Also upsert ContactPropertyInterest directly
      void prisma.contactPropertyInterest.upsert({
        where:  { contactId_propertyId: { contactId, propertyId: id } },
        update: { updatedAt: new Date() },
        create: { contactId, propertyId: id, source: 'auto' },
      }).catch(() => null)
    }
  }

  const images   = parseJsonSafe<string[]>(property.images, ['/placeholder-property.jpg'])
  const features = parseJsonSafe<string[]>(property.features, [])
  const returnUrl = `/listings/${id}`

  return (
    <div className="pt-20">
      {/* Gate overlays */}
      {(showGate || showPending) && (
        <ListingGateModal
          initialState={showPending ? 'pending' : 'gate'}
          returnUrl={returnUrl}
        />
      )}

      {/* Blurred content wrapper when gated */}
      <div className={showGate || showPending ? 'blur-sm pointer-events-none select-none' : ''}>
        <Container className="py-8">
          {/* Gallery */}
          <PropertyGallery images={images} title={property.title} />

          <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main info */}
            <div className="lg:col-span-2">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="font-serif text-4xl font-bold text-charcoal-900">{formatPrice(property.price)}</p>
                  <h1 className="text-xl font-semibold text-charcoal-700 mt-1">{property.title}</h1>
                  <p className="flex items-center gap-1.5 text-charcoal-500 mt-1"><MapPin size={15} /> {property.address}, {property.city}, {property.province}</p>
                </div>
                <div className="flex flex-col gap-2 items-end">
                  <Badge variant={property.status === 'active' ? 'success' : 'warning'} className="capitalize">{property.status}</Badge>
                  <Badge variant="default" className="capitalize">{property.listingType}</Badge>
                </div>
              </div>

              {/* Stats */}
              <div className="flex flex-wrap gap-6 py-5 border-y border-charcoal-100 mb-6">
                {property.bedrooms != null && <span className="flex items-center gap-2 text-charcoal-700"><Bed size={18} /> <strong>{property.bedrooms}</strong> Bedrooms</span>}
                {property.bathrooms != null && <span className="flex items-center gap-2 text-charcoal-700"><Bath size={18} /> <strong>{property.bathrooms}</strong> Bathrooms</span>}
                {property.sqft != null && <span className="flex items-center gap-2 text-charcoal-700"><Square size={18} /> <strong>{property.sqft.toLocaleString()}</strong> sqft</span>}
                {property.parkingSpaces != null && <span className="flex items-center gap-2 text-charcoal-700"><Car size={18} /> <strong>{property.parkingSpaces}</strong> Parking</span>}
                {property.yearBuilt != null && <span className="flex items-center gap-2 text-charcoal-700"><Calendar size={18} /> Built <strong>{property.yearBuilt}</strong></span>}
              </div>

              {/* Description */}
              {property.description && (
                <div className="mb-8">
                  <h2 className="font-serif text-2xl font-bold text-charcoal-900 mb-3">About This Property</h2>
                  <p className="text-charcoal-600 leading-relaxed whitespace-pre-wrap">{property.description}</p>
                </div>
              )}

              {/* Features */}
              {features.length > 0 && (
                <div>
                  <h2 className="font-serif text-2xl font-bold text-charcoal-900 mb-4">Features & Amenities</h2>
                  <div className="grid grid-cols-2 gap-2">
                    {features.map((f, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm text-charcoal-600">
                        <span className="h-1.5 w-1.5 rounded-full bg-gold-500" />
                        {f}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar — inquiry form */}
            <div className="lg:col-span-1">
              <div className="sticky top-24 rounded-2xl border border-charcoal-100 shadow-sm p-6">
                <h3 className="font-serif text-xl font-bold text-charcoal-900 mb-4">Request Information</h3>
                <PropertyInquiryForm propertyTitle={property.title} propertyId={property.id} />
              </div>
            </div>
          </div>
        </Container>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/(public)/listings/[id]/page.tsx
git commit -m "feat: integrate gate logic into listing detail page"
```

---

## Chunk 6: Gate API Routes

### Task 7: Gate submit route

**Files:**
- Create: `app/api/gate/submit/route.ts`

- [ ] **Step 1: Create the submit route**

Create `app/api/gate/submit/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { sendVerificationEmail } from '@/lib/gate-email'

const schema = z.object({
  firstName: z.string().min(1),
  lastName:  z.string().min(1),
  email:     z.string().email(),
  returnUrl: z.string().optional(),
})

export async function POST(request: Request) {
  // Parse and validate first — return 400 on bad input
  let data: z.infer<typeof schema>
  try {
    const body = await request.json()
    data = schema.parse(body)
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const cookieStore = await cookies()
  const sessionId   = cookieStore.get('re_session')?.value ?? 'unknown'

  // Generate a secure random token and write to DB
  const rawToken  = crypto.randomUUID() + crypto.randomUUID()
  const tokenHash = await hashToken(rawToken)
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)

  await prisma.emailVerificationToken.create({
    data: {
      email:     data.email,
      firstName: data.firstName,
      lastName:  data.lastName,
      tokenHash,
      sessionId,
      returnUrl: data.returnUrl ?? '/listings',
      expiresAt,
    },
  })

  // Send email — return 500 if SMTP is configured but fails
  // (token is already in DB; resend is available)
  try {
    await sendVerificationEmail({
      to:        data.email,
      firstName: data.firstName,
      token:     rawToken,
      returnUrl: data.returnUrl ?? '/listings',
    })
  } catch {
    return NextResponse.json({ error: 'Failed to send verification email. Please try again.' }, { status: 500 })
  }

  // Set re_pending cookie so listing pages show "waiting" overlay
  const response = NextResponse.json({ success: true })
  response.cookies.set('re_pending', data.email, {
    sameSite: 'lax',
    path:     '/',
    // session cookie (no maxAge)
  })
  return response
}

async function hashToken(token: string): Promise<string> {
  const data   = new TextEncoder().encode(token)
  const buffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('')
}
```

- [ ] **Step 2: Create the email helper**

Create `lib/gate-email.ts`:

```typescript
interface VerificationEmailOpts {
  to:        string
  firstName: string
  token:     string
  returnUrl: string
}

export async function sendVerificationEmail(opts: VerificationEmailOpts) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'
  // Uses /api/gate/verify (Route Handler) so the handler can set cookies + redirect.
  // Page Server Components cannot write cookies in Next.js 15.
  const link    = `${baseUrl}/api/gate/verify?token=${encodeURIComponent(opts.token)}`

  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
      <h2 style="font-size:22px;font-weight:700;color:#111;margin:0 0 8px">Hi ${opts.firstName},</h2>
      <p style="color:#555;margin:0 0 24px">Click the button below to verify your email and browse listings freely.</p>
      <a href="${link}" style="display:inline-block;background:#d4a843;color:#fff;font-weight:600;padding:12px 28px;border-radius:8px;text-decoration:none">Confirm Email &amp; Browse Listings</a>
      <p style="color:#888;font-size:12px;margin:24px 0 0">Link expires in 24 hours. If you didn't request this, you can ignore this email.</p>
    </div>
  `

  if (!process.env.SMTP_HOST) {
    console.log(`[gate-email] SMTP not configured — verification link: ${link}`)
    return
  }

  const { default: nodemailer } = await import('nodemailer')
  const transporter = nodemailer.createTransport({
    host:   process.env.SMTP_HOST,
    port:   Number(process.env.SMTP_PORT ?? 587),
    secure: Number(process.env.SMTP_PORT ?? 587) === 465,
    auth:   { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  })
  await transporter.sendMail({
    from:    process.env.SMTP_FROM ?? process.env.SMTP_USER ?? 'noreply@example.com',
    to:      opts.to,
    subject: 'Confirm your email to browse listings',
    html,
  })
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/gate/submit/route.ts lib/gate-email.ts
git commit -m "feat: add gate submit API route and verification email helper"
```

### Task 8: Gate resend route

**Files:**
- Create: `app/api/gate/resend/route.ts`

- [ ] **Step 1: Create the resend route**

Create `app/api/gate/resend/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { sendVerificationEmail } from '@/lib/gate-email'

const schema = z.object({ email: z.string().email() })

export async function POST(request: Request) {
  try {
    const body      = await request.json()
    const { email } = schema.parse(body)
    const cookieStore = await cookies()
    const sessionId = cookieStore.get('re_session')?.value ?? 'unknown'

    // Rate limit: one resend per 60 seconds per (email, sessionId)
    const recent = await prisma.emailVerificationToken.findFirst({
      where:   { email, sessionId },
      orderBy: { createdAt: 'desc' },
    })
    if (recent) {
      const elapsed = Date.now() - recent.createdAt.getTime()
      if (elapsed < 60_000) {
        return NextResponse.json({ error: 'Please wait before resending' }, { status: 429 })
      }
    }

    if (!recent) {
      return NextResponse.json({ error: 'No pending verification found' }, { status: 404 })
    }

    // Create a new token
    const rawToken  = crypto.randomUUID() + crypto.randomUUID()
    const tokenHash = await hashToken(rawToken)
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)

    await prisma.emailVerificationToken.create({
      data: {
        email,
        firstName: recent.firstName,
        lastName:  recent.lastName,
        tokenHash,
        sessionId,
        returnUrl: recent.returnUrl,
        expiresAt,
      },
    })

    await sendVerificationEmail({
      to:        email,
      firstName: recent.firstName,
      token:     rawToken,
      returnUrl: recent.returnUrl ?? '/listings',
    })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}

async function hashToken(token: string): Promise<string> {
  const data   = new TextEncoder().encode(token)
  const buffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('')
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/gate/resend/route.ts
git commit -m "feat: add gate resend route with 60s rate limiting"
```

---

## Chunk 7: Email Verification Route Handler

### Task 9: /api/gate/verify Route Handler

**Important:** Next.js 15 Page Server Components cannot call `cookies().set()` — only Route Handlers and Server Actions can. The verification link therefore points to `/api/gate/verify?token=...` (a GET Route Handler), which sets cookies and then redirects to the listing page.

**Files:**
- Create: `app/api/gate/verify/route.ts`

- [ ] **Step 1: Create the verify Route Handler**

Create `app/api/gate/verify/route.ts`:

```typescript
import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'

async function hashToken(token: string): Promise<string> {
  const data   = new TextEncoder().encode(token)
  const buffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function GET(request: NextRequest) {
  const rawToken = request.nextUrl.searchParams.get('token')

  if (!rawToken) {
    return NextResponse.redirect(new URL('/listings?gate_error=invalid', request.url))
  }

  const tokenHash = await hashToken(rawToken)
  const record    = await prisma.emailVerificationToken.findUnique({ where: { tokenHash } })

  if (!record || record.usedAt || record.expiresAt < new Date()) {
    return NextResponse.redirect(new URL('/listings?gate_error=expired', request.url))
  }

  // Mark token as used
  await prisma.emailVerificationToken.update({
    where: { tokenHash },
    data:  { usedAt: new Date() },
  })

  // Upsert contact
  const contact = await prisma.contact.upsert({
    where:  { email: record.email },
    update: {},
    create: {
      email:     record.email,
      firstName: record.firstName,
      lastName:  record.lastName,
      source:    'web',
      status:    'lead',
    },
  })

  const returnUrl = record.returnUrl ?? '/listings'
  const isSecure  = process.env.NODE_ENV === 'production'
  const response  = NextResponse.redirect(new URL(returnUrl, request.url))

  // Set verified cookie (Route Handler — cookie writes are permitted here)
  response.cookies.set('re_verified', contact.id, {
    maxAge:   365 * 24 * 60 * 60,
    httpOnly: true,
    secure:   isSecure,
    sameSite: 'lax',
    path:     '/',
  })
  // Clear pending cookie
  response.cookies.set('re_pending', '', { maxAge: 0, path: '/' })

  return response
}
```

- [ ] **Step 2: Confirm `/api/gate/verify` is public**

Check `PROTECTED_PATHS` in `middleware.ts` — `/api/gate` is not listed, so this route is accessible without auth. No middleware change needed.

- [ ] **Step 3: Test the verification flow manually**

Start dev server. Submit the gate form on a listing page. Check console for the `/api/gate/verify?token=...` link (SMTP not configured in dev prints link to console). Open the link. Verify you're redirected to the listing, `re_verified` cookie is set, and `re_pending` is cleared.

- [ ] **Step 4: Commit**

```bash
git add app/api/gate/verify/route.ts
git commit -m "feat: add email verification Route Handler with contact upsert and cookie management"
```

---

## Chunk 8: Behavior Tracking Update

### Task 10: Upsert ContactPropertyInterest on listing_view

**Files:**
- Modify: `app/api/behavior/route.ts`

- [ ] **Step 1: Update behavior route to upsert interest on listing_view**

Replace the full contents of `app/api/behavior/route.ts` with:

```typescript
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { trackBehaviorEvent } from '@/services/ai/lead-scoring'

const eventSchema = z.object({
  eventType: z.string(),
  entityId:  z.string().optional(),
  contactId: z.string().optional(),
  sessionId: z.string().optional(),
  metadata:  z.record(z.unknown()).optional(),
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const data = eventSchema.parse(body)

    await trackBehaviorEvent(data.eventType, data.entityId, data.contactId, data.sessionId, data.metadata)

    // When a verified contact views a listing, upsert a ContactPropertyInterest record
    if (data.eventType === 'listing_view' && data.contactId && data.entityId) {
      await prisma.contactPropertyInterest.upsert({
        where:  { contactId_propertyId: { contactId: data.contactId, propertyId: data.entityId } },
        update: { updatedAt: new Date() },
        create: { contactId: data.contactId, propertyId: data.entityId, source: 'auto' },
      })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ success: false }, { status: 400 })
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/behavior/route.ts
git commit -m "feat: upsert ContactPropertyInterest on listing_view behavior events"
```

---

## Chunk 9: Contact Property Interests API

### Task 11a: Extend listings API with search and pageSize

The `PropertyInterestsPanel` uses `/api/listings?search=...&pageSize=8` to let agents search for a listing to attach. The current listings GET handler ignores both params. Fix this first.

**Files:**
- Modify: `app/api/listings/route.ts`

- [ ] **Step 1: Add search and pageSize to the listings GET handler**

Replace the `GET` function in `app/api/listings/route.ts` with:

```typescript
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const page     = parseInt(searchParams.get('page')     ?? '1')
  const pageSize = parseInt(searchParams.get('pageSize') ?? '20')
  const status   = searchParams.get('status') ?? 'active'
  const search   = searchParams.get('search') ?? ''

  const where: Record<string, unknown> = { status }
  if (search) {
    (where as { OR?: unknown[] }).OR = [
      { title:   { contains: search } },
      { address: { contains: search } },
      { city:    { contains: search } },
    ]
  }

  const [total, properties] = await Promise.all([
    prisma.property.count({ where }),
    prisma.property.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { listings: { where: { featured: true }, take: 1 } },
    }),
  ])

  return NextResponse.json({ data: properties, total, page })
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/listings/route.ts
git commit -m "feat: add search and pageSize params to listings GET API"
```

### Task 11b: Property interests API routes

**Files:**
- Create: `app/api/contacts/[id]/property-interests/route.ts`
- Create: `app/api/contacts/[id]/property-interests/[propertyId]/route.ts`
- Create: `app/api/listings/[id]/assign-contact/route.ts`

- [ ] **Step 1: Create GET + POST route for interests**

Create `app/api/contacts/[id]/property-interests/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

interface Params { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Params) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: contactId } = await params

  // Deduplicated interests
  const interests = await prisma.contactPropertyInterest.findMany({
    where:   { contactId },
    orderBy: { updatedAt: 'desc' },
    include: { property: true },
  })

  // Raw view history grouped by property
  const rawEvents = await prisma.behaviorEvent.findMany({
    where:   { contactId, eventType: 'listing_view' },
    orderBy: { occurredAt: 'asc' },
  })

  // Group view events by entityId (property ID)
  const viewMap: Record<string, { count: number; first: Date; last: Date }> = {}
  for (const ev of rawEvents) {
    const pid = ev.entityId ?? ''
    if (!viewMap[pid]) viewMap[pid] = { count: 0, first: ev.occurredAt, last: ev.occurredAt }
    viewMap[pid].count++
    viewMap[pid].last = ev.occurredAt
  }

  // Fetch property info for view history
  const propertyIds = Object.keys(viewMap)
  const properties  = propertyIds.length
    ? await prisma.property.findMany({ where: { id: { in: propertyIds } } })
    : []

  const viewHistory = properties.map(p => ({
    property: p,
    count:    viewMap[p.id].count,
    firstSeen: viewMap[p.id].first,
    lastSeen:  viewMap[p.id].last,
  })).sort((a, b) => b.lastSeen.getTime() - a.lastSeen.getTime())

  // Buyer profile summary
  const allProps = interests.map(i => i.property)
  const summary  = computeBuyerProfile(allProps, viewMap, properties)

  return NextResponse.json({ interests, viewHistory, summary })
}

const addSchema = z.object({ propertyId: z.string(), notes: z.string().optional() })

export async function POST(request: Request, { params }: Params) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: contactId } = await params

  try {
    const body = await request.json()
    const { propertyId, notes } = addSchema.parse(body)

    const interest = await prisma.contactPropertyInterest.upsert({
      where:  { contactId_propertyId: { contactId, propertyId } },
      update: { source: 'manual', notes: notes ?? undefined },
      create: { contactId, propertyId, source: 'manual', notes },
    })
    return NextResponse.json(interest, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}

function computeBuyerProfile(
  interestProps: Array<{ id: string; propertyType: string; price: number; city: string }>,
  viewMap: Record<string, { count: number }>,
  viewProps: Array<{ id: string; propertyType: string; price: number; city: string }>
) {
  // Deduplicate by property ID — a property may appear in both interests and view history
  const seen = new Map<string, { propertyType: string; price: number; city: string }>()
  for (const p of [...interestProps, ...viewProps]) seen.set(p.id, p)
  const allProps = Array.from(seen.values())

  if (allProps.length === 0) return null

  // Most common property type
  const typeCounts: Record<string, number> = {}
  for (const p of allProps) typeCounts[p.propertyType] = (typeCounts[p.propertyType] ?? 0) + 1
  const topType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0]?.[0]

  // Price range
  const prices   = allProps.map(p => p.price).filter(Boolean)
  const minPrice = Math.min(...prices)
  const maxPrice = Math.max(...prices)

  // Most viewed city
  const cityCounts: Record<string, number> = {}
  for (const p of allProps) cityCounts[p.city] = (cityCounts[p.city] ?? 0) + 1
  const topCity = Object.entries(cityCounts).sort((a, b) => b[1] - a[1])[0]?.[0]

  return { topType, minPrice, maxPrice, topCity }
}
```

- [ ] **Step 2: Create DELETE route**

Create `app/api/contacts/[id]/property-interests/[propertyId]/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

interface Params { params: Promise<{ id: string; propertyId: string }> }

export async function DELETE(_req: Request, { params }: Params) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: contactId, propertyId } = await params

  await prisma.contactPropertyInterest.deleteMany({
    where: { contactId, propertyId },
  })

  return NextResponse.json({ success: true })
}
```

- [ ] **Step 3: Create assign-contact route (from listing side)**

Create `app/api/listings/[id]/assign-contact/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

interface Params { params: Promise<{ id: string }> }

const schema = z.object({ contactId: z.string(), notes: z.string().optional() })

export async function POST(request: Request, { params }: Params) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: propertyId } = await params

  try {
    const body = await request.json()
    const { contactId, notes } = schema.parse(body)

    const interest = await prisma.contactPropertyInterest.upsert({
      where:  { contactId_propertyId: { contactId, propertyId } },
      update: { source: 'manual', notes: notes ?? undefined },
      create: { contactId, propertyId, source: 'manual', notes },
    })
    return NextResponse.json(interest, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add app/api/contacts/[id]/property-interests/route.ts \
        "app/api/contacts/[id]/property-interests/[propertyId]/route.ts" \
        app/api/listings/[id]/assign-contact/route.ts
git commit -m "feat: add property interests API routes (GET/POST interests, DELETE, assign-contact)"
```

---

## Chunk 10: PropertyInterestsPanel Component

### Task 12: Build the PropertyInterestsPanel

**Files:**
- Create: `components/admin/contacts/PropertyInterestsPanel.tsx`

- [ ] **Step 1: Create the panel component**

Create `components/admin/contacts/PropertyInterestsPanel.tsx`:

```typescript
'use client'

import { useState, useEffect, useCallback } from 'react'
import { formatPrice } from '@/lib/utils'
import { Home, X, Plus, Eye, Link as LinkIcon } from 'lucide-react'

interface Property {
  id:           string
  title:        string
  address:      string
  city:         string
  price:        number
  propertyType: string
  images:       string | null
}

interface Interest {
  id:         string
  propertyId: string
  source:     string
  notes:      string | null
  updatedAt:  string
  property:   Property
}

interface ViewRecord {
  property:  Property
  count:     number
  firstSeen: string
  lastSeen:  string
}

interface Summary {
  topType:   string
  minPrice:  number
  maxPrice:  number
  topCity:   string
}

interface Props { contactId: string }

export function PropertyInterestsPanel({ contactId }: Props) {
  const [tab,         setTab]         = useState<'interests' | 'history'>('interests')
  const [interests,   setInterests]   = useState<Interest[]>([])
  const [viewHistory, setViewHistory] = useState<ViewRecord[]>([])
  const [summary,     setSummary]     = useState<Summary | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [showAdd,     setShowAdd]     = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Property[]>([])
  const [searching,   setSearching]   = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    const res  = await fetch(`/api/contacts/${contactId}/property-interests`)
    const data = await res.json()
    setInterests(data.interests ?? [])
    setViewHistory(data.viewHistory ?? [])
    setSummary(data.summary ?? null)
    setLoading(false)
  }, [contactId])

  useEffect(() => { loadData() }, [loadData])

  async function searchListings(q: string) {
    if (!q.trim()) { setSearchResults([]); return }
    setSearching(true)
    const res  = await fetch(`/api/listings?search=${encodeURIComponent(q)}&pageSize=8`)
    const data = await res.json()
    setSearchResults((data.data ?? []).map((l: { property: Property }) => l.property))
    setSearching(false)
  }

  async function addInterest(propertyId: string) {
    await fetch(`/api/contacts/${contactId}/property-interests`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ propertyId }),
    })
    setShowAdd(false)
    setSearchQuery('')
    setSearchResults([])
    loadData()
  }

  async function removeInterest(propertyId: string) {
    await fetch(`/api/contacts/${contactId}/property-interests/${propertyId}`, { method: 'DELETE' })
    loadData()
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const getFirstImage = (images: string | null): string => {
    try { return (JSON.parse(images ?? '[]') as string[])[0] ?? '/placeholder-property.jpg' }
    catch { return '/placeholder-property.jpg' }
  }

  return (
    <div className="rounded-xl border border-charcoal-100 overflow-hidden">
      {/* Summary header */}
      <div className="bg-charcoal-50 px-5 py-4 border-b border-charcoal-100">
        <h3 className="font-semibold text-charcoal-900 mb-1">Property Interests</h3>
        {summary ? (
          <p className="text-sm text-charcoal-500">
            Mostly viewing: <strong className="text-charcoal-700 capitalize">{summary.topType}</strong>
            {' · '}
            <strong className="text-charcoal-700">{formatPrice(summary.minPrice)}–{formatPrice(summary.maxPrice)}</strong>
            {' · '}
            <strong className="text-charcoal-700">{summary.topCity}</strong>
          </p>
        ) : (
          <p className="text-sm text-charcoal-400">No browsing data yet</p>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-charcoal-100">
        {(['interests', 'history'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2.5 text-sm font-medium capitalize transition-colors ${
              tab === t
                ? 'border-b-2 border-gold-500 text-gold-600'
                : 'text-charcoal-400 hover:text-charcoal-700'
            }`}
          >
            {t === 'interests' ? `Interests (${interests.length})` : `View History (${viewHistory.length})`}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-4">
        {loading ? (
          <p className="text-sm text-charcoal-400 text-center py-6">Loading…</p>
        ) : tab === 'interests' ? (
          <>
            <button
              onClick={() => setShowAdd(s => !s)}
              className="flex items-center gap-1.5 text-sm text-gold-600 hover:text-gold-700 mb-3 font-medium"
            >
              <Plus size={15} /> Add listing
            </button>

            {showAdd && (
              <div className="mb-4 rounded-lg border border-charcoal-200 p-3">
                <input
                  autoFocus
                  placeholder="Search listings…"
                  value={searchQuery}
                  onChange={e => { setSearchQuery(e.target.value); searchListings(e.target.value) }}
                  className="w-full text-sm border border-charcoal-200 rounded-lg px-3 py-2 mb-2 focus:outline-none focus:ring-2 focus:ring-gold-500"
                />
                {searching && <p className="text-xs text-charcoal-400">Searching…</p>}
                {searchResults.map(p => (
                  <button
                    key={p.id}
                    onClick={() => addInterest(p.id)}
                    className="flex items-start gap-2 w-full text-left rounded-lg hover:bg-charcoal-50 px-2 py-1.5 text-sm"
                  >
                    <Home size={14} className="shrink-0 text-charcoal-400 mt-0.5" />
                    <div>
                      <p className="text-charcoal-800 font-medium leading-tight">{p.address}, {p.city}</p>
                      <p className="text-charcoal-400 text-xs">{formatPrice(p.price)} · {p.propertyType}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {interests.length === 0 ? (
              <p className="text-sm text-charcoal-400 text-center py-4">No interests recorded yet</p>
            ) : (
              <div className="flex flex-col gap-2">
                {interests.map(i => (
                  <div key={i.id} className="flex items-start gap-3 rounded-lg bg-charcoal-50 px-3 py-2.5">
                    <img
                      src={getFirstImage(i.property.images)}
                      alt={i.property.title}
                      className="h-12 w-16 rounded-md object-cover shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-charcoal-900 truncate">{i.property.address}, {i.property.city}</p>
                      <p className="text-xs text-charcoal-500">{formatPrice(i.property.price)} · <span className="capitalize">{i.property.propertyType}</span></p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full font-medium ${
                          i.source === 'auto'
                            ? 'bg-blue-50 text-blue-600'
                            : 'bg-gold-50 text-gold-700'
                        }`}>
                          {i.source === 'auto' ? <Eye size={10} /> : <LinkIcon size={10} />}
                          {i.source === 'auto' ? 'Viewed' : 'Linked'}
                        </span>
                        <span className="text-xs text-charcoal-400">{formatDate(i.updatedAt)}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => removeInterest(i.propertyId)}
                      className="shrink-0 text-charcoal-300 hover:text-red-500 transition-colors mt-0.5"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          /* View History tab */
          viewHistory.length === 0 ? (
            <p className="text-sm text-charcoal-400 text-center py-4">No view history yet</p>
          ) : (
            <div className="flex flex-col gap-2">
              {viewHistory.map(v => (
                <div key={v.property.id} className="flex items-start gap-3 rounded-lg bg-charcoal-50 px-3 py-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-charcoal-900 truncate">{v.property.address}, {v.property.city}</p>
                    <p className="text-xs text-charcoal-500">{formatPrice(v.property.price)} · <span className="capitalize">{v.property.propertyType}</span></p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-semibold text-charcoal-700">{v.count} view{v.count !== 1 ? 's' : ''}</p>
                    <p className="text-xs text-charcoal-400">Last: {formatDate(v.lastSeen)}</p>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Export from components/admin index (if one exists)**

Check if `components/admin/index.ts` or similar barrel file exists. If yes, add the export:
```typescript
export { PropertyInterestsPanel } from './contacts/PropertyInterestsPanel'
```

If no barrel, skip this step.

- [ ] **Step 3: Add PropertyInterestsPanel to contact detail page**

In `app/admin/contacts/[id]/page.tsx`:

Add import at top:
```typescript
import { PropertyInterestsPanel } from '@/components/admin/contacts/PropertyInterestsPanel'
```

In the JSX, after the `<CommOptLogPanel .../>` and before the closing `</div>` of the left sidebar:
```tsx
<PropertyInterestsPanel contactId={id} />
```

- [ ] **Step 4: Commit**

```bash
git add components/admin/contacts/PropertyInterestsPanel.tsx app/admin/contacts/[id]/page.tsx
git commit -m "feat: add PropertyInterestsPanel to contact detail page"
```

---

## Chunk 11: Final Wiring & Smoke Test

### Task 13: End-to-end smoke test

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

- [ ] **Step 2: Test the gate flow**

1. Open an incognito window and navigate to `/listings`.
2. Click into 3+ separate listings. On the 3rd (or whichever the configured limit is), the gate modal should appear over blurred content.
3. Submit the form. The modal should switch to "Check your inbox" state.
4. Check the terminal for the verification link (SMTP not configured in dev).
5. Open the verification link. You should be redirected to the listing you were trying to view.
6. Navigate to other listings — no gate should appear.

- [ ] **Step 3: Test the contact panel**

1. Go to `/admin/contacts` and open the contact created by verification.
2. The "Property Interests" panel should appear in the left sidebar.
3. The "Interests" tab should show the listings the contact viewed (source: Viewed).
4. Click "Add listing", search for a listing, select it — it should appear as "Linked".
5. Click the X to remove a listing — it should disappear from the list.

- [ ] **Step 4: Test admin settings**

1. Go to `/admin/settings`.
2. Change the gate limit to 2, save. Within 60 seconds, opening a new incognito window should gate after 2 listings.
3. Toggle the gate off, save. Listings should be accessible without any gate.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: listing interest tracking and lead capture gate — complete"
```

---

## File Summary

| File | Action |
|------|--------|
| `prisma/schema.prisma` | Add `ContactPropertyInterest`, `SiteSettings`, `EmailVerificationToken` models + relation fields on `Contact` and `Property` |
| `middleware.ts` | Add gate cookie logic + `/api/admin` to PROTECTED_PATHS |
| `lib/site-settings.ts` | New: cached gate settings fetcher |
| `lib/gate-email.ts` | New: verification email sender |
| `app/api/admin/settings/route.ts` | New: GET + PATCH site settings |
| `app/api/gate/submit/route.ts` | New: gate form submission |
| `app/api/gate/resend/route.ts` | New: resend with 60s rate limit |
| `app/api/gate/verify/route.ts` | New: GET handler — validates token, upserts contact, sets cookies, redirects |
| `app/api/listings/route.ts` | Modified: add `search` and `pageSize` query params to GET handler |
| `app/api/contacts/[id]/property-interests/route.ts` | New: GET + POST interests |
| `app/api/contacts/[id]/property-interests/[propertyId]/route.ts` | New: DELETE interest |
| `app/api/listings/[id]/assign-contact/route.ts` | New: assign contact from listing |
| `app/api/behavior/route.ts` | Modified: upsert `ContactPropertyInterest` on `listing_view` |
| `app/(public)/listings/[id]/page.tsx` | Modified: gate logic + verified view tracking |
| `app/(public)/verify-email/page.tsx` | New: email verification landing page |
| `app/admin/settings/page.tsx` | Modified: add `LeadCaptureSettingsCard` |
| `components/admin/LeadCaptureSettingsCard.tsx` | New: gate settings UI |
| `components/admin/contacts/PropertyInterestsPanel.tsx` | New: contact profile panel |
| `components/public/ListingGateModal.tsx` | New: gate modal |
