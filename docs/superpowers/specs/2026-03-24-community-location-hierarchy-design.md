# Community Location Hierarchy — Design Spec

**Date:** 2026-03-24
**Status:** Approved

---

## Overview

Extend the `Community` model with two new optional fields — `municipality` and `neighbourhood` — representing the second and third levels of the MLS location hierarchy (Area → Municipality → Community/Neighbourhood). Update the admin create/edit form to use cascading, database-driven inputs that auto-populate from existing Community records.

---

## Background

| Level | Field | Example |
|---|---|---|
| 1 — Area | `city` (existing) | Toronto |
| 2 — Municipality | `municipality` (new) | Toronto C01 |
| 3 — Neighbourhood | `neighbourhood` (new) | Annex |

`city` is used to match listings on public community pages. The two new fields are metadata only — they do not change listing-matching logic.

---

## Data Model

### Modified: `Community`

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

---

## API

### Existing routes — updated

`POST /api/admin/communities` and `PUT /api/admin/communities/[id]` accept the expanded body:

```typescript
{ name, slug, description, imageUrl, city, municipality, neighbourhood, displayOrder }
```

Both new fields are `string | null`. An empty string should be coerced to `null` before writing to the DB.

### New route — `GET /api/admin/communities/locations`

Returns distinct location values to populate cascade dropdowns. Auth: `getSession()`, return 401 if null.

```typescript
export async function GET(request: Request) { ... }
```

Read query params via `new URL(request.url).searchParams`. Use `Request` (not `NextRequest`).

**Response format — no `{ data: ... }` envelope** (unlike other admin routes — this is intentional):

| Query params | Response |
|---|---|
| _(none)_ | `{ areas: string[] }` |
| `?area=X` | `{ municipalities: string[] }` |
| `?area=X&municipality=Y` | `{ neighbourhoods: string[] }` |

All arrays sorted A→Z. Return empty arrays (not 404) when no records match.

**Prisma queries:**

```typescript
// areas — city is non-nullable, no null filter needed
const rows = await prisma.community.findMany({
  select: { city: true }, distinct: ['city'], orderBy: { city: 'asc' },
})
return NextResponse.json({ areas: rows.map(r => r.city) })

// municipalities
const rows = await prisma.community.findMany({
  where: { city: area, municipality: { not: null } },
  select: { municipality: true }, distinct: ['municipality'], orderBy: { municipality: 'asc' },
})
return NextResponse.json({ municipalities: rows.map(r => r.municipality as string) })

// neighbourhoods
const rows = await prisma.community.findMany({
  where: { city: area, municipality, neighbourhood: { not: null } },
  select: { neighbourhood: true }, distinct: ['neighbourhood'], orderBy: { neighbourhood: 'asc' },
})
return NextResponse.json({ neighbourhoods: rows.map(r => r.neighbourhood as string) })
```

---

## Admin Form (`CommunityForm.tsx`)

New fields go in the existing "Community Details" `Card`, after the `city` input and before `description`.

### Import changes

```typescript
// Add useRef to React import:
import { useState, useEffect, useRef } from 'react'

// Add Select to @/components/ui import:
import { Input, Textarea, Button, Select, useToast } from '@/components/ui'
```

### `CommunityData` interface (the `initial` prop type)

Add two fields:

```typescript
interface CommunityData {
  id:           string
  name:         string
  slug:         string
  city:         string
  description:  string | null
  imageUrl:     string | null
  displayOrder: number
  municipality:  string | null   // new
  neighbourhood: string | null   // new
}
```

`[id]/edit/page.tsx` requires no changes — `prisma.community.findUnique` without a `select` clause returns all fields automatically after migration.

### Form state

Add to the existing untyped `form` object (do not change the `displayOrder: String(...)` or `imageUrl` patterns):

```typescript
const [form, setForm] = useState({
  name:         initial?.name         ?? '',
  slug:         initial?.slug         ?? '',
  city:         initial?.city         ?? '',
  description:  initial?.description  ?? '',
  displayOrder: String(initial?.displayOrder ?? 0),
  municipality:  initial?.municipality  ?? null,   // new
  neighbourhood: initial?.neighbourhood ?? null,   // new
})
```

### New local state

