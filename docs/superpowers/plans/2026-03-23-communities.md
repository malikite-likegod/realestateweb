# Communities Feature Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace hardcoded community pages with database-driven communities an admin can create, edit, and delete — each with an uploaded image and a city name that auto-matches active listings.

**Architecture:** Add a `Community` Prisma model; add admin CRUD API routes + admin UI pages; replace hardcoded public community pages with live DB queries. No changes to Property, Listing, or other existing models.

**Tech Stack:** Next.js 15 App Router, Prisma ORM (SQLite), TypeScript, Tailwind CSS, lucide-react

---

## File Map

### New files

| File | Purpose |
|---|---|
| `app/api/admin/communities/route.ts` | GET list + POST create |
| `app/api/admin/communities/[id]/route.ts` | GET + PUT + DELETE single |
| `components/admin/CommunitiesTable.tsx` | Client component: table with delete button for the admin list page |
| `components/admin/CommunityForm.tsx` | Client component: create/edit form with image upload |
| `app/admin/communities/page.tsx` | Admin list page (server component) |
| `app/admin/communities/new/page.tsx` | Create community page (server component) |
| `app/admin/communities/[id]/edit/page.tsx` | Edit community page (server component) |

### Modified files

| File | Change |
|---|---|
| `prisma/schema.prisma` | Add `Community` model |
| `components/navigation/Sidebar.tsx` | Add Communities nav item after Listings |
| `app/(public)/communities/page.tsx` | Replace hardcoded array with DB query |
| `app/(public)/communities/[slug]/page.tsx` | Replace hardcoded map with DB query + live listings |

---

## Chunk 1: Data Layer

### Task 1: Add Community model and run migration

**Files:**
- Modify: `prisma/schema.prisma`
- Creates: `prisma/migrations/<timestamp>_add_communities/migration.sql`

- [ ] **Step 1: Add the Community model to schema**

Open `prisma/schema.prisma`. At the end of the file, add:

```prisma
// ─── Communities ──────────────────────────────────────────────────────────────

model Community {
  id           String   @id @default(cuid())
  name         String
  slug         String   @unique
  description  String?
  imageUrl     String?
  city         String
  displayOrder Int      @default(0)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@map("communities")
}
```

- [ ] **Step 2: Run the migration**

```bash
npx prisma migrate dev --name add_communities
```

Expected: Prisma prints "Your database is now in sync with your schema." and creates `prisma/migrations/<timestamp>_add_communities/migration.sql`.

- [ ] **Step 3: Verify Prisma client regenerated**

```bash
npx prisma generate
```

