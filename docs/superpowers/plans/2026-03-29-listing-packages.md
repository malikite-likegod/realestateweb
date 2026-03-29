# Listing Packages Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let agents browse the full MLS catalogue, curate listing packages for contacts, send branded emails with magic-link portal access, and track which listings each contact viewed.

**Architecture:** Three new Prisma models (`ListingPackage`, `ListingPackageItem`, `ListingPackageView`) back the feature. Admin UI lives at `/admin/listings/browse` and a new "Listings" tab on the contact detail page. Portal access uses a separate `portal_pkg_session` JWT cookie that bypasses the existing `accountStatus` gate.

**Tech Stack:** Next.js 16 App Router, Prisma + PostgreSQL, TypeScript, nodemailer (SMTP), JWT (existing `JWT_SECRET`), Tailwind CSS, existing `Card`/`Button`/`Input`/`Slideout` UI components.

---

## File Map

**New files:**
- `prisma/schema.prisma` — add 3 models + Contact relation
- `lib/pkg-session.ts` — `getPackageSession()` / `setPackageSessionCookie()` helpers
- `lib/communications/listing-package-email.ts` — `sendListingPackageEmail()`
- `app/api/admin/listings/browse/route.ts` — RESO search, no cap, admin-auth
- `app/api/listing-packages/route.ts` — GET list, POST create+send
- `app/api/listing-packages/[id]/route.ts` — GET detail with stats
- `app/api/listing-packages/[id]/items/route.ts` — POST add item
- `app/api/listing-packages/[id]/items/[itemId]/route.ts` — DELETE item
- `app/api/portal/packages/[token]/route.ts` — resolve token, set session, return package data
- `app/api/portal/packages/[token]/view/route.ts` — POST create view row
- `app/api/portal/packages/[token]/view/[viewId]/route.ts` — PATCH update durationSec
- `app/api/admin/contacts/[id]/saved-searches/route.ts` — POST create saved search for contact
- `app/api/admin/contacts/[id]/saved-searches/[searchId]/route.ts` — DELETE saved search
- `app/admin/listings/browse/page.tsx` — admin RESO browser page
- `components/admin/listing-browser/BrowseFilters.tsx` — filter bar component
- `components/admin/listing-browser/BrowseGrid.tsx` — selectable listing grid
- `components/admin/listing-browser/SelectionBar.tsx` — sticky bottom bar when listings selected
- `components/admin/listing-browser/SendToContactSlideOver.tsx` — compose + send package
- `components/admin/listing-browser/SaveSearchSlideOver.tsx` — name + assign search to contact
- `components/admin/ContactListingsTab.tsx` — packages + saved searches + activity tab
- `app/portal/packages/[token]/page.tsx` — client portal package view page

**Modified files:**
- `app/admin/contacts/[id]/page.tsx` — add "Listings" tab
- `app/portal/properties/[id]/page.tsx` — add package view tracking when `packageItemId` param present

---

## Chunk 1: Database Schema

### Task 1: Add Prisma models and migrate

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add the three new models to `prisma/schema.prisma`**

Open `prisma/schema.prisma`. Find the `Contact` model and add the relation field inside it:

```prisma
  listingPackages   ListingPackage[]
```

Then append the three new models at the end of the file (before the last closing brace if any, or just at the end):

```prisma
// ─── Listing Packages ─────────────────────────────────────────────────────────

model ListingPackage {
  id         String               @id @default(cuid())
  contactId  String
  contact    Contact              @relation(fields: [contactId], references: [id], onDelete: Cascade)
  title      String
  message    String?
  magicToken String               @unique @default(uuid())
  sentAt     DateTime?
  createdAt  DateTime             @default(now())
  updatedAt  DateTime             @updatedAt
  items      ListingPackageItem[]

  @@index([contactId])
  @@map("listing_packages")
}

model ListingPackageItem {
  id         String               @id @default(cuid())
  packageId  String
  package    ListingPackage       @relation(fields: [packageId], references: [id], onDelete: Cascade)
  listingKey String
  addedAt    DateTime             @default(now())
  views      ListingPackageView[]

  @@index([packageId])
  @@unique([packageId, listingKey])
  @@map("listing_package_items")
}

model ListingPackageView {
  id          String             @id @default(cuid())
  itemId      String
  item        ListingPackageItem @relation(fields: [itemId], references: [id], onDelete: Cascade)
  contactId   String
  viewedAt    DateTime           @default(now())
  durationSec Int?

  @@index([itemId])
  @@index([contactId])
  @@map("listing_package_views")
}
```

- [ ] **Step 2: Generate and apply migration**

```bash
npx prisma migrate dev --name add_listing_packages
```

Expected: Migration created and applied, Prisma client regenerated. No errors.

- [ ] **Step 3: Verify tables exist**

```bash
npx prisma studio
```

Check that `listing_packages`, `listing_package_items`, `listing_package_views` tables appear. Then close Studio.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add ListingPackage, ListingPackageItem, ListingPackageView models"
```

---

## Chunk 2: Package Session Helper

### Task 2: Create `lib/pkg-session.ts`

**Files:**
- Create: `lib/pkg-session.ts`

This is a self-contained JWT helper for the magic-link portal session. It does NOT touch `lib/auth.ts` to keep the flows separate.

- [ ] **Step 1: Create `lib/pkg-session.ts`**

```typescript
import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

const COOKIE_NAME = 'portal_pkg_session'
const secret = new TextEncoder().encode(process.env.JWT_SECRET ?? 'dev-secret')

export interface PkgSession {
  contactId: string
  packageId: string
}

export async function setPackageSessionCookie(session: PkgSession): Promise<void> {
  const token = await new SignJWT(session)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .sign(secret)

  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  })
}

export async function getPackageSession(): Promise<PkgSession | null> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE_NAME)?.value
    if (!token) return null
    const { payload } = await jwtVerify(token, secret)
    return payload as unknown as PkgSession
  } catch {
    return null
  }
}
```

Note: `jose` is already a dependency (used by existing auth). Verify with:

```bash
grep '"jose"' package.json
```

If missing, install: `npm install jose`

- [ ] **Step 2: Verify `jose` is available**

```bash
node -e "require('jose'); console.log('ok')"
```

Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add lib/pkg-session.ts
git commit -m "feat: add portal_pkg_session JWT helper for magic-link package access"
```

---

## Chunk 3: Admin API Routes

### Task 3: RESO browse endpoint (no cap)

**Files:**
- Create: `app/api/admin/listings/browse/route.ts`

Study `app/api/portal/listings/route.ts` and `app/api/search/route.ts` to understand how RESO queries are built. This endpoint mirrors that logic but without the 100-record cap and with admin auth.

