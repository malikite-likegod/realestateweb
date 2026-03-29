# Listing Packages — Design Spec
**Date:** 2026-03-29
**Status:** Approved

---

## Overview

Agents need to browse the full MLS catalogue, curate sets of listings for specific contacts, send them via branded email, and track which listings the contact viewed. Contacts access their curated listings through a magic-link portal — no login required.

---

## Data Model

### New: `ListingPackage`
A named set of listings sent to a contact.

```prisma
model ListingPackage {
  id         String               @id @default(cuid())
  contactId  String
  contact    Contact              @relation(fields: [contactId], references: [id], onDelete: Cascade)
  title      String
  message    String?              // agent's intro message
  magicToken String               @unique @default(uuid())
  sentAt     DateTime?            // null = draft, set on send
  createdAt  DateTime             @default(now())
  updatedAt  DateTime             @updatedAt
  items      ListingPackageItem[]

  @@index([contactId])
  @@map("listing_packages")
}
```

### New: `ListingPackageItem`
Individual RESO listings within a package.

```prisma
model ListingPackageItem {
  id         String               @id @default(cuid())
  packageId  String
  package    ListingPackage       @relation(fields: [packageId], references: [id], onDelete: Cascade)
  listingKey String               // ResoProperty.listingKey
  addedAt    DateTime             @default(now())
  views      ListingPackageView[]

  @@index([packageId])
  @@map("listing_package_items")
}
```

### New: `ListingPackageView`
Tracks when and how long a contact views a listing from a package.

```prisma
model ListingPackageView {
  id          String             @id @default(cuid())
  itemId      String
  item        ListingPackageItem @relation(fields: [itemId], references: [id], onDelete: Cascade)
  contactId   String
  viewedAt    DateTime           @default(now())
  durationSec Int?               // recorded on page exit via beacon

  @@index([itemId])
  @@map("listing_package_views")
}
```

### Existing: `SavedSearch`
Already has `contactId` — no schema changes needed. Admin can create saved searches on behalf of a contact from the listing browser.

### `Contact` relation additions
Add `listingPackages ListingPackage[]` to the Contact model.

---

## Admin Features

### `/admin/listings/browse` — RESO Listing Browser
- Full RESO property browser using the same filter set as the public side (city, community, property type, listing type, price range, beds, baths)
- No record cap — paginated at 24 per page, unlimited pages
- Checkbox multi-select on listing cards
- Sticky bottom action bar appears on selection:
  - **Send to Contact** — slide-over: contact search picker, package title, message textarea, listing preview, Send button
  - **Save Search for Contact** — slide-over: contact search picker, search name input, Save button
  - **Clear selection**
- When reached from a contact profile's "Browse & Send" button, the contact is pre-filled and the picker is skipped

### Contact Profile — "Listings" Tab
New tab added to the contact detail page alongside existing tabs (Notes, Activity, etc.).

**Packages section:**
- List of all packages sent to this contact: title, sent date, `X / Y listings viewed` stat
- Expand to see per-listing view counts and last viewed timestamp
- "Browse & Send" button opens `/admin/listings/browse?contactId=xxx`

**Saved Searches section:**
- List of saved searches for this contact: name, filter summary, last run date
- Run (opens browser with filters applied), Edit, Delete actions

**Activity Feed section:**
- Chronological list of all listing interactions: package views, self-discovered saves, portal property visits
- Columns: listing address, action (viewed / saved), source (package name or "self-discovered"), timestamp, duration

---

## API Routes

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/admin/listings/browse` | RESO search, no cap, admin-auth |
| POST | `/api/listing-packages` | Create package + items, send email |
| GET | `/api/listing-packages?contactId=` | List packages for a contact |
| GET | `/api/listing-packages/[id]` | Package detail with view stats |
| POST | `/api/listing-packages/[id]/items` | Add items to existing package |
| DELETE | `/api/listing-packages/[id]/items/[itemId]` | Remove item |
| POST | `/api/portal/packages/[token]/view` | Record a listing view (called from portal) |
| GET | `/api/portal/packages/[token]` | Resolve token → package data (portal-auth) |

Saved search creation for contacts reuses the existing `/api/saved-searches` endpoint (already accepts `contactId`).

---

## Portal

### `/portal/packages/[token]`
- Token resolved server-side → loads `ListingPackage` with items and `ResoProperty` data
- Sets portal session cookie for the contact (magic-link login — no password required)
- Renders:
  - Agent photo + name header
  - Package title and agent message
  - "View All [N] Listings" anchor link to listing grid below
  - Listing cards: photo, address, price, beds/baths, "View Listing" CTA
- Each "View Listing" CTA links to `/portal/properties/[listingKey]?packageItemId=[id]`
- `packageItemId` query param tells the property page to record a `ListingPackageView` on load and on exit (navigator.sendBeacon for duration)

### View Tracking
- On portal property page load: POST `/api/portal/packages/[token]/view` with `{ itemId, viewedAt }`
- On page exit (beforeunload / visibilitychange): sendBeacon with `{ itemId, durationSec }`
- Self-discovered portal browsing continues to use existing `ContactPropertyInterest` tracking

---

## Email

Sent via existing SMTP stack using a new `sendListingPackageEmail()` function.

**Template structure:**
1. Agent photo + name + brokerage
2. Personalised intro message (written by admin)
3. Prominent CTA button: "View All [N] Listings in Your Portal" → magic link to `/portal/packages/[token]`
4. Listing cards (one per item): property photo, address, price, beds/baths/sqft, "View This Listing" button → magic link with `?open=[listingKey]` so portal auto-scrolls to that card
5. Standard footer with unsubscribe / contact info

---

## Error Handling

- **Expired / invalid magic token:** portal shows a friendly "This link has expired — contact your agent" page
- **SMTP failure on send:** package is saved with `sentAt = null` (draft state), admin sees error toast, can retry send from the Listings tab on the contact
- **Missing RESO property (delisted):** item renders as "Listing no longer available" card in portal and admin view

---

## Out of Scope

- Push / SMS delivery of packages (email only for now)
- Package expiry / auto-archive
- Contact-initiated listing requests from the portal
- PDF export of packages