Expected: "Generated Prisma Client" message with no errors.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add Community model and migration"
```

---

### Task 2: Admin API route — list and create

**Files:**
- Create: `app/api/admin/communities/route.ts`

- [ ] **Step 1: Create the file**

Create `app/api/admin/communities/route.ts` with this content:

```typescript
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const communities = await prisma.community.findMany({
    orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
  })
  return NextResponse.json({ data: communities })
}

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json() as {
      name: string
      slug: string
      description?: string | null
      imageUrl?: string | null
      city: string
      displayOrder?: number
    }

    const existing = await prisma.community.findUnique({ where: { slug: body.slug } })
    if (existing) return NextResponse.json({ error: 'Slug already taken' }, { status: 409 })

    const community = await prisma.community.create({
      data: {
        name:         body.name,
        slug:         body.slug,
        description:  body.description  ?? null,
        imageUrl:     body.imageUrl     ?? null,
        city:         body.city,
        displayOrder: body.displayOrder ?? 0,
      },
    })
    return NextResponse.json({ data: community }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
```

- [ ] **Step 2: Verify build passes**

```bash
npm run build
```

Expected: Build completes with no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/admin/communities/route.ts
git commit -m "feat: add admin communities list and create API route"
```

---

### Task 3: Admin API route — get, update, delete single

**Files:**
- Create: `app/api/admin/communities/[id]/route.ts`

- [ ] **Step 1: Create the file**

Create `app/api/admin/communities/[id]/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

interface Props { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Props) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const community = await prisma.community.findUnique({ where: { id } })
  if (!community) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ data: community })
}

export async function PUT(request: Request, { params }: Props) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  // Verify the record exists before updating
  const existing = await prisma.community.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  try {
    const body = await request.json() as {
      name: string
      slug: string
      description?: string | null
      imageUrl?: string | null
      city: string
      displayOrder?: number
    }

    // Check slug uniqueness, excluding this record
    const slugConflict = await prisma.community.findFirst({
      where: { slug: body.slug, NOT: { id } },
    })
    if (slugConflict) return NextResponse.json({ error: 'Slug already taken' }, { status: 409 })

    const community = await prisma.community.update({
      where: { id },
      data: {
        name:         body.name,
        slug:         body.slug,
        description:  body.description  ?? null,
        imageUrl:     body.imageUrl     ?? null,
        city:         body.city,
        displayOrder: body.displayOrder ?? 0,
      },
    })
    return NextResponse.json({ data: community })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}

export async function DELETE(_req: Request, { params }: Props) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  try {
    await prisma.community.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Verify build passes**

```bash
npm run build
```

Expected: Build completes with no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/admin/communities/[id]/route.ts
git commit -m "feat: add admin community GET/PUT/DELETE API route"
```

---

## Chunk 2: Admin UI

### Task 4: CommunitiesTable client component

This is a `'use client'` component that the server-side list page passes pre-fetched data to. It owns the delete confirmation flow.

**Files:**
- Create: `components/admin/CommunitiesTable.tsx`

- [ ] **Step 1: Create the file**

Create `components/admin/CommunitiesTable.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { Edit, Trash2 } from 'lucide-react'
import { useToast } from '@/components/ui'

export interface CommunityRow {
  id:           string
  name:         string
  slug:         string
  city:         string
  imageUrl:     string | null
  displayOrder: number
  listingCount: number
}

interface CommunitiesTableProps {
  communities: CommunityRow[]
}

export function CommunitiesTable({ communities }: CommunitiesTableProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [deleting, setDeleting] = useState<string | null>(null)

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete community "${name}"? This cannot be undone.`)) return
    setDeleting(id)
    try {
      const res = await fetch(`/api/admin/communities/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast('success', 'Community deleted')
      router.refresh()
    } catch {
      toast('error', 'Failed to delete community')
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-charcoal-100">
      <table className="w-full text-sm">
        <thead className="bg-charcoal-50 border-b border-charcoal-100">
          <tr>
            {['Image', 'Name', 'City', 'Listings', 'Order', 'Actions'].map(h => (
              <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-charcoal-500 uppercase tracking-wide">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-charcoal-100 bg-white">
          {communities.map(c => (
            <tr key={c.id} className="hover:bg-charcoal-50 transition-colors">
              <td className="px-4 py-3">
                <div className="relative h-10 w-14 rounded-lg overflow-hidden bg-charcoal-100 shrink-0">
                  {c.imageUrl && (
                    <Image src={c.imageUrl} alt={c.name} fill className="object-cover" sizes="56px" />
                  )}
                </div>
              </td>
              <td className="px-4 py-3 font-medium text-charcoal-900">{c.name}</td>
              <td className="px-4 py-3 text-charcoal-600">{c.city}</td>
              <td className="px-4 py-3 text-charcoal-600">{c.listingCount}</td>
              <td className="px-4 py-3 text-charcoal-400">{c.displayOrder}</td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <Link href={`/admin/communities/${c.id}/edit`} className="p-1.5 text-charcoal-400 hover:text-charcoal-700">
                    <Edit size={16} />
                  </Link>
                  <button
                    onClick={() => handleDelete(c.id, c.name)}
                    disabled={deleting === c.id}
                    className="p-1.5 text-charcoal-400 hover:text-red-600 disabled:opacity-50"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {communities.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-charcoal-400">
                No communities yet.{' '}
                <Link href="/admin/communities/new" className="text-charcoal-700 underline">
                  Add one.
                </Link>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 2: Verify build passes**

```bash
npm run build
```

Expected: Build completes with no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add components/admin/CommunitiesTable.tsx
git commit -m "feat: add CommunitiesTable admin client component"
```

---

### Task 5: CommunityForm client component

This is the `'use client'` form used by both the new and edit pages. It handles image upload via `POST /api/uploads`, auto-generates slug from name on create, and submits to the admin API.

**Files:**
- Create: `components/admin/CommunityForm.tsx`

- [ ] **Step 1: Create the file**

Create `components/admin/CommunityForm.tsx`:

```tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { DashboardLayout } from '@/components/dashboard'
import { PageHeader, Card } from '@/components/layout'
import { Input, Textarea, Button, useToast } from '@/components/ui'

interface CommunityData {
  id:           string
  name:         string
  slug:         string
  city:         string
  description:  string | null
  displayOrder: number
  imageUrl:     string | null
}

interface Props {
  initial?: CommunityData
}

function generateSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export function CommunityForm({ initial }: Props) {
  const router = useRouter()
  const { toast } = useToast()
  const isEdit = Boolean(initial)

  const [form, setForm] = useState({
    name:         initial?.name         ?? '',
    slug:         initial?.slug         ?? '',
    city:         initial?.city         ?? '',
    description:  initial?.description  ?? '',
    displayOrder: String(initial?.displayOrder ?? 0),
  })
  const [imageUrl, setImageUrl]               = useState(initial?.imageUrl ?? '')
  const [uploading, setUploading]             = useState(false)
  const [loading, setLoading]                 = useState(false)
  const [slugManuallyEdited, setSlugEdited]   = useState(isEdit)

  // Auto-populate slug from name on create only
  useEffect(() => {
    if (!slugManuallyEdited) {
      setForm(f => ({ ...f, slug: generateSlug(f.name) }))
    }
  }, [form.name, slugManuallyEdited])

  const set = (field: string) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [field]: e.target.value }))

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/uploads', { method: 'POST', body: fd })
      if (!res.ok) throw new Error()
      const json = await res.json() as { data: { url: string } }
      setImageUrl(json.data.url)
      toast('success', 'Image uploaded')
    } catch {
      toast('error', 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const url    = isEdit ? `/api/admin/communities/${initial!.id}` : '/api/admin/communities'
      const method = isEdit ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:         form.name,
          slug:         form.slug,
          city:         form.city,
          description:  form.description || null,
          displayOrder: Number(form.displayOrder) || 0,
          imageUrl:     imageUrl || null,
        }),
      })
      if (res.status === 409) {
        toast('error', 'Slug already taken — choose a different one')
        return
      }
      if (!res.ok) throw new Error()
      toast('success', isEdit ? 'Community updated!' : 'Community created!')
      router.push('/admin/communities')
    } catch {
      toast('error', 'Failed to save community')
    } finally {
      setLoading(false)
    }
  }

  // Client component has no session; match BlogPostForm pattern
  const user = { name: 'Admin', email: '', avatarUrl: null }

  return (
    <DashboardLayout user={user}>
      <PageHeader
        title={isEdit ? 'Edit Community' : 'New Community'}
        breadcrumbs={[
          { label: 'Dashboard',    href: '/admin/dashboard' },
          { label: 'Communities', href: '/admin/communities' },
          { label: isEdit ? initial!.name : 'New' },
        ]}
      />

      <form onSubmit={handleSubmit} className="flex flex-col gap-6 max-w-3xl">
        <Card>
          <h2 className="text-sm font-semibold text-charcoal-700 mb-4">Community Details</h2>
          <div className="flex flex-col gap-4">
            <Input label="Name *" required value={form.name} onChange={set('name')} />
            <Input
              label="Slug *"
              required
              value={form.slug}
              onChange={e => { setSlugEdited(true); set('slug')(e) }}
              placeholder="auto-generated from name"
            />
            <Input
              label="City *"
              required
              value={form.city}
              onChange={set('city')}
              placeholder="e.g. Toronto"
            />
            <Textarea
              label="Description"
              value={form.description}
              onChange={set('description')}
              rows={3}
            />
            <Input
              label="Display Order"
              type="number"
              value={form.displayOrder}
              onChange={set('displayOrder')}
            />
          </div>
        </Card>

        <Card>
          <h2 className="text-sm font-semibold text-charcoal-700 mb-4">Community Image</h2>
          {imageUrl && (
            <div className="relative h-40 w-full rounded-lg overflow-hidden bg-charcoal-100 mb-4">
              <Image src={imageUrl} alt="Community image" fill className="object-cover" />
            </div>
          )}
          <input
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            disabled={uploading}
            className="text-sm text-charcoal-600"
          />
          {uploading && <p className="text-sm text-charcoal-400 mt-2">Uploading…</p>}
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={() => router.back()}>Cancel</Button>
          <Button type="submit" variant="primary" loading={loading}>
            {isEdit ? 'Save Changes' : 'Create Community'}
          </Button>
        </div>
      </form>
    </DashboardLayout>
  )
}
```

- [ ] **Step 2: Verify build passes**

```bash
npm run build
```

Expected: Build completes with no TypeScript errors. If `Textarea` doesn't accept a `label` prop, check existing usages in the codebase (e.g., `app/admin/blog/BlogPostForm.tsx`) and match the exact prop name used there.

- [ ] **Step 3: Commit**

```bash
git add components/admin/CommunityForm.tsx
git commit -m "feat: add CommunityForm admin client component"
```

---

### Task 6: Admin communities list page

**Files:**
- Create: `app/admin/communities/page.tsx`

- [ ] **Step 1: Create the file**

Create `app/admin/communities/page.tsx`:

```tsx
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { DashboardLayout } from '@/components/dashboard'
import { PageHeader } from '@/components/layout'
import { Button } from '@/components/ui'
import { Plus } from 'lucide-react'
import Link from 'next/link'
import { CommunitiesTable } from '@/components/admin/CommunitiesTable'

export default async function CommunitiesManagerPage() {
  const session = await getSession()
  if (!session) redirect('/admin/login')

  const communities = await prisma.community.findMany({
    orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
  })

  // SQLite does not support mode: 'insensitive' on equals — use the isMySQL pattern
  // from lib/property-service.ts. MySQL needs it; SQLite's = is case-sensitive but
  // cities should be stored consistently through the admin UI.
  const isMySQL = process.env.DATABASE_URL?.includes('mysql')

  // Fetch listing counts in parallel
  const counts = await Promise.all(
    communities.map(c =>
      prisma.property.count({
        where: {
          city:     isMySQL ? { contains: c.city, mode: 'insensitive' } : { contains: c.city },
          status:   'active',
          listings: { some: { publishedAt: { not: null } } },
        },
      })
    )
  )

  const rows = communities.map((c, i) => ({ ...c, listingCount: counts[i] }))

  return (
    <DashboardLayout user={session}>
      <PageHeader
        title="Communities"
        subtitle={`${communities.length} communities`}
        breadcrumbs={[
          { label: 'Dashboard',    href: '/admin/dashboard' },
          { label: 'Communities' },
        ]}
        actions={
          <Button variant="primary" leftIcon={<Plus size={16} />} asChild>
            <Link href="/admin/communities/new">Add Community</Link>
          </Button>
        }
      />
      <CommunitiesTable communities={rows} />
    </DashboardLayout>
  )
}
```

- [ ] **Step 2: Verify build passes**

```bash
npm run build
```

Expected: Build completes. If `DashboardLayout user={session}` causes a type error (because `session` has more fields than the layout expects), check other server page patterns — `app/admin/listings/page.tsx` passes `session` directly and is the authoritative example.

- [ ] **Step 3: Commit**

```bash
git add app/admin/communities/page.tsx
git commit -m "feat: add admin communities list page"
```

---

### Task 7: Admin new community page

**Files:**
- Create: `app/admin/communities/new/page.tsx`

- [ ] **Step 1: Create the file**

Create `app/admin/communities/new/page.tsx`:

```tsx
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { CommunityForm } from '@/components/admin/CommunityForm'

export default async function NewCommunityPage() {
  const session = await getSession()
  if (!session) redirect('/admin/login')

  return <CommunityForm />
}
```

- [ ] **Step 2: Verify build passes**

```bash
npm run build
```

Expected: Build completes with no errors.

- [ ] **Step 3: Commit**

```bash
git add app/admin/communities/new/page.tsx
git commit -m "feat: add admin new community page"
```

---

### Task 8: Admin edit community page

**Files:**
- Create: `app/admin/communities/[id]/edit/page.tsx`

- [ ] **Step 1: Create the file**

Create `app/admin/communities/[id]/edit/page.tsx`:

```tsx
import { redirect, notFound } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { CommunityForm } from '@/components/admin/CommunityForm'

interface Props { params: Promise<{ id: string }> }

export default async function EditCommunityPage({ params }: Props) {
  const session = await getSession()
  if (!session) redirect('/admin/login')

  const { id } = await params
  const community = await prisma.community.findUnique({ where: { id } })
  if (!community) notFound()

  return <CommunityForm initial={community} />
}
```

- [ ] **Step 2: Verify build passes**

```bash
npm run build
```

Expected: Build completes. Prisma's `Community` model shape matches the `CommunityData` interface in `CommunityForm` — all fields align.

- [ ] **Step 3: Commit**

```bash
git add "app/admin/communities/[id]/edit/page.tsx"
git commit -m "feat: add admin edit community page"
```

---

### Task 9: Add Communities to admin sidebar

**Files:**
- Modify: `components/navigation/Sidebar.tsx`

- [ ] **Step 1: Add MapPin to the lucide-react import**

In `components/navigation/Sidebar.tsx`, the import line is:

```typescript
import {
  LayoutDashboard, Users, Briefcase, CheckSquare, Activity,
  Home, FileText, BarChart2, Zap, Settings, LogOut, Building2, MessageCircle, CalendarDays, TrendingUp, Layout, FolderOpen, BookOpen, Mail
} from 'lucide-react'
```

Add `MapPin` to the list:

```typescript
import {
  LayoutDashboard, Users, Briefcase, CheckSquare, Activity,
  Home, FileText, BarChart2, Zap, Settings, LogOut, Building2, MessageCircle, CalendarDays, TrendingUp, Layout, FolderOpen, BookOpen, Mail, MapPin
} from 'lucide-react'
```

- [ ] **Step 2: Add the nav item after Listings**

Find this entry in the `navItems` array (exact spacing matters for the edit):

```typescript
  { label: 'Listings',    href: '/admin/listings',    icon: Building2 },
```

Replace it with these two lines:

```typescript
  { label: 'Listings',    href: '/admin/listings',    icon: Building2 },
  { label: 'Communities', href: '/admin/communities', icon: MapPin    },
```

- [ ] **Step 3: Verify build passes**

```bash
npm run build
```

Expected: Build completes with no errors.

- [ ] **Step 4: Commit**

```bash
git add components/navigation/Sidebar.tsx
git commit -m "feat: add Communities nav item to admin sidebar"
```

---

## Chunk 3: Public Pages

### Task 10: Replace hardcoded communities index page

**Files:**
- Modify: `app/(public)/communities/page.tsx`

- [ ] **Step 1: Replace the file content**

The current `app/(public)/communities/page.tsx` has a hardcoded `communities` array. Replace the entire file:

```tsx
import type { Metadata } from 'next'
import { Container, Section, ContentBlock } from '@/components/layout'
import { CommunityGrid } from '@/components/real-estate'
import { prisma } from '@/lib/prisma'

export const metadata: Metadata = {
  title:       'Explore Toronto Communities',
  description: 'Discover Toronto\'s most prestigious and vibrant neighbourhoods.',
}

export default async function CommunitiesPage() {
  const communities = await prisma.community.findMany({
    orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
  })

  // SQLite does not support mode: 'insensitive' on equals.
  // See lib/property-service.ts for the authoritative pattern.
  const isMySQL = process.env.DATABASE_URL?.includes('mysql')

  // Fetch listing counts in parallel
  const counts = await Promise.all(
    communities.map(c =>
      prisma.property.count({
        where: {
          city:     isMySQL ? { contains: c.city, mode: 'insensitive' } : { contains: c.city },
          status:   'active',
          listings: { some: { publishedAt: { not: null } } },
        },
      })
    )
  )

  // CommunityGrid expects { name, slug, description, image, listingCount }
  const items = communities.map((c, i) => ({
    name:         c.name,
    slug:         c.slug,
    description:  c.description ?? '',
    image:        c.imageUrl    ?? '',
    listingCount: counts[i],
  }))

  return (
    <div className="pt-20">
      <Section background="light" padding="md">
        <Container>
          <ContentBlock
            eyebrow="Toronto Neighbourhoods"
            title="Find Your Perfect Community"
            body="Each neighbourhood in Toronto has its own unique character, amenities, and lifestyle. Explore them all."
            centered
          />
        </Container>
      </Section>
      <Section>
        <Container>
          <CommunityGrid communities={items} />
        </Container>
      </Section>
    </div>
  )
}
```

- [ ] **Step 2: Verify build passes**

```bash
npm run build
```

Expected: Build completes with no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add "app/(public)/communities/page.tsx"
git commit -m "feat: replace hardcoded communities index with DB query"
```

---

### Task 11: Replace hardcoded community detail page

**Files:**
- Modify: `app/(public)/communities/[slug]/page.tsx`

- [ ] **Step 1: Replace the file content**

The current file has a hardcoded `communities` lookup map. Replace the entire file:

```tsx
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Container, Section, ContentBlock, HeroSection } from '@/components/layout'
import { PropertyGrid } from '@/components/real-estate'
import { MlsDisclaimer } from '@/components/mls'
import { LeadCaptureForm } from '@/components/forms'
import { prisma } from '@/lib/prisma'
import type { PropertySummary } from '@/types/real-estate'

interface Props { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const community = await prisma.community.findUnique({ where: { slug } })
  if (!community) return { title: slug }
  return { title: community.name, description: community.description ?? undefined }
}

export default async function CommunityDetailPage({ params }: Props) {
  const { slug } = await params

  const community = await prisma.community.findUnique({ where: { slug } })
  if (!community) notFound()

  // SQLite does not support mode: 'insensitive' on equals.
  // See lib/property-service.ts for the authoritative pattern.
  const isMySQL = process.env.DATABASE_URL?.includes('mysql')

  const properties = await prisma.property.findMany({
    where: {
      city:     isMySQL ? { contains: community.city, mode: 'insensitive' } : { contains: community.city },
      status:   'active',
      listings: { some: { publishedAt: { not: null } } },
    },
    orderBy: { listedAt: 'desc' },
  })

  // Map to PropertySummary — Property.images is a JSON string
  const propertySummaries: PropertySummary[] = properties.map(p => ({
    id:           p.id,
    title:        p.title,
    price:        p.price,
    bedrooms:     p.bedrooms,
    bathrooms:    p.bathrooms,
    sqft:         p.sqft,
    address:      p.address,
    city:         p.city,
    propertyType: p.propertyType,
    listingType:  p.listingType,
    status:       p.status,
    images:       JSON.parse(p.images ?? '[]') as string[],
    latitude:     p.latitude,
    longitude:    p.longitude,
    listedAt:     p.listedAt,
  }))

  return (
    <div className="pt-20">
      <HeroSection
        title={community.name}
        subtitle={community.description ?? ''}
        backgroundImage={community.imageUrl ?? ''}
        fullHeight={false}
      />
      <Section>
        <Container>
          <ContentBlock
            title="About the Neighbourhood"
            body={community.description ?? ''}
          />
          <div className="mt-16">
            <h2 className="font-serif text-3xl font-bold text-charcoal-900 mb-8">Available Properties</h2>
            <PropertyGrid properties={propertySummaries} loading={false} />
          </div>
          <MlsDisclaimer variant="idx" />
        </Container>
      </Section>
      <Section background="charcoal">
        <Container size="sm">
          <ContentBlock
            eyebrow="Interested?"
            title={`Find Your Home in ${community.name}`}
            centered
            light
          />
          <div className="mt-10 bg-white rounded-3xl p-8">
            <LeadCaptureForm title="" source={`community_${slug}`} />
          </div>
        </Container>
      </Section>
    </div>
  )
}
```

- [ ] **Step 2: Verify build passes**

```bash
npm run build
```

Expected: Build completes with no TypeScript errors. If `Property` fields don't exactly match (e.g., `sqft` vs `squareFeet`), look at `app/(public)/listings/[id]/page.tsx` to see how it maps a `Property` to `PropertySummary` and match that pattern.

- [ ] **Step 3: Verify the dev server works end-to-end**

```bash
npm run dev
```

- Open `http://localhost:3000/admin/communities` — should show the Communities page (empty list with "Add one" link)
- Open `http://localhost:3000/communities` — should show the public communities index (empty if no DB records)
- Navigate to `/admin/communities/new`, fill in Name="Test", City="Toronto", submit — should redirect back to list
- Confirm the new community appears in the list
- Open `http://localhost:3000/communities/test` — should show the detail page with the community's data

- [ ] **Step 4: Commit**

```bash
git add "app/(public)/communities/[slug]/page.tsx"
git commit -m "feat: replace hardcoded community detail page with DB query and live listings"
```