- [ ] **Step 1: Create `app/api/admin/listings/browse/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const page     = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const pageSize = 24
  const city          = searchParams.get('city')          ?? ''
  const community     = searchParams.get('community')     ?? ''
  const propertyType  = searchParams.get('propertyType')  ?? ''
  const listingType   = searchParams.get('listingType')   ?? ''
  const minPrice      = searchParams.get('minPrice')      ? parseInt(searchParams.get('minPrice')!) : undefined
  const maxPrice      = searchParams.get('maxPrice')      ? parseInt(searchParams.get('maxPrice')!) : undefined
  const minBeds       = searchParams.get('minBeds')       ? parseInt(searchParams.get('minBeds')!)  : undefined

  const where: Record<string, unknown> = { standardStatus: 'Active' }

  if (city)         where.city            = { contains: city,         mode: 'insensitive' }
  if (community)    where.communityName   = { contains: community,    mode: 'insensitive' }
  if (propertyType) where.propertyType    = { contains: propertyType, mode: 'insensitive' }
  if (listingType)  where.listingType     = listingType
  if (minBeds)      where.bedroomsTotal   = { gte: minBeds }
  if (minPrice || maxPrice) {
    where.listPrice = {}
    if (minPrice) (where.listPrice as Record<string, number>).gte = minPrice
    if (maxPrice) (where.listPrice as Record<string, number>).lte = maxPrice
  }

  const [total, properties] = await Promise.all([
    prisma.resoProperty.count({ where }),
    prisma.resoProperty.findMany({
      where,
      orderBy: { listPrice: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        listingKey: true,
        unparsedAddress: true,
        city: true,
        listPrice: true,
        bedroomsTotal: true,
        bathroomsTotalInteger: true,
        livingArea: true,
        propertyType: true,
        listingType: true,
        media: true,
        standardStatus: true,
      },
    }),
  ])

  return NextResponse.json({
    data: properties,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  })
}
```

- [ ] **Step 2: Smoke-test with curl (replace TOKEN with a valid admin session cookie)**

```bash
curl -s "http://localhost:3000/api/admin/listings/browse?page=1&city=Toronto" \
  -H "Cookie: auth_token=TOKEN" | head -c 500
```

Expected: JSON with `data` array and `total` count.

- [ ] **Step 3: Commit**

```bash
git add app/api/admin/listings/browse/route.ts
git commit -m "feat: add admin RESO listing browse endpoint (no record cap)"
```

---

### Task 4: Listing packages CRUD endpoints

**Files:**
- Create: `app/api/listing-packages/route.ts`
- Create: `app/api/listing-packages/[id]/route.ts`
- Create: `app/api/listing-packages/[id]/items/route.ts`
- Create: `app/api/listing-packages/[id]/items/[itemId]/route.ts`

- [ ] **Step 1: Create `app/api/listing-packages/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendListingPackageEmail } from '@/lib/communications/listing-package-email'

const createSchema = z.object({
  contactId:   z.string(),
  title:       z.string().min(1),
  message:     z.string().optional(),
  listingKeys: z.array(z.string()).min(1),
  send:        z.boolean().default(false),
})

export async function GET(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const contactId = searchParams.get('contactId')
  if (!contactId) return NextResponse.json({ error: 'contactId required' }, { status: 400 })

  const packages = await prisma.listingPackage.findMany({
    where: { contactId },
    orderBy: { createdAt: 'desc' },
    include: {
      items: {
        include: { views: { select: { id: true } } },
      },
    },
  })

  return NextResponse.json({ data: packages })
}

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: z.infer<typeof createSchema>
  try {
    body = createSchema.parse(await request.json())
  } catch (e) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const contact = await prisma.contact.findUnique({ where: { id: body.contactId } })
  if (!contact) return NextResponse.json({ error: 'Contact not found' }, { status: 404 })

  if (body.send && contact.emailOptOut) {
    return NextResponse.json({ error: 'This contact has opted out of email' }, { status: 422 })
  }

  const pkg = await prisma.listingPackage.create({
    data: {
      contactId: body.contactId,
      title:     body.title,
      message:   body.message ?? null,
      sentAt:    body.send ? new Date() : null,
      items: {
        create: body.listingKeys.map(listingKey => ({ listingKey })),
      },
    },
    include: { items: true },
  })

  if (body.send && contact.email) {
    try {
      await sendListingPackageEmail({ pkg, contact })
    } catch {
      // Mark as unsent — admin can retry
      await prisma.listingPackage.update({
        where: { id: pkg.id },
        data:  { sentAt: null },
      })
      return NextResponse.json({ error: 'Package saved but email failed. Retry from contact Listings tab.' }, { status: 500 })
    }
  }

  return NextResponse.json({ data: pkg }, { status: 201 })
}
```

- [ ] **Step 2: Create `app/api/listing-packages/[id]/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const pkg = await prisma.listingPackage.findUnique({
    where: { id },
    include: {
      items: {
        include: {
          views: {
            orderBy: { viewedAt: 'desc' },
            take: 1,
            select: { viewedAt: true, durationSec: true },
          },
        },
      },
    },
  })

  if (!pkg) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ data: pkg })
}
```

- [ ] **Step 3: Create `app/api/listing-packages/[id]/items/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const schema = z.object({ listingKey: z.string().min(1) })

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: z.infer<typeof schema>
  try { body = schema.parse(await request.json()) }
  catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }) }

  const pkg = await prisma.listingPackage.findUnique({ where: { id } })
  if (!pkg) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  try {
    const item = await prisma.listingPackageItem.create({
      data: { packageId: id, listingKey: body.listingKey },
    })
    return NextResponse.json({ data: item }, { status: 201 })
  } catch (e: unknown) {
    if ((e as { code?: string }).code === 'P2002') {
      return NextResponse.json({ error: 'Already in this package' }, { status: 409 })
    }
    throw e
  }
}
```

- [ ] **Step 4: Create `app/api/listing-packages/[id]/items/[itemId]/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { id, itemId } = await params
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const item = await prisma.listingPackageItem.findFirst({
    where: { id: itemId, packageId: id },
  })
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.listingPackageItem.delete({ where: { id: itemId } })
  return new Response(null, { status: 204 })
}
```

- [ ] **Step 5: Commit**

```bash
git add app/api/listing-packages/
git commit -m "feat: add listing-packages CRUD API routes"
```

---

### Task 5: Admin saved searches endpoint

**Files:**
- Create: `app/api/admin/contacts/[id]/saved-searches/route.ts`
- Create: `app/api/admin/contacts/[id]/saved-searches/[searchId]/route.ts`

- [ ] **Step 1: Create `app/api/admin/contacts/[id]/saved-searches/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const schema = z.object({
  name:    z.string().min(1),
  filters: z.record(z.unknown()),
})

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: z.infer<typeof schema>
  try { body = schema.parse(await request.json()) }
  catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }) }

  const contact = await prisma.contact.findUnique({ where: { id } })
  if (!contact) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const search = await prisma.savedSearch.create({
    data: {
      name:      body.name,
      filters:   JSON.stringify(body.filters),
      contactId: id,
    },
  })

  return NextResponse.json({ data: search }, { status: 201 })
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const searches = await prisma.savedSearch.findMany({
    where:   { contactId: id },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ data: searches })
}
```

