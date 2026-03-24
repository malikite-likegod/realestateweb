# Communities Feature — Design Spec

**Date:** 2026-03-23
**Status:** Approved

---

## Overview

Replace the hardcoded community pages with database-driven communities that an admin can create, edit, and delete. Each community has an uploaded image and a city name used to automatically match active listings.

---

## Data Model

### New: `Community`

```prisma
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

**Field notes:**
- `slug` — auto-generated from `name` on create (e.g. "Forest Hill" → `forest-hill`), editable in the form
- `city` — matched case-insensitively against `Property.city` to find listings
- `imageUrl` — path returned by the existing `/api/uploads` endpoint
- `displayOrder` — integer controlling the order communities appear on the public page (lower = first)

No changes to `Property`, `Listing`, or any other existing model.

---

## Admin Section

### Pages

| Route | Purpose |
|---|---|
| `app/admin/communities/page.tsx` | List all communities |
| `app/admin/communities/new/page.tsx` | Create community form |
| `app/admin/communities/[id]/edit/page.tsx` | Edit community form |

### List page

Table columns: image thumbnail, name, city, listing count (live count from `Property` matching), display order, edit link, delete button. Delete is a confirmed destructive action (confirmation dialog before API call).

### Create / Edit form

Fields:
- **Name** (text, required)
- **Slug** (text, required, auto-populated from name, editable)
- **City** (text, required — used for listing matching)
- **Description** (textarea, optional)
- **Display Order** (number, default 0)
- **Image** (file upload — POST to `/api/uploads`, stores returned URL in `imageUrl`)

On the edit form, current image is shown with an option to replace it.

### API Routes

| Method | Route | Auth | Action |
|---|---|---|---|
| `GET` | `/api/admin/communities` | admin session | List all communities |
| `POST` | `/api/admin/communities` | admin session | Create community |
| `GET` | `/api/admin/communities/[id]` | admin session | Get single community |
| `PUT` | `/api/admin/communities/[id]` | admin session | Update community |
| `DELETE` | `/api/admin/communities/[id]` | admin session | Delete community |

All routes require admin session via `getSession()`. Return `401` if not authenticated.

`POST` and `PUT` accept JSON body: `{ name, slug, description, imageUrl, city, displayOrder }`.

Slug uniqueness is validated on create and update — return `409` if slug already taken by another community.

---

## Public Pages

### Communities index — `app/(public)/communities/page.tsx`

Server component. Fetches all communities ordered by `displayOrder` asc, then `name` asc. For each community, also fetches the count of active `Property` records matching `community.city` (case-insensitive) that have at least one published `Listing`.

Replaces the existing hardcoded array with the database query. Layout and card design remain the same.

### Community detail — `app/(public)/communities/[slug]/page.tsx`

Server component. Fetches community by `slug`. Returns 404 if not found.

Fetches matching active listings:

```typescript
prisma.property.findMany({
  where: {
    city: { equals: community.city, mode: 'insensitive' },
    status: 'active',
    listings: { some: {} },
  },
  include: {
    listings: { select: { slug: true, featured: true } },
  },
  orderBy: { listedAt: 'desc' },
})
```

Maps results to `PropertySummary` (same shape used by `PropertyGrid`) and renders using the existing `PropertyGrid` component. Renders `<MlsDisclaimer variant="idx" />` at the bottom of the page.

Replaces the existing hardcoded slug lookup with the database query. Page structure remains the same.

---

## Listing Count Query (shared)

Used in both the admin list page and the public index page:

```typescript
prisma.property.count({
  where: {
    city: { equals: community.city, mode: 'insensitive' },
    status: 'active',
    listings: { some: {} },
  },
})
```

---

## Migration

Single migration adding the `communities` table. No changes to existing tables.

---

## Files

### New

| Path | Purpose |
|---|---|
| `app/admin/communities/page.tsx` | Admin community list |
| `app/admin/communities/new/page.tsx` | Create form |
| `app/admin/communities/[id]/edit/page.tsx` | Edit form |
| `app/api/admin/communities/route.ts` | GET list + POST create |
| `app/api/admin/communities/[id]/route.ts` | GET + PUT + DELETE single |
| `prisma/migrations/<timestamp>_add_communities/` | DB migration |

### Modified

| Path | Change |
|---|---|
| `prisma/schema.prisma` | Add `Community` model |
| `app/(public)/communities/page.tsx` | Replace hardcoded data with DB query |
| `app/(public)/communities/[slug]/page.tsx` | Replace hardcoded data with DB query + live listings |

---

## Out of Scope

- Community-specific landing page SEO metadata (meta title/description)
- Pinning individual listings to a community regardless of city
- Community hero banner or map view
- Pagination on the community detail listings (use existing 100-result cap)
