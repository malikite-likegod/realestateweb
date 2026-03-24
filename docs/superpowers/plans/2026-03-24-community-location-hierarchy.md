# Community Location Hierarchy Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `municipality` and `neighbourhood` fields to the `Community` model and replace the flat city input in the admin form with cascading Area → Municipality → Neighbourhood inputs that auto-populate from existing Community records.

**Architecture:** Schema change + Prisma migration, a new read-only API route returning distinct location values, minimal updates to two existing API routes to accept the new fields, and a client-side form update with three interconnected controlled inputs.

**Tech Stack:** Next.js 15 App Router, TypeScript, Prisma ORM (SQLite dev), React hooks (`useState`, `useEffect`, `useRef`), Tailwind CSS.

---

## File Map

| File | Action | What changes |
|---|---|---|
| `prisma/schema.prisma` | Modify | Add `municipality String?` and `neighbourhood String?` to `Community` model |
| `app/api/admin/communities/locations/route.ts` | **Create** | GET handler returning distinct area / municipality / neighbourhood values |
| `app/api/admin/communities/route.ts` | Modify | POST body type + Prisma create data include new fields |
| `app/api/admin/communities/[id]/route.ts` | Modify | PUT body type + Prisma update data include new fields |
| `components/admin/CommunityForm.tsx` | Modify | Import, interface, form state, handleSubmit, and three cascading inputs |

---

## Chunk 1: Schema, Migration, and API Updates

### Task 1: Add fields to schema and run migration

**Files:**
- Modify: `prisma/schema.prisma:1083-1095`

- [ ] **Step 1: Add the two new fields to the Community model**

Open `prisma/schema.prisma`. Find the `Community` model (currently ends at line ~1095). Add `municipality` and `neighbourhood` after `city`:

```prisma
model Community {
  id            String   @id @default(cuid())
  name          String
  slug          String   @unique
  description   String?
  imageUrl      String?
  city          String
  municipality  String?
  neighbourhood String?
  displayOrder  Int      @default(0)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@map("communities")
}
```

- [ ] **Step 2: Run the migration**

```bash
npx prisma migrate dev --name add_community_location_fields
```

Expected: Prisma prints "Your database is now in sync with your schema." and generates a migration file under `prisma/migrations/`. The Prisma client is regenerated automatically.

- [ ] **Step 3: Verify build still compiles**

```bash
npm run build
```

Expected: 0 TypeScript errors. The new optional fields appear on the `Community` Prisma type.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add municipality and neighbourhood fields to Community model"
```

---

### Task 2: Create the locations API route

**Files:**
- Create: `app/api/admin/communities/locations/route.ts`

This route sits at `locations/` — a static segment. In Next.js App Router, static segments take precedence over dynamic segments (`[id]`) at the same level, so there is no routing conflict with the existing `[id]` route.

- [ ] **Step 1: Create the file**

Create `app/api/admin/communities/locations/route.ts` with this exact content:

```typescript
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

export async function GET(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const area         = searchParams.get('area')
  const municipality = searchParams.get('municipality')

  // Level 3: neighbourhoods for a given area + municipality
  if (area && municipality) {
    const rows = await prisma.community.findMany({
      where:    { city: area, municipality, neighbourhood: { not: null } },
      select:   { neighbourhood: true },
      distinct: ['neighbourhood'],
      orderBy:  { neighbourhood: 'asc' },
    })
    return NextResponse.json({ neighbourhoods: rows.map(r => r.neighbourhood as string) })
  }

  // Level 2: municipalities for a given area
  if (area) {
    const rows = await prisma.community.findMany({
      where:    { city: area, municipality: { not: null } },
      select:   { municipality: true },
      distinct: ['municipality'],
      orderBy:  { municipality: 'asc' },
    })
    return NextResponse.json({ municipalities: rows.map(r => r.municipality as string) })
  }

  // Level 1: all distinct areas (city is non-nullable — no null filter needed)
  const rows = await prisma.community.findMany({
    select:   { city: true },
    distinct: ['city'],
    orderBy:  { city: 'asc' },
  })
  return NextResponse.json({ areas: rows.map(r => r.city) })
}
```

- [ ] **Step 2: Verify build compiles**

```bash
npm run build
```

Expected: 0 errors.

- [ ] **Step 3: Smoke-test the route manually**

Start dev server (`npm run dev`) and visit (authenticated):
- `http://localhost:3000/api/admin/communities/locations` → `{ "areas": [] }` (empty until communities exist)
- Any unauthenticated request → `{ "error": "Unauthorized" }` with status 401