- [ ] **Step 2: Create `app/api/admin/contacts/[id]/saved-searches/[searchId]/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; searchId: string }> }
) {
  const { id, searchId } = await params
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const search = await prisma.savedSearch.findFirst({
    where: { id: searchId, contactId: id },
  })
  if (!search) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.savedSearch.delete({ where: { id: searchId } })
  return new Response(null, { status: 204 })
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/admin/contacts/
git commit -m "feat: add admin endpoints for managing contact saved searches"
```

---

## Chunk 4: Portal API Routes

### Task 6: Token resolution endpoint

**Files:**
- Create: `app/api/portal/packages/[token]/route.ts`

- [ ] **Step 1: Create `app/api/portal/packages/[token]/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { setPackageSessionCookie } from '@/lib/pkg-session'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const pkg = await prisma.listingPackage.findUnique({
    where: { magicToken: token },
    include: {
      contact: { select: { id: true, firstName: true, lastName: true } },
      items: {
        include: {
          views: { select: { id: true }, take: 1 },
        },
        orderBy: { addedAt: 'asc' },
      },
    },
  })

  if (!pkg) {
    return NextResponse.json({ error: 'Invalid or expired link' }, { status: 404 })
  }

  // Fetch RESO property data for each item
  const listingKeys = pkg.items.map(i => i.listingKey)
  const properties  = await prisma.resoProperty.findMany({
    where: { listingKey: { in: listingKeys } },
    select: {
      listingKey: true,
      unparsedAddress: true,
      city: true,
      listPrice: true,
      bedroomsTotal: true,
      bathroomsTotalInteger: true,
      livingArea: true,
      media: true,
      standardStatus: true,
    },
  })

  const propMap = Object.fromEntries(properties.map(p => [p.listingKey, p]))

  const items = pkg.items.map(item => ({
    ...item,
    property: propMap[item.listingKey] ?? null,
  }))

  await setPackageSessionCookie({ contactId: pkg.contactId, packageId: pkg.id })

  return NextResponse.json({
    data: {
      id:        pkg.id,
      title:     pkg.title,
      message:   pkg.message,
      contact:   pkg.contact,
      magicToken: pkg.magicToken,
      items,
    },
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/portal/packages/
git commit -m "feat: add portal package token-resolution endpoint"
```

---

### Task 7: View tracking endpoints

**Files:**
- Create: `app/api/portal/packages/[token]/view/route.ts`
- Create: `app/api/portal/packages/[token]/view/[viewId]/route.ts`

- [ ] **Step 1: Create `app/api/portal/packages/[token]/view/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'

const schema = z.object({ itemId: z.string() })

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  let body: z.infer<typeof schema>
  try { body = schema.parse(await request.json()) }
  catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }) }

  // Verify ownership: item must belong to the package identified by this token
  const item = await prisma.listingPackageItem.findFirst({
    where: { id: body.itemId, package: { magicToken: token } },
    include: { package: { select: { contactId: true } } },
  })

  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const view = await prisma.listingPackageView.create({
    data: {
      itemId:    item.id,
      contactId: item.package.contactId, // server-resolved, never from client
    },
  })

  return NextResponse.json({ viewId: view.id }, { status: 201 })
}
```

- [ ] **Step 2: Create `app/api/portal/packages/[token]/view/[viewId]/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'

const schema = z.object({ durationSec: z.number().int().min(0) })

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ token: string; viewId: string }> }
) {
  const { token, viewId } = await params
  let body: z.infer<typeof schema>
  try { body = schema.parse(await request.json()) }
  catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }) }

  // Verify the view belongs to this token's package
  const view = await prisma.listingPackageView.findFirst({
    where: {
      id:   viewId,
      item: { package: { magicToken: token } },
    },
  })

  if (!view) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.listingPackageView.update({
    where: { id: viewId },
    data:  { durationSec: body.durationSec },
  })

  return new Response(null, { status: 204 })
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/portal/packages/[token]/view/
git commit -m "feat: add portal package view tracking endpoints (POST create, PATCH duration)"
```

---

## Chunk 5: Email

### Task 8: Listing package email function

**Files:**
- Create: `lib/communications/listing-package-email.ts`

Study `lib/communications/email-service.ts` to understand `sendViaSmtp` signature before writing this file.

- [ ] **Step 1: Create `lib/communications/listing-package-email.ts`**

```typescript
import { prisma } from '@/lib/prisma'

interface SendPackageEmailInput {
  pkg: {
    id:         string
    title:      string
    message:    string | null
    magicToken: string
    items: Array<{
      id:         string
      listingKey: string
      property?: {
        unparsedAddress: string | null
        city:            string | null
        listPrice:       number | null
        bedroomsTotal:   number | null
        bathroomsTotalInteger: number | null
        livingArea:      number | null
        media:           string | null
      } | null
    }>
  }
  contact: {
    id:        string
    firstName: string | null
    lastName:  string | null
    email:     string | null
    emailOptOut: boolean
  }
}

function getFirstPhoto(mediaJson: string | null): string {
  try {
    const arr = JSON.parse(mediaJson ?? '[]')
    return arr[0]?.MediaURL ?? ''
  } catch {
    return ''
  }
}

function formatPrice(price: number | null): string {
  if (!price) return 'Price on request'
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(price)
}

function buildListingCard(item: SendPackageEmailInput['pkg']['items'][0], baseUrl: string, token: string): string {
  const p = item.property
  const photo   = p ? getFirstPhoto(p.media) : ''
  const address = p?.unparsedAddress ?? 'Address unavailable'
  const city    = p?.city ?? ''
  const price   = formatPrice(p?.listPrice ?? null)
  const beds    = p?.bedroomsTotal ?? '—'
  const baths   = p?.bathroomsTotalInteger ?? '—'
  const sqft    = p?.livingArea ? `${p.livingArea.toLocaleString()} sqft` : ''
  const link    = `${baseUrl}/portal/packages/${token}?open=${item.listingKey}`

  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;margin-bottom:16px;overflow:hidden;">
      <tr>
        ${photo ? `<td width="180" style="vertical-align:top;"><img src="${photo}" width="180" height="120" alt="" style="display:block;object-fit:cover;" /></td>` : ''}
        <td style="padding:16px;vertical-align:top;">
          <p style="margin:0 0 4px;font-weight:600;font-size:15px;color:#111827;">${address}${city ? `, ${city}` : ''}</p>
          <p style="margin:0 0 8px;font-size:18px;font-weight:700;color:#92763a;">${price}</p>
          <p style="margin:0 0 12px;font-size:13px;color:#6b7280;">${beds} bed · ${baths} bath${sqft ? ` · ${sqft}` : ''}</p>
          <a href="${link}" style="display:inline-block;padding:8px 16px;background:#92763a;color:#fff;text-decoration:none;border-radius:6px;font-size:13px;font-weight:600;">View Listing</a>
        </td>
      </tr>
    </table>`
}

