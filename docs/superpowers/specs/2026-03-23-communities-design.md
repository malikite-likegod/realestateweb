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

**Navigation:** Add a "Communities" nav item to `components/navigation/Sidebar.tsx` in the `navItems` array, after the "Listings" entry. Use the `MapPin` icon from `lucide-react` and set `href: '/admin/communities'`.

### List page

Table columns: image thumbnail, name, city, listing count (live count from `Property` matching), display order, edit link, delete button. Delete is a confirmed destructive action (confirmation dialog before API call).

Listing counts are fetched in parallel after the community list query using `Promise.all()` and the shared count query from the **Listing Count Query** section below.

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

All routes require an authenticated session via `getSession()`. Return `401` if `session` is null. No additional role check — this matches the existing pattern for all other admin API routes in this project (e.g., `/api/admin/settings`).

`POST` and `PUT` accept JSON body: `{ name, slug, description, imageUrl, city, displayOrder }`.

Slug uniqueness is validated on create and update — return `409` if slug already taken by another community.

`DELETE` simply removes the `Community` record. There are no foreign keys from `Community` to `Property` — listings are matched dynamically by city, so deleting a community has no effect on property or listing data.

Slug generation (create only, server-side): use `name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')`. This handles spaces, punctuation, and special characters. The generated slug is the default; the user can edit it before saving.

---

## Public Pages

### Communities index — `app/(public)/communities/page.tsx`

Server component. Fetches all communities ordered by `displayOrder` asc, then `name` asc. For each community, also fetches the count of active `Property` records matching `community.city` (case-insensitive) that have at least one published `Listing`.

Replaces the existing hardcoded array with the database query. Layout and card design remain the same. The existing `CommunityGrid` component expects objects shaped as `{ name, slug, description, image, listingCount }`. Map the DB result accordingly — `imageUrl` maps to `image`.

### Community detail — `app/(public)/communities/[slug]/page.tsx`

Server component. Fetches community by `slug`. If not found, call `notFound()` from `next/navigation` to render the 404 page.

Fetches matching active listings — only properties with at least one **published** listing (`publishedAt` not null):

```typescript
prisma.property.findMany({
  where: {
    city: { equals: community.city, mode: 'insensitive' },
    status: 'active',
    listings: { some: { publishedAt: { not: null } } },
  },
  orderBy: { listedAt: 'desc' },
})
```

Maps results to `PropertySummary` (same shape used by `PropertyGrid`) and renders using the existing `PropertyGrid` component. `PropertyCard` links to `/listings/${property.id}` — no listing slug needed. Renders `<MlsDisclaimer variant="idx" />` below the property grid.

If there are no matching properties, `PropertyGrid` renders its built-in empty state — no additional UI needed.

**Mapping note:** `Property.images` is stored as a JSON string. Parse it during mapping: `images: JSON.parse(property.images ?? '[]') as string[]`.

**Page structure:** Keep the existing structure unchanged:
1. `HeroSection` — `title={community.name}`, `subtitle={community.description ?? ''}`, `backgroundImage={community.imageUrl ?? ''}`
2. `ContentBlock` "About the Neighbourhood" — `body={community.description ?? ''}`. The single `description` field is intentionally used for both the hero subtitle and the neighbourhood body text (the old hardcoded `longDesc` distinction is dropped). If description is null, pass an empty string.
3. "Available Properties" heading + `PropertyGrid`
4. `<MlsDisclaimer variant="idx" />` — import from `@/components/mls`
5. Lead capture section — `<LeadCaptureForm source={\`community_${slug}\`} />` (kept as-is)

**`generateMetadata`:** Also fetch the community from the database using the slug. This results in two DB queries (one in `generateMetadata`, one in the page component) — accept the duplication; no caching optimization is required. Return `{ title: community.name, description: community.description ?? undefined }`. If the community is not found, return a fallback: `{ title: slug }`.

Replaces the existing hardcoded slug lookup with the database query.

---

## Listing Count Query (shared)

Used in both the admin list page and the public index page. Counts only properties with at least one published listing:

```typescript
prisma.property.count({
  where: {
    city: { equals: community.city, mode: 'insensitive' },
    status: 'active',
    listings: { some: { publishedAt: { not: null } } },
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
| `components/navigation/Sidebar.tsx` | Add Communities nav item after Listings |
| `app/(public)/communities/page.tsx` | Replace hardcoded data with DB query |
| `app/(public)/communities/[slug]/page.tsx` | Replace hardcoded data with DB query + live listings |

---

## Out of Scope

- Advanced SEO metadata beyond basic title/description on the detail page
- Pinning individual listings to a community regardless of city
- Community hero banner or map view
- Pagination on the community detail listings (use existing 100-result cap)