```typescript
const [areas, setAreas]                               = useState<string[]>([])
const [municipalityOptions, setMunicipalityOptions]   = useState<string[]>([])
const [neighbourhoodOptions, setNeighbourhoodOptions] = useState<string[]>([])
const [fetchingMunicipality, setFetchingMunicipality] = useState(false)
const [fetchingNeighbourhood, setFetchingNeighbourhood] = useState(false)
const [showSuggestions, setShowSuggestions]           = useState(false)
```

### `handleSubmit` — full body

`imageUrl` remains a separate `useState<string>` (unchanged from current code). Show the complete `JSON.stringify` body:

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

Retain the existing `set()` helper for `name`, `slug`, `description`, and `displayOrder`. Use inline `onChange` handlers for `city` (combobox) and the two new fields.

### Combobox ref guards

Both refs are **one-shot guards** — consumed exactly once on the first effect run, then remain `false` permanently. The ref must be consumed (set to `false`) regardless of whether the early-exit guard fires, otherwise the first non-empty value after a null start would incorrectly skip resetting downstream fields:

```typescript
const cityMountRef         = useRef(true)
const municipalityMountRef = useRef(true)
```

### Area (`city`) — combobox

Replace the existing `<Input label="City *" ...>` with:

```tsx
{/* fetch areas on mount */}
useEffect(() => {
  fetch('/api/admin/communities/locations')
    .then(r => r.json())
    .then(d => setAreas(d.areas ?? []))
}, [])

{/* derived suggestion list — recalculated each render, no useMemo needed */}
const filteredAreas = areas.filter(a =>
  a.toLowerCase().includes(form.city.toLowerCase())
)

{/* JSX */}
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
            e.preventDefault() // prevents input blur before state update
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

Use `onMouseDown` + `e.preventDefault()` on suggestions (not `onClick`) — this fires before the input's `onBlur`, preventing the suggestion list from disappearing before the click registers.

### Municipality — cascading Select / Input

```typescript
useEffect(() => {
  // Always consume the ref on first run (even if city is empty) so that the
  // first non-empty city value does not incorrectly skip the cascade reset.
  const isMount = cityMountRef.current
  cityMountRef.current = false   // one-shot: stays false permanently

  if (!form.city) { setMunicipalityOptions([]); return }

  if (!isMount) {
    // user changed city after initial load — clear dependent fields
    setForm(f => ({ ...f, municipality: null, neighbourhood: null }))
    setNeighbourhoodOptions([])
  }

  setFetchingMunicipality(true)
  fetch(`/api/admin/communities/locations?area=${encodeURIComponent(form.city)}`)
    .then(r => r.json())
    .then(d => setMunicipalityOptions(d.municipalities ?? []))
    .finally(() => setFetchingMunicipality(false))
}, [form.city])
```

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
```

### Neighbourhood — cascading Select / Input

`form.city` must stay in the dependency array — it is used in the fetch URL; omitting it would capture a stale city value. The ref is consumed before the early-exit guard for the same reason as the municipality effect:

```typescript
useEffect(() => {
  // Consume ref before early exit so the first real selection doesn't skip reset.
  const isMount = municipalityMountRef.current
  municipalityMountRef.current = false   // one-shot: stays false permanently

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
}, [form.municipality, form.city])  // both required — form.city used in fetch URL
```

```tsx
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

---

## Migration

Update `prisma/schema.prisma`, then run:

```bash
npx prisma migrate dev --name add_community_location_fields
```

This generates the migration file, applies it, and regenerates the Prisma client. For prod: `npx prisma migrate deploy`.

---

## Files

### New

| Path | Purpose |
|---|---|
| `app/api/admin/communities/locations/route.ts` | GET distinct location values — Next.js static segments take precedence over `[id]` at the same level, so no routing conflict with the existing `[id]` route |

### Modified

| Path | Change |
|---|---|
| `prisma/schema.prisma` | Add `municipality` and `neighbourhood` to `Community` |
| `app/api/admin/communities/route.ts` | Accept `municipality` + `neighbourhood` in POST body |
| `app/api/admin/communities/[id]/route.ts` | Accept `municipality` + `neighbourhood` in PUT body |
| `components/admin/CommunityForm.tsx` | Imports, interface, form state, handleSubmit, cascading inputs |

---

## Out of Scope

- Using `municipality` or `neighbourhood` for listing matching on public pages
- Syncing these fields from the RESO/PropTx feed
- Validation that municipality belongs to the selected area
- Admin management of a separate location lookup table