export async function sendListingPackageEmail({ pkg, contact }: SendPackageEmailInput): Promise<void> {
  if (!contact.email) throw new Error('Contact has no email address')
  if (contact.emailOptOut) throw new Error('Contact has opted out of email')

  const baseUrl    = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const portalLink = `${baseUrl}/portal/packages/${pkg.magicToken}`
  const firstName  = contact.firstName ?? 'there'

  // Fetch RESO data for items that don't already have it
  const listingKeys = pkg.items.map(i => i.listingKey)
  const properties  = await prisma.resoProperty.findMany({
    where: { listingKey: { in: listingKeys } },
    select: {
      listingKey: true, unparsedAddress: true, city: true,
      listPrice: true, bedroomsTotal: true, bathroomsTotalInteger: true,
      livingArea: true, media: true,
    },
  })
  const propMap = Object.fromEntries(properties.map(p => [p.listingKey, p]))
  const itemsWithProps = pkg.items.map(i => ({ ...i, property: i.property ?? propMap[i.listingKey] ?? null }))

  const listingCards = itemsWithProps.map(item => buildListingCard(item, baseUrl, pkg.magicToken)).join('')

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1);">

        <!-- Header -->
        <tr><td style="background:#111827;padding:24px 32px;">
          <p style="margin:0;color:#fff;font-size:20px;font-weight:700;">Michael Taylor Realty</p>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:32px;">
          <p style="margin:0 0 8px;font-size:16px;color:#111827;">Hi ${firstName},</p>
          ${pkg.message ? `<p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;">${pkg.message}</p>` : ''}

          <!-- View all CTA -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
            <tr><td align="center" style="background:#f3f4f6;border-radius:8px;padding:20px;">
              <p style="margin:0 0 12px;font-size:15px;color:#374151;font-weight:500;">I've selected ${itemsWithProps.length} listing${itemsWithProps.length !== 1 ? 's' : ''} for you</p>
              <a href="${portalLink}" style="display:inline-block;padding:12px 28px;background:#92763a;color:#fff;text-decoration:none;border-radius:8px;font-size:15px;font-weight:700;">
                View All ${itemsWithProps.length} Listings in Your Portal →
              </a>
            </td></tr>
          </table>

          <!-- Listing cards -->
          ${listingCards}
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:20px 32px;border-top:1px solid #e5e7eb;">
          <p style="margin:0;font-size:12px;color:#9ca3af;">You are receiving this because your agent shared listings with you. If you have questions, reply to this email or contact your agent directly.</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`

  // Use nodemailer directly (same pattern as email-service.ts)
  const nodemailer = (await import('nodemailer')).default
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT ?? '587'),
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  })

  await transporter.sendMail({
    from:    process.env.SMTP_FROM ?? process.env.SMTP_USER,
    to:      contact.email,
    subject: pkg.title,
    html,
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/communications/listing-package-email.ts
git commit -m "feat: add sendListingPackageEmail function with branded HTML template"
```

---

## Chunk 6: Admin UI — Listing Browser

### Task 9: Filter bar and selectable grid components

**Files:**
- Create: `components/admin/listing-browser/BrowseFilters.tsx`
- Create: `components/admin/listing-browser/BrowseGrid.tsx`
- Create: `components/admin/listing-browser/SelectionBar.tsx`

- [ ] **Step 1: Create `components/admin/listing-browser/BrowseFilters.tsx`**

```tsx
'use client'
import { Input, Button } from '@/components/ui'

export interface BrowseFilterValues {
  city:         string
  community:    string
  propertyType: string
  listingType:  string
  minPrice:     string
  maxPrice:     string
  minBeds:      string
}

interface Props {
  filters:   BrowseFilterValues
  onChange:  (f: BrowseFilterValues) => void
  onSearch:  () => void
}

export function BrowseFilters({ filters, onChange, onSearch }: Props) {
  const set = (key: keyof BrowseFilterValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    onChange({ ...filters, [key]: e.target.value })

  return (
    <div className="flex flex-wrap gap-3 items-end p-4 bg-white border-b border-charcoal-100">
      <Input label="City"         value={filters.city}         onChange={set('city')}         className="w-36" />
      <Input label="Community"    value={filters.community}    onChange={set('community')}    className="w-36" />
      <Input label="Min Price"    value={filters.minPrice}     onChange={set('minPrice')}     className="w-28" type="number" />
      <Input label="Max Price"    value={filters.maxPrice}     onChange={set('maxPrice')}     className="w-28" type="number" />
      <Input label="Min Beds"     value={filters.minBeds}      onChange={set('minBeds')}      className="w-20" type="number" />
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-charcoal-600">Listing Type</label>
        <select value={filters.listingType} onChange={set('listingType')} className="border border-charcoal-200 rounded-md px-3 py-2 text-sm">
          <option value="">Any</option>
          <option value="For Sale">For Sale</option>
          <option value="For Lease">For Lease</option>
        </select>
      </div>
      <Button variant="primary" onClick={onSearch} className="self-end">Search</Button>
    </div>
  )
}
```

- [ ] **Step 2: Create `components/admin/listing-browser/BrowseGrid.tsx`**

```tsx
'use client'

interface ResoListing {
  listingKey:           string
  unparsedAddress:      string | null
  city:                 string | null
  listPrice:            number | null
  bedroomsTotal:        number | null
  bathroomsTotalInteger: number | null
  media:                string | null
}

interface Props {
  listings:  ResoListing[]
  selected:  Set<string>
  onToggle:  (key: string) => void
}

function getFirstPhoto(media: string | null): string {
  try { return JSON.parse(media ?? '[]')[0]?.MediaURL ?? '' } catch { return '' }
}

function formatPrice(price: number | null): string {
  if (!price) return 'Price on request'
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(price)
}

export function BrowseGrid({ listings, selected, onToggle }: Props) {
  if (listings.length === 0) return <p className="p-8 text-center text-charcoal-400">No listings found.</p>

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4">
      {listings.map(l => {
        const isSelected = selected.has(l.listingKey)
        const photo = getFirstPhoto(l.media)
        return (
          <div
            key={l.listingKey}
            onClick={() => onToggle(l.listingKey)}
            className={`cursor-pointer rounded-lg border-2 overflow-hidden transition-all ${isSelected ? 'border-gold-500 ring-2 ring-gold-300' : 'border-charcoal-100 hover:border-charcoal-300'}`}
          >
            {photo
              ? <img src={photo} alt="" className="w-full h-40 object-cover" />
              : <div className="w-full h-40 bg-charcoal-100 flex items-center justify-center text-charcoal-400 text-xs">No photo</div>
            }
            <div className="p-3">
              <p className="text-sm font-semibold text-charcoal-900 truncate">{l.unparsedAddress ?? 'Address TBD'}</p>
              <p className="text-xs text-charcoal-500">{l.city ?? ''}</p>
              <p className="text-base font-bold text-gold-600 mt-1">{formatPrice(l.listPrice)}</p>
              <p className="text-xs text-charcoal-400">{l.bedroomsTotal ?? '—'} bd · {l.bathroomsTotalInteger ?? '—'} ba</p>
              {isSelected && <p className="mt-2 text-xs font-semibold text-gold-600">✓ Selected</p>}
            </div>
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 3: Create `components/admin/listing-browser/SelectionBar.tsx`**

```tsx
'use client'
import { Button } from '@/components/ui'

