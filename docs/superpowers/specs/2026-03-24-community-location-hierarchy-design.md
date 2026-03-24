# Community Location Hierarchy — Design Spec

**Date:** 2026-03-24
**Status:** Approved

---

## Overview

Extend the `Community` model with two new optional fields — `municipality` and `neighbourhood` — representing the second and third levels of the MLS location hierarchy (Area → Municipality → Community/Neighbourhood). Update the admin create/edit form to use cascading, database-driven inputs that auto-populate from existing Community records.

---

## Background

The MLS system organises listings by a three-level geography:

| Level | Field | Example |
|---|---|---|
| 1 — Area | `city` (existing) | Toronto |
| 2 — Municipality | `municipality` (new) | Toronto C01 |
| 3 — Neighbourhood | `neighbourhood` (new) | Annex |

The existing `city` field already serves as Level 1 and is used to match listings on the public community pages. The two new fields are metadata — they describe where the community sits in the MLS hierarchy but do not change listing-matching logic.

---

## Data Model

### Modified: `Community`

```prisma
model Community {
  id           String   @id @default(cuid())
  name         String
  slug         String   @unique
  description  String?
  imageUrl     String?
  city         String        // Area (Level 1) — existing, used for listing matching
  municipality  String?      // Municipality (Level 2) — new
  neighbourhood String?      // Neighbourhood/Community (Level 3) — new
  displayOrder Int      @default(0)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@map("communities")
}
```

No changes to `Property`, `ResoProperty`, or any other model. Listing matching continues to use `city` only.

---

## API

### Existing routes — updated

`POST /api/admin/communities` and `PUT /api/admin/communities/[id]` accept the expanded body:

```typescript
{ name, slug, description, imageUrl, city, municipality, displayOrder, neighbourhood }
```

Both new fields are optional (`string | null`). `municipality` and `neighbourhood` are stored as-is (no uniqueness constraint).

### New route

**`GET /api/admin/communities/locations`** — returns distinct location values from existing Community records to populate cascade dropdowns.

Auth: admin session required (same `getSession()` guard as all other admin routes).

| Query params | Response |
|---|---|
| _(none)_ | `{ areas: string[] }` — distinct non-null `city` values, sorted A→Z |
| `?area=X` | `{ municipalities: string[] }` — distinct non-null `municipality` values where `city = X`, sorted A→Z |
| `?area=X&municipality=Y` | `{ neighbourhoods: string[] }` — distinct non-null `neighbourhood` values where `city = X` AND `municipality = Y`, sorted A→Z |

Returns empty arrays when no matching records exist — no 404.

---

## Admin Form

### `CommunityForm.tsx` — updated

The form adds two fields and converts the `city` field to a combobox.

#### Area (`city`) — combobox

- Free-text `<input>` with a suggestions dropdown beneath it.
- On mount and on each keystroke, filter the `areas` array (fetched once from `/api/admin/communities/locations` on component mount) client-side.
- Suggestions appear when the input has focus and the array is non-empty.
- Selecting a suggestion fills the input, hides suggestions, and triggers a municipality fetch.
- The field remains fully writable — the user can type a new area not in the list.
- When area value changes (by typing or selection), clear `municipality` and `neighbourhood`.

#### Municipality — cascading dropdown / text input

- Shows a `<select>` when municipalities are available for the selected area; shows a plain `<input type="text">` otherwise.
- Municipalities are fetched from `/api/admin/communities/locations?area=<city>` whenever `city` changes to a non-empty value.
- While fetching, disable the field.
- When municipality changes, clear `neighbourhood`.
- On the edit form, pre-populate with the saved value; re-fetch options using the saved area.

#### Neighbourhood — cascading dropdown / text input

- Same pattern as municipality but one level down.
- Options fetched from `/api/admin/communities/locations?area=<city>&municipality=<municipality>` whenever `municipality` changes to a non-empty value.
- On the edit form, pre-populate with the saved value; re-fetch options using saved area + municipality.

#### Empty-state behaviour

If the locations API returns an empty array for any level, render a plain `<input type="text">` instead of a `<select>`. This ensures the admin can always enter a value even when no prior records exist (bootstrap case).

---

## Migration

Single migration adding two nullable columns to `communities`:

```sql
ALTER TABLE "communities" ADD COLUMN "municipality" TEXT;
ALTER TABLE "communities" ADD COLUMN "neighbourhood" TEXT;
```

---

## Files

### New

| Path | Purpose |
|---|---|
| `app/api/admin/communities/locations/route.ts` | GET distinct location values |

### Modified

| Path | Change |
|---|---|
| `prisma/schema.prisma` | Add `municipality` and `neighbourhood` fields to `Community` |
| `prisma/migrations/<timestamp>_add_community_location_fields/` | DB migration |
| `app/api/admin/communities/route.ts` | Accept `municipality` + `neighbourhood` in POST body |
| `app/api/admin/communities/[id]/route.ts` | Accept `municipality` + `neighbourhood` in PUT body |
| `components/admin/CommunityForm.tsx` | Cascading location inputs |

---

## Out of Scope

- Using `municipality` or `neighbourhood` for listing matching on public pages
- Syncing municipality/neighbourhood from the RESO/PropTx feed into `ResoProperty`
- Validation that municipality belongs to the selected area (enforced by UX, not server)
- Admin management of a separate location lookup table