- [ ] **Step 4: Commit**

```bash
git add app/api/admin/communities/locations/route.ts
git commit -m "feat: add GET /api/admin/communities/locations route"
```

---

### Task 3: Update POST route to accept new fields

**Files:**
- Modify: `app/api/admin/communities/route.ts`

- [ ] **Step 1: Update the POST body type and Prisma create call**

Open `app/api/admin/communities/route.ts`. The current POST handler has a narrow body type and Prisma `data` object. Replace the `POST` function with:

```typescript
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
      municipality?: string | null
      neighbourhood?: string | null
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
        municipality:  body.municipality  ?? null,
        neighbourhood: body.neighbourhood ?? null,
        displayOrder: body.displayOrder ?? 0,
      },
    })
    return NextResponse.json({ data: community }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
```

- [ ] **Step 2: Verify build compiles**

```bash
npm run build
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/admin/communities/route.ts
git commit -m "feat: accept municipality and neighbourhood in POST /api/admin/communities"
```

---

### Task 4: Update PUT route to accept new fields

**Files:**
- Modify: `app/api/admin/communities/[id]/route.ts`

- [ ] **Step 1: Update the PUT body type and Prisma update call**

Open `app/api/admin/communities/[id]/route.ts`. Replace only the `PUT` function (leave `GET` and `DELETE` untouched):

```typescript
export async function PUT(request: Request, { params }: Props) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const existing = await prisma.community.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  try {
    const body = await request.json() as {
      name: string
      slug: string
      description?: string | null
      imageUrl?: string | null
      city: string
      municipality?: string | null
      neighbourhood?: string | null
      displayOrder?: number
    }

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
        municipality:  body.municipality  ?? null,
        neighbourhood: body.neighbourhood ?? null,
        displayOrder: body.displayOrder ?? 0,
      },
    })
    return NextResponse.json({ data: community })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
```

- [ ] **Step 2: Verify build compiles**

```bash
npm run build
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/admin/communities/[id]/route.ts
git commit -m "feat: accept municipality and neighbourhood in PUT /api/admin/communities/[id]"
```

---

## Chunk 2: CommunityForm Update

### Task 5: Update CommunityForm with cascading location inputs

**Files:**
- Modify: `components/admin/CommunityForm.tsx`

This is the largest task. Make changes incrementally as described below. The current file is ~181 lines. After this task it will be ~270 lines.

The existing form has:
- `form` state: `{ name, slug, city, description, displayOrder }` — all strings
- `imageUrl` as a separate `useState<string>`
- `set()` helper for text inputs
- `handleSubmit` sending `JSON.stringify({ name, slug, city, description, displayOrder, imageUrl })`

**Do not** move `imageUrl` into `form`. Keep `set()` for `name`, `slug`, `description`, `displayOrder`.

- [ ] **Step 1: Update imports**

Change the two import lines at the top:

```typescript
import { useState, useEffect, useRef } from 'react'
import { Input, Textarea, Button, Select, useToast } from '@/components/ui'
```

- [ ] **Step 2: Update the `CommunityData` interface**

Replace the existing interface (lines 10–18):

```typescript
interface CommunityData {
  id:           string
  name:         string
  slug:         string
  city:         string
  description:  string | null
  imageUrl:     string | null
  displayOrder: number
  municipality:  string | null
  neighbourhood: string | null
}
```

- [ ] **Step 3: Update form state**

Replace the `useState` for `form` (lines 33–39) to add the two new fields:

```typescript
const [form, setForm] = useState({
  name:         initial?.name         ?? '',
  slug:         initial?.slug         ?? '',
  city:         initial?.city         ?? '',
  description:  initial?.description  ?? '',
  displayOrder: String(initial?.displayOrder ?? 0),
  municipality:  initial?.municipality  ?? null,
  neighbourhood: initial?.neighbourhood ?? null,
})
```

- [ ] **Step 4: Add new local state and refs**

After the existing `useState` declarations (after line ~43, before the slug `useEffect`), add:

```typescript
const [areas, setAreas]                               = useState<string[]>([])
const [municipalityOptions, setMunicipalityOptions]   = useState<string[]>([])
const [neighbourhoodOptions, setNeighbourhoodOptions] = useState<string[]>([])
const [fetchingMunicipality, setFetchingMunicipality] = useState(false)
const [fetchingNeighbourhood, setFetchingNeighbourhood] = useState(false)
const [showSuggestions, setShowSuggestions]           = useState(false)

const cityMountRef         = useRef(true)
const municipalityMountRef = useRef(true)
```

- [ ] **Step 5: Add the three useEffects**

After the existing slug `useEffect` (after line ~50), add:

```typescript
// Fetch all areas on mount for the city combobox
useEffect(() => {
  fetch('/api/admin/communities/locations')
    .then(r => r.json())
    .then(d => setAreas(d.areas ?? []))
}, [])

// Fetch municipalities when city changes
useEffect(() => {
  // Consume ref before early exit — ensures first non-empty value triggers reset
  const isMount = cityMountRef.current
  cityMountRef.current = false

  if (!form.city) { setMunicipalityOptions([]); return }

  if (!isMount) {
    setForm(f => ({ ...f, municipality: null, neighbourhood: null }))
    setNeighbourhoodOptions([])
  }

  setFetchingMunicipality(true)
  fetch(`/api/admin/communities/locations?area=${encodeURIComponent(form.city)}`)
    .then(r => r.json())
    .then(d => setMunicipalityOptions(d.municipalities ?? []))
    .finally(() => setFetchingMunicipality(false))
}, [form.city])

// Fetch neighbourhoods when municipality changes
// form.city is in deps because it is used in the fetch URL — omitting it
// would capture a stale city value if the user changed city and municipality together.
useEffect(() => {
  // Consume ref before early exit — same reason as cityMountRef above
  const isMount = municipalityMountRef.current
  municipalityMountRef.current = false

  if (!form.municipality) { setNeighbourhoodOptions([]); return }

  if (!isMount) {
    setForm(f => ({ ...f, neighbourhood: null }))
  }

  setFetchingNeighbourhood(true)
  fetch(
    `/api/admin/communities/locations?area=${encodeURIComponent(form.city)}&municipality=${encodeURIComponent(form.municipality)}`
  )
    .then(r => r.json())
    .then(d => setNeighbourhoodOptions(d.neighbourhoods ?? []))
    .finally(() => setFetchingNeighbourhood(false))
}, [form.municipality, form.city])
```

- [ ] **Step 6: Update handleSubmit body**

Replace the `JSON.stringify({...})` body inside `handleSubmit` (currently lines 84–91):

```typescript
body: JSON.stringify({
  name:         form.name,
  slug:         form.slug,
  city:         form.city,
  description:  form.description || null,
  displayOrder: Number(form.displayOrder) || 0,
  imageUrl:     imageUrl || null,
  municipality:  form.municipality  || null,
  neighbourhood: form.neighbourhood || null,
}),
```

- [ ] **Step 7: Add the derived filteredAreas constant**

Add this constant just above the `return (` statement (i.e., just before the JSX):

```typescript
const filteredAreas = areas.filter(a =>
  a.toLowerCase().includes(form.city.toLowerCase())
)
```

- [ ] **Step 8: Replace the city Input with the combobox**

In the JSX, find the existing city `<Input>` (currently lines 133–139):

```tsx
<Input
  label="City *"
  required
  value={form.city}
  onChange={set('city')}
  placeholder="e.g. Toronto"
/>
```

Replace it with:

```tsx
<div className="relative">
  <Input
    label="City (Area) *"
    required
    value={form.city}
    placeholder="e.g. Toronto"
    onChange={(e) => {
      const value = e.target.value
      setForm(f => ({ ...f, city: value, municipality: null, neighbourhood: null }))
      setMunicipalityOptions([])
      setNeighbourhoodOptions([])
      setShowSuggestions(true)
    }}
    onFocus={() => setShowSuggestions(true)}
    onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
  />
  {showSuggestions && filteredAreas.length > 0 && (
    <ul className="absolute z-10 mt-1 w-full bg-white border border-charcoal-200 rounded-lg shadow-sm max-h-48 overflow-y-auto">
      {filteredAreas.map(suggestion => (
        <li
          key={suggestion}
          className="px-3 py-2 text-sm cursor-pointer hover:bg-charcoal-50"
          onMouseDown={(e) => {
            e.preventDefault()
            setForm(f => ({ ...f, city: suggestion, municipality: null, neighbourhood: null }))
            setMunicipalityOptions([])
            setNeighbourhoodOptions([])
            setShowSuggestions(false)
          }}
        >
          {suggestion}
        </li>
      ))}
    </ul>
  )}
</div>
```

Note: `onMouseDown` + `e.preventDefault()` is used instead of `onClick` because `onMouseDown` fires before the input's `onBlur`, preventing the suggestion list from disappearing before the selection registers.

- [ ] **Step 9: Add municipality and neighbourhood inputs**

Immediately after the city combobox `</div>` (and before the existing `<Textarea label="Description"...>`), add:

```tsx
{municipalityOptions.length > 0 ? (
  <Select
    label="Municipality"
    value={form.municipality ?? ''}
    disabled={fetchingMunicipality}
    placeholder="— select —"
    options={municipalityOptions.map(m => ({ value: m, label: m }))}
    onChange={(e) => {
      const v = (e.target as HTMLSelectElement).value || null
      setForm(f => ({ ...f, municipality: v, neighbourhood: null }))
      setNeighbourhoodOptions([])
    }}
  />
) : (
  <Input
    label="Municipality"
    value={form.municipality ?? ''}
    disabled={fetchingMunicipality}
    onChange={(e) => setForm(f => ({ ...f, municipality: e.target.value || null }))}
    placeholder="e.g. Toronto C01"
  />
)}

{neighbourhoodOptions.length > 0 ? (
  <Select
    label="Neighbourhood"
    value={form.neighbourhood ?? ''}
    disabled={fetchingNeighbourhood}
    placeholder="— select —"
    options={neighbourhoodOptions.map(n => ({ value: n, label: n }))}
    onChange={(e) => setForm(f => ({ ...f, neighbourhood: (e.target as HTMLSelectElement).value || null }))}
  />
) : (
  <Input
    label="Neighbourhood"
    value={form.neighbourhood ?? ''}
    disabled={fetchingNeighbourhood}
    onChange={(e) => setForm(f => ({ ...f, neighbourhood: e.target.value || null }))}
    placeholder="e.g. Annex"
  />
)}
```

- [ ] **Step 10: Verify build compiles**

> **Prerequisite:** The Prisma migration (Tasks 1–4) must already be applied and the Prisma client regenerated before this step. If `prisma.community.municipality` doesn't exist in the generated types yet, the build will show Prisma type errors — that means Task 1 (`prisma migrate dev`) hasn't been run, not that the form code is wrong.

```bash
npm run build
```

Expected: 0 TypeScript errors, 0 build errors.

- [ ] **Step 11: Smoke-test the form manually**

Start dev server (`npm run dev`) and visit `/admin/communities/new`:
- City field is a text input with autocomplete dropdown when typing (empty on first use — no communities yet)
- Municipality and Neighbourhood appear as plain text inputs (no options yet)
- Submit creates a community; visit `/admin/communities/<id>/edit` to confirm the saved values round-trip correctly

- [ ] **Step 12: Commit**

```bash
git add components/admin/CommunityForm.tsx
git commit -m "feat: add cascading municipality/neighbourhood inputs to CommunityForm"
```