interface Props {
  count:          number
  onSend:         () => void
  onSaveSearch:   () => void
  onClear:        () => void
}

export function SelectionBar({ count, onSend, onSaveSearch, onClear }: Props) {
  if (count === 0) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-charcoal-900 text-white px-6 py-4 flex items-center justify-between shadow-lg">
      <p className="font-medium">{count} listing{count !== 1 ? 's' : ''} selected</p>
      <div className="flex gap-3">
        <Button variant="outline" onClick={onSaveSearch} className="text-white border-white hover:bg-charcoal-700">Save Search for Contact</Button>
        <Button variant="gold" onClick={onSend}>Send to Contact</Button>
        <button onClick={onClear} className="text-charcoal-400 hover:text-white text-sm ml-2">Clear</button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add components/admin/listing-browser/
git commit -m "feat: add BrowseFilters, BrowseGrid, SelectionBar components"
```

---

### Task 10: Slide-overs and browse page

**Files:**
- Create: `components/admin/listing-browser/SendToContactSlideOver.tsx`
- Create: `components/admin/listing-browser/SaveSearchSlideOver.tsx`
- Create: `app/admin/listings/browse/page.tsx`

- [ ] **Step 1: Create `components/admin/listing-browser/SendToContactSlideOver.tsx`**

```tsx
'use client'
import { useState } from 'react'
import { Button, Input, Textarea } from '@/components/ui'

interface Props {
  listingKeys:    string[]
  preContactId?:  string
  preContactName?: string
  onClose:        () => void
  onSent:         () => void
}

export function SendToContactSlideOver({ listingKeys, preContactId, preContactName, onClose, onSent }: Props) {
  const [contactId,   setContactId]   = useState(preContactId ?? '')
  const [contactName, setContactName] = useState(preContactName ?? '')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<{ id: string; firstName: string; lastName: string; email: string }[]>([])
  const [title,   setTitle]   = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  async function searchContacts(q: string) {
    if (q.length < 2) return
    const res = await fetch(`/api/contacts?search=${encodeURIComponent(q)}&pageSize=8`)
    const json = await res.json()
    setSearchResults(json.data ?? [])
  }

  async function handleSend() {
    if (!contactId) { setError('Please select a contact'); return }
    if (!title)     { setError('Please enter a title'); return }
    setLoading(true)
    setError('')
    const res = await fetch('/api/listing-packages', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ contactId, title, message, listingKeys, send: true }),
    })
    const json = await res.json()
    setLoading(false)
    if (!res.ok) { setError(json.error ?? 'Failed to send'); return }
    onSent()
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white h-full shadow-xl flex flex-col">
        <div className="p-6 border-b">
          <h2 className="text-lg font-semibold">Send {listingKeys.length} Listing{listingKeys.length !== 1 ? 's' : ''} to Contact</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
          {!preContactId && (
            <div>
              <Input
                label="Search Contact"
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); searchContacts(e.target.value) }}
                placeholder="Name or email..."
              />
              {searchResults.length > 0 && (
                <div className="border border-charcoal-200 rounded-md mt-1 divide-y">
                  {searchResults.map(c => (
                    <button
                      key={c.id}
                      className="w-full text-left px-3 py-2 hover:bg-charcoal-50 text-sm"
                      onClick={() => { setContactId(c.id); setContactName(`${c.firstName} ${c.lastName}`); setSearchResults([]) }}
                    >
                      {c.firstName} {c.lastName} <span className="text-charcoal-400">{c.email}</span>
                    </button>
                  ))}
                </div>
              )}
              {contactName && <p className="text-sm text-green-600 mt-1">Selected: {contactName}</p>}
            </div>
          )}
          {preContactName && <p className="text-sm font-medium text-charcoal-700">Sending to: {preContactName}</p>}
          <Input label="Package Title" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Homes matching your criteria" />
          <Textarea label="Message (optional)" value={message} onChange={e => setMessage(e.target.value)} rows={4} placeholder="Hi Sarah, here are a few homes I think you'll love..." />
          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>
        <div className="p-6 border-t flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
          <Button variant="gold" onClick={handleSend} loading={loading} className="flex-1">Send Email</Button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create `components/admin/listing-browser/SaveSearchSlideOver.tsx`**

```tsx
'use client'
import { useState } from 'react'
import { Button, Input } from '@/components/ui'
import type { BrowseFilterValues } from './BrowseFilters'

interface Props {
  filters:        BrowseFilterValues
  preContactId?:  string
  preContactName?: string
  onClose:        () => void
  onSaved:        () => void
}

export function SaveSearchSlideOver({ filters, preContactId, preContactName, onClose, onSaved }: Props) {
  const [contactId,   setContactId]   = useState(preContactId ?? '')
  const [contactName, setContactName] = useState(preContactName ?? '')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<{ id: string; firstName: string; lastName: string }[]>([])
  const [name,    setName]    = useState('')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  async function searchContacts(q: string) {
    if (q.length < 2) return
    const res = await fetch(`/api/contacts?search=${encodeURIComponent(q)}&pageSize=8`)
    const json = await res.json()
    setSearchResults(json.data ?? [])
  }

  async function handleSave() {
    if (!contactId) { setError('Please select a contact'); return }
    if (!name)      { setError('Please enter a name'); return }
    setLoading(true)
    setError('')
    const res = await fetch(`/api/admin/contacts/${contactId}/saved-searches`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ name, filters }),
    })
    const json = await res.json()
    setLoading(false)
    if (!res.ok) { setError(json.error ?? 'Failed to save'); return }
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white h-full shadow-xl flex flex-col">
        <div className="p-6 border-b">
          <h2 className="text-lg font-semibold">Save Search for Contact</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
          {!preContactId && (
            <div>
              <Input
                label="Search Contact"
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); searchContacts(e.target.value) }}
                placeholder="Name or email..."
              />
              {searchResults.length > 0 && (
                <div className="border border-charcoal-200 rounded-md mt-1 divide-y">
                  {searchResults.map(c => (
                    <button
                      key={c.id}
                      className="w-full text-left px-3 py-2 hover:bg-charcoal-50 text-sm"
                      onClick={() => { setContactId(c.id); setContactName(`${c.firstName} ${c.lastName}`); setSearchResults([]) }}
                    >
                      {c.firstName} {c.lastName}
                    </button>
                  ))}
                </div>
              )}
              {contactName && <p className="text-sm text-green-600 mt-1">Selected: {contactName}</p>}
            </div>
          )}
          {preContactName && <p className="text-sm font-medium text-charcoal-700">For: {preContactName}</p>}
          <div className="p-3 bg-charcoal-50 rounded-md text-xs text-charcoal-600">
            <p className="font-medium mb-1">Current filters:</p>
            {Object.entries(filters).filter(([, v]) => v).map(([k, v]) => (
              <p key={k}>{k}: {v}</p>
            ))}
          </div>
          <Input label="Search Name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Toronto Condos under $700K" />
          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>
        <div className="p-6 border-t flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
          <Button variant="primary" onClick={handleSave} loading={loading} className="flex-1">Save Search</Button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create `app/admin/listings/browse/page.tsx`**

```tsx
'use client'
import { useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { DashboardLayout } from '@/components/dashboard'
import { PageHeader } from '@/components/layout'
import { BrowseFilters, type BrowseFilterValues } from '@/components/admin/listing-browser/BrowseFilters'
import { BrowseGrid } from '@/components/admin/listing-browser/BrowseGrid'
import { SelectionBar } from '@/components/admin/listing-browser/SelectionBar'
import { SendToContactSlideOver } from '@/components/admin/listing-browser/SendToContactSlideOver'
import { SaveSearchSlideOver } from '@/components/admin/listing-browser/SaveSearchSlideOver'
import { Button } from '@/components/ui'

const emptyFilters: BrowseFilterValues = {
  city: '', community: '', propertyType: '', listingType: '', minPrice: '', maxPrice: '', minBeds: '',
}

interface ResoListing {
  listingKey: string
  unparsedAddress: string | null
  city: string | null
  listPrice: number | null
  bedroomsTotal: number | null
  bathroomsTotalInteger: number | null
  media: string | null
}

export default function BrowsePage() {
  const searchParams = useSearchParams()
  const preContactId   = searchParams.get('contactId') ?? undefined
  const preContactName = searchParams.get('contactName') ?? undefined

  const [filters,     setFilters]     = useState<BrowseFilterValues>(emptyFilters)
  const [listings,    setListings]    = useState<ResoListing[]>([])
  const [page,        setPage]        = useState(1)
  const [totalPages,  setTotalPages]  = useState(0)
  const [loading,     setLoading]     = useState(false)
  const [selected,    setSelected]    = useState<Set<string>>(new Set())
  const [showSend,    setShowSend]    = useState(false)
  const [showSearch,  setShowSearch]  = useState(false)

  const fetchListings = useCallback(async (f: BrowseFilterValues, p: number) => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(p) })
    if (f.city)         params.set('city',         f.city)
    if (f.community)    params.set('community',    f.community)
    if (f.propertyType) params.set('propertyType', f.propertyType)
    if (f.listingType)  params.set('listingType',  f.listingType)
    if (f.minPrice)     params.set('minPrice',     f.minPrice)
    if (f.maxPrice)     params.set('maxPrice',     f.maxPrice)
    if (f.minBeds)      params.set('minBeds',      f.minBeds)
    const res  = await fetch(`/api/admin/listings/browse?${params}`)
    const json = await res.json()
    setListings(json.data ?? [])
    setTotalPages(json.totalPages ?? 0)
    setLoading(false)
  }, [])

  function handleSearch() { setPage(1); fetchListings(filters, 1) }

  function toggleListing(key: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  // Need user session for DashboardLayout — fetch via server component wrapper or pass via props
  // For simplicity, get session client-side via a lightweight endpoint
  return (
    <div className="flex flex-col h-screen">
      <div className="flex items-center justify-between px-6 py-4 border-b">
        <div>
          <h1 className="text-xl font-semibold text-charcoal-900">Browse MLS Listings</h1>
          {preContactName && <p className="text-sm text-charcoal-500">Sending to: {preContactName}</p>}
        </div>
        <a href="/admin/listings" className="text-sm text-charcoal-500 hover:text-charcoal-900">← Back to Listings</a>
      </div>

      <BrowseFilters filters={filters} onChange={setFilters} onSearch={handleSearch} />

      <div className="flex-1 overflow-y-auto pb-24">
        {loading
          ? <p className="p-8 text-center text-charcoal-400">Loading...</p>
          : <BrowseGrid listings={listings} selected={selected} onToggle={toggleListing} />
        }
        {totalPages > 1 && (
          <div className="flex justify-center gap-2 py-6">
            <Button variant="outline" disabled={page <= 1} onClick={() => { setPage(p => p - 1); fetchListings(filters, page - 1) }}>Previous</Button>
            <span className="flex items-center text-sm text-charcoal-500">Page {page} of {totalPages}</span>
            <Button variant="outline" disabled={page >= totalPages} onClick={() => { setPage(p => p + 1); fetchListings(filters, page + 1) }}>Next</Button>
          </div>
        )}
      </div>

      <SelectionBar
        count={selected.size}
        onSend={() => setShowSend(true)}
        onSaveSearch={() => setShowSearch(true)}
        onClear={() => setSelected(new Set())}
      />

      {showSend && (
        <SendToContactSlideOver
          listingKeys={[...selected]}
          preContactId={preContactId}
          preContactName={preContactName}
          onClose={() => setShowSend(false)}
          onSent={() => { setShowSend(false); setSelected(new Set()) }}
        />
      )}

      {showSearch && (
        <SaveSearchSlideOver
          filters={filters}
          preContactId={preContactId}
          preContactName={preContactName}
          onClose={() => setShowSearch(false)}
          onSaved={() => setShowSearch(false)}
        />
      )}
    </div>
  )
}
```

Note: This page sits outside the normal `DashboardLayout` wrapper since it's full-screen. Wrap it in the layout if the project standard requires it — check how other admin pages handle this.

- [ ] **Step 4: Add browse link to admin listings nav**

Open `app/admin/listings/page.tsx`. Find the `PageHeader` or top action area and add a link:

```tsx
<a href="/admin/listings/browse" className="...">Browse MLS</a>
```

Match whatever button/link style the page already uses.

- [ ] **Step 5: Commit**

```bash
git add components/admin/listing-browser/ app/admin/listings/browse/ app/admin/listings/page.tsx
git commit -m "feat: add admin MLS listing browser with multi-select and send/save-search slide-overs"
```

---

## Chunk 7: Contact Profile — Listings Tab

### Task 11: ContactListingsTab component and wiring

**Files:**
- Create: `components/admin/ContactListingsTab.tsx`
- Modify: `app/admin/contacts/[id]/page.tsx`

- [ ] **Step 1: Create `components/admin/ContactListingsTab.tsx`**

```tsx
'use client'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui'
import { Card } from '@/components/layout'
import { CheckCircle2, Clock } from 'lucide-react'

interface PackageItem {
  id: string
  listingKey: string
  views: { viewedAt: string; durationSec: number | null }[]
}

interface Package {
  id:        string
  title:     string
  sentAt:    string | null
  message:   string | null
  items:     PackageItem[]
}

interface SavedSearch {
  id:        string
  name:      string
  filters:   string
  createdAt: string
}

interface Props {
  contactId:   string
  contactName: string
}

export function ContactListingsTab({ contactId, contactName }: Props) {
  const [packages,      setPackages]      = useState<Package[]>([])
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([])
  const [expanded,      setExpanded]      = useState<Set<string>>(new Set())
  const [loading,       setLoading]       = useState(true)

  useEffect(() => {
    Promise.all([
      fetch(`/api/listing-packages?contactId=${contactId}`).then(r => r.json()),
      fetch(`/api/admin/contacts/${contactId}/saved-searches`).then(r => r.json()),
    ]).then(([pkgs, searches]) => {
      setPackages(pkgs.data ?? [])
      setSavedSearches(searches.data ?? [])
      setLoading(false)
    })
  }, [contactId])

  async function deleteSearch(id: string) {
    await fetch(`/api/admin/contacts/${contactId}/saved-searches/${id}`, { method: 'DELETE' })
    setSavedSearches(s => s.filter(x => x.id !== id))
  }

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  if (loading) return <p className="text-sm text-charcoal-400 p-4">Loading...</p>

  return (
    <div className="flex flex-col gap-6">
      {/* Browse & Send */}
      <div className="flex justify-end">
        <a
          href={`/admin/listings/browse?contactId=${contactId}&contactName=${encodeURIComponent(contactName)}`}
          className="inline-flex items-center gap-2 px-4 py-2 bg-gold-600 text-white rounded-md text-sm font-medium hover:bg-gold-700"
        >
          Browse &amp; Send Listings
        </a>
      </div>

      {/* Packages */}
      <Card>
        <h3 className="font-semibold text-charcoal-900 mb-4">Listing Packages Sent</h3>
        {packages.length === 0
          ? <p className="text-sm text-charcoal-400">No packages sent yet.</p>
          : packages.map(pkg => {
              const viewedCount = pkg.items.filter(i => i.views.length > 0).length
              const isExpanded  = expanded.has(pkg.id)
              return (
                <div key={pkg.id} className="border border-charcoal-100 rounded-lg mb-3">
                  <button
                    className="w-full flex items-center justify-between p-4 text-left hover:bg-charcoal-50"
                    onClick={() => toggleExpand(pkg.id)}
                  >
                    <div>
                      <p className="font-medium text-charcoal-900">{pkg.title}</p>
                      <p className="text-xs text-charcoal-400">
                        {pkg.sentAt ? `Sent ${new Date(pkg.sentAt).toLocaleDateString()}` : 'Draft (not sent)'}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-charcoal-600">{viewedCount} / {pkg.items.length} viewed</span>
                      <span className="text-charcoal-400">{isExpanded ? '▲' : '▼'}</span>
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="px-4 pb-4 divide-y divide-charcoal-50">
                      {pkg.items.map(item => (
                        <div key={item.id} className="py-2 flex items-center justify-between text-sm">
                          <span className="text-charcoal-700 font-mono text-xs">{item.listingKey}</span>
                          {item.views.length > 0
                            ? <span className="flex items-center gap-1 text-green-600 text-xs">
                                <CheckCircle2 size={12} />
                                Viewed {new Date(item.views[0].viewedAt).toLocaleDateString()}
                                {item.views[0].durationSec ? ` · ${item.views[0].durationSec}s` : ''}
                              </span>
                            : <span className="flex items-center gap-1 text-charcoal-400 text-xs"><Clock size={12} /> Not viewed</span>
                          }
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })
        }
      </Card>

      {/* Saved Searches */}
      <Card>
        <h3 className="font-semibold text-charcoal-900 mb-4">Saved Searches</h3>
        {savedSearches.length === 0
          ? <p className="text-sm text-charcoal-400">No saved searches.</p>
          : savedSearches.map(s => {
              let filters: Record<string, string> = {}
              try { filters = JSON.parse(s.filters) } catch { /* ignore */ }
              const summary = Object.entries(filters).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join(' · ')
              return (
                <div key={s.id} className="flex items-center justify-between py-3 border-b border-charcoal-100 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-charcoal-900">{s.name}</p>
                    {summary && <p className="text-xs text-charcoal-400 mt-0.5">{summary}</p>}
                  </div>
                  <div className="flex gap-2">
                    <a
                      href={`/admin/listings/browse?contactId=${contactId}&contactName=${encodeURIComponent(contactName)}&${new URLSearchParams(filters)}`}
                      className="text-xs text-charcoal-500 hover:text-charcoal-900 underline"
                    >
                      Run
                    </a>
                    <button onClick={() => deleteSearch(s.id)} className="text-xs text-red-400 hover:text-red-600">Delete</button>
                  </div>
                </div>
              )
            })
        }
      </Card>
    </div>
  )
}
```

- [ ] **Step 2: Add "Listings" tab to the contact detail page**

Open `app/admin/contacts/[id]/page.tsx`. Find the tabs array (look for `Timeline`, `SMS`, etc.). Add a new tab entry:

```tsx
{ label: 'Listings', content: <ContactListingsTab contactId={contact.id} contactName={`${contact.firstName} ${contact.lastName}`} /> }
```

Import `ContactListingsTab` at the top:

```tsx
import { ContactListingsTab } from '@/components/admin/ContactListingsTab'
```

- [ ] **Step 3: Commit**

```bash
git add components/admin/ContactListingsTab.tsx app/admin/contacts/
git commit -m "feat: add Listings tab to contact detail page with packages and saved searches"
```

---

## Chunk 8: Portal Package Page & View Tracking

### Task 12: Portal package page

**Files:**
- Create: `app/portal/packages/[token]/page.tsx`

- [ ] **Step 1: Create `app/portal/packages/[token]/page.tsx`**

```tsx
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { setPackageSessionCookie } from '@/lib/pkg-session'

interface Props { params: Promise<{ token: string }> }

function getFirstPhoto(media: string | null): string {
  try { return JSON.parse(media ?? '[]')[0]?.MediaURL ?? '' } catch { return '' }
}

function formatPrice(price: number | null): string {
  if (!price) return 'Price on request'
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(price)
}

export default async function PackagePage({ params }: Props) {
  const { token } = await params
  const pkg = await prisma.listingPackage.findUnique({
    where:   { magicToken: token },
    include: {
      contact: { select: { id: true, firstName: true } },
      items:   { orderBy: { addedAt: 'asc' } },
    },
  })

  if (!pkg) notFound()

  await setPackageSessionCookie({ contactId: pkg.contactId, packageId: pkg.id })

  const listingKeys = pkg.items.map(i => i.listingKey)
  const properties  = await prisma.resoProperty.findMany({
    where:  { listingKey: { in: listingKeys } },
    select: {
      listingKey: true, unparsedAddress: true, city: true,
      listPrice: true, bedroomsTotal: true, bathroomsTotalInteger: true,
      livingArea: true, media: true,
    },
  })
  const propMap = Object.fromEntries(properties.map(p => [p.listingKey, p]))

  const items = pkg.items.map(item => ({
    ...item,
    property: propMap[item.listingKey] ?? null,
  }))

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-charcoal-900 text-white py-6 px-4">
        <div className="max-w-3xl mx-auto">
          <p className="text-lg font-semibold">Michael Taylor Realty</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-charcoal-900 mb-2">{pkg.title}</h1>
        {pkg.message && <p className="text-charcoal-600 mb-6">{pkg.message}</p>}

        {/* View all CTA */}
        <div className="bg-white border border-charcoal-100 rounded-xl p-6 text-center mb-8 shadow-sm">
          <p className="text-charcoal-700 font-medium mb-3">{items.length} listing{items.length !== 1 ? 's' : ''} selected for you</p>
          <a href="#listings" className="inline-block px-6 py-3 bg-gold-600 text-white rounded-lg font-semibold hover:bg-gold-700">
            View All {items.length} Listings ↓
          </a>
        </div>

        {/* Listing cards */}
        <div id="listings" className="flex flex-col gap-4">
          {items.map(item => {
            const p     = item.property
            const photo = p ? getFirstPhoto(p.media) : ''
            const link  = `${baseUrl}/portal/properties/${item.listingKey}?packageItemId=${item.id}&token=${token}`
            return (
              <div key={item.id} className="bg-white rounded-xl border border-charcoal-100 overflow-hidden shadow-sm flex flex-col sm:flex-row">
                {photo
                  ? <img src={photo} alt="" className="w-full sm:w-48 h-40 object-cover flex-shrink-0" />
                  : <div className="w-full sm:w-48 h-40 bg-charcoal-100 flex-shrink-0 flex items-center justify-center text-charcoal-400 text-xs">No photo</div>
                }
                <div className="p-5 flex flex-col justify-between flex-1">
                  <div>
                    <p className="font-semibold text-charcoal-900">{p?.unparsedAddress ?? 'Address TBD'}{p?.city ? `, ${p.city}` : ''}</p>
                    <p className="text-xl font-bold text-gold-600 mt-1">{formatPrice(p?.listPrice ?? null)}</p>
                    <p className="text-sm text-charcoal-500 mt-1">
                      {p?.bedroomsTotal ?? '—'} bed · {p?.bathroomsTotalInteger ?? '—'} bath
                      {p?.livingArea ? ` · ${p.livingArea.toLocaleString()} sqft` : ''}
                    </p>
                  </div>
                  <a href={link} className="mt-4 inline-block px-4 py-2 bg-charcoal-900 text-white rounded-lg text-sm font-medium hover:bg-charcoal-700 self-start">
                    View Listing →
                  </a>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/portal/packages/
git commit -m "feat: add portal package page with magic-link session and listing cards"
```

---

### Task 13: Portal property page — package view tracking

**Files:**
- Modify: `app/portal/properties/[id]/page.tsx` (or whichever file renders an individual portal property)

First read the file to understand its structure:

```bash
cat app/portal/properties/[id]/page.tsx
```

- [ ] **Step 1: Add a client-side tracking component**

Create `components/portal/PackageViewTracker.tsx`:

```tsx
'use client'
import { useEffect, useRef } from 'react'

interface Props {
  token:       string
  packageItemId: string
}

export function PackageViewTracker({ token, packageItemId }: Props) {
  const viewIdRef  = useRef<string | null>(null)
  const startRef   = useRef<number>(Date.now())

  useEffect(() => {
    // Record view on mount
    fetch(`/api/portal/packages/${token}/view`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ itemId: packageItemId }),
    })
      .then(r => r.json())
      .then(json => { viewIdRef.current = json.viewId ?? null })
      .catch(() => { /* silently ignore */ })

    // Record duration on unmount / page hide
    function sendDuration() {
      if (!viewIdRef.current) return
      const durationSec = Math.round((Date.now() - startRef.current) / 1000)
      navigator.sendBeacon(
        `/api/portal/packages/${token}/view/${viewIdRef.current}`,
        JSON.stringify({ durationSec })
      )
    }

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') sendDuration()
    })
    window.addEventListener('beforeunload', sendDuration)

    return () => {
      sendDuration()
      document.removeEventListener('visibilitychange', sendDuration)
      window.removeEventListener('beforeunload', sendDuration)
    }
  }, [token, packageItemId])

  return null
}
```

- [ ] **Step 2: Add tracker to the portal property page**

In `app/portal/properties/[id]/page.tsx`, read `searchParams` for `packageItemId` and `token`. If both are present, render the tracker:

```tsx
import { PackageViewTracker } from '@/components/portal/PackageViewTracker'

// Inside the page component, where searchParams are available:
const packageItemId = searchParams?.packageItemId as string | undefined
const token         = searchParams?.token         as string | undefined

// In the JSX:
{packageItemId && token && (
  <PackageViewTracker token={token} packageItemId={packageItemId} />
)}
```

The `PackageViewTracker` renders nothing visible — it only fires the tracking calls.

- [ ] **Step 3: Commit**

```bash
git add components/portal/PackageViewTracker.tsx app/portal/properties/
git commit -m "feat: add package view tracking on portal property page"
```

---

## Chunk 9: Final Wiring & Push

### Task 14: Build verification and push

- [ ] **Step 1: Run a local build to catch type errors**

```bash
npm run build
```

Expected: Build completes without errors. Fix any TypeScript errors before proceeding.

- [ ] **Step 2: Verify the database migration ran on the server**

After deploying, SSH into the server and run:

```bash
docker compose exec app npx prisma migrate deploy
```

- [ ] **Step 3: Smoke test the full flow manually**

1. Log in to admin → go to a contact → "Listings" tab should appear
2. Click "Browse & Send" → `/admin/listings/browse` loads, type a city, click Search → listings appear
3. Select 2+ listings → sticky bar appears → click "Send to Contact"
4. Fill title + message → click Send → check the contact's email inbox
5. Click the email link → portal package page loads, listings shown
6. Click "View Listing" on one → property page loads, `PackageViewTracker` fires
7. Navigate back → go to admin contact Listings tab → verify "1 / 2 viewed" shows

- [ ] **Step 4: Push to GitHub**

```bash
git push origin main
```
