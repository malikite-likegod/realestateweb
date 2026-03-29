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
  @@unique([packageId, listingKey])   // prevent duplicate listings in same package
  @@map("listing_package_items")
}
```

`POST /api/listing-packages/[id]/items` must respond with 409 if the `listingKey` already exists in the package.

### New: `ListingPackageView`
Tracks when and how long a contact views a listing from a package.

```prisma
model ListingPackageView {
  id          String             @id @default(cuid())
  itemId      String
  item        ListingPackageItem @relation(fields: [itemId], references: [id], onDelete: Cascade)
  contactId   String             // copied from the package's contactId at insert time
  viewedAt    DateTime           @default(now())
  durationSec Int?               // filled in by PATCH from sendBeacon on exit

  @@index([itemId])
  @@map("listing_package_views")
}
```

`contactId` is resolved server-side by looking up `item.package.contactId` — it is never trusted from the client.

### Existing: `SavedSearch`
Already has `contactId`. Admin-created searches for contacts use a new admin-only endpoint (see API Routes below) — not the existing `/api/saved-searches` endpoint which only accepts contact session auth.

### `Contact` relation additions
Add `listingPackages ListingPackage[]` to the Contact model.

---

## Admin Features

### `/admin/listings/browse` — RESO Listing Browser
A new page alongside the existing `/admin/listings` (listing management) page. The existing page is for managing manually-entered custom listings; this new page browses MLS/RESO data.

- Full RESO property browser using the same filter set as the public side (city, community, property type, listing type, price range, beds, baths)
- No record cap — paginated at 24 per page, unlimited pages
- Checkbox multi-select on listing cards
- Sticky bottom action bar appears on selection:
  - **Send to Contact** — slide-over: contact search picker, package title, message textarea, listing preview, Send button
  - **Save Search for Contact** — slide-over: contact search picker, search name input, Save button
  - **Clear selection**
- When reached from a contact profile's "Browse & Send" button (`/admin/listings/browse?contactId=xxx`), the contact is pre-filled and the picker is skipped

### Contact Profile — "Listings" Tab
New tab added to the contact detail page alongside existing tabs (Notes, Activity, etc.).

**Packages section:**
- List of all packages sent to this contact: title, sent date, `X / Y listings viewed` stat
- Expand to see per-listing view counts and last viewed timestamp
- "Browse & Send" button opens `/admin/listings/browse?contactId=xxx`

**Saved Searches section:**
- List of saved searches for this contact: name, filter summary, last run date
- Run (opens browser with filters applied), Edit, Delete actions
- "Add Search" opens the same slide-over as the listing browser's "Save Search for Contact"

**Activity Feed section:**
- Chronological list of all listing interactions: package views, self-discovered saves, portal property visits
- Columns: listing address, action (viewed / saved), source (package name or "self-discovered"), timestamp, duration

---

## API Routes

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/admin/listings/browse` | RESO search, no cap, admin-auth |
| POST | `/api/listing-packages` | Create package + items, send email — admin-auth |
| GET | `/api/listing-packages?contactId=` | List packages for a contact — admin-auth |
| GET | `/api/listing-packages/[id]` | Package detail with view stats — admin-auth |
| POST | `/api/listing-packages/[id]/items` | Add items to existing package — admin-auth; 409 on duplicate listingKey |
| DELETE | `/api/listing-packages/[id]/items/[itemId]` | Remove item — admin-auth |
| POST | `/api/portal/packages/[token]/view` | Create view row on listing open — token-auth; returns `{ viewId }` |
| PATCH | `/api/portal/packages/[token]/view/[viewId]` | Update `durationSec` from sendBeacon on exit — token-auth |
| GET | `/api/portal/packages/[token]` | Resolve token → package data, sets portal session — public |
| POST | `/api/admin/contacts/[id]/saved-searches` | Create saved search for a contact — admin-auth |
| DELETE | `/api/admin/contacts/[id]/saved-searches/[searchId]` | Delete saved search — admin-auth |

---

## Portal

### Magic-Link Session
The existing `getContactSession()` requires `accountStatus === 'active'`, which many leads will not have. The token-resolution handler at `GET /api/portal/packages/[token]` (or the `/portal/packages/[token]` page server action) bypasses this check:

1. Look up `ListingPackage` by `magicToken` — 404 if not found
2. Load the associated `Contact`
3. Set a short-lived `portal_pkg_session` cookie: `{ contactId, packageId, expiresAt: +7days }`  signed with `JWT_SECRET`
4. Portal package pages and view-tracking endpoints validate this cookie directly — they do not call `getContactSession()`

This keeps the magic-link flow entirely separate from the full portal account system.

### `/portal/packages/[token]`
- Token resolved server-side → loads `ListingPackage` with items and `ResoProperty` data
- Sets `portal_pkg_session` cookie (see above)
- Renders:
  - Agent photo + name header
  - Package title and agent message
  - "View All [N] Listings" anchor link to listing grid below
  - Listing cards: photo, address, price, beds/baths, "View Listing" CTA
- Each "View Listing" CTA links to `/portal/properties/[listingKey]?packageItemId=[itemId]&token=[token]`
- The property page reads `packageItemId` + `token`, verifies `item.package.magicToken === token` (ownership check), then records the view

### View Tracking
- On portal property page load: `POST /api/portal/packages/[token]/view` with `{ itemId }`
  - Server verifies `item.package.magicToken === token` before inserting
  - `contactId` copied from `item.package.contactId` — never from client
  - Returns `{ viewId }`
- On page exit (beforeunload / visibilitychange): `sendBeacon` to `PATCH /api/portal/packages/[token]/view/[viewId]` with `{ durationSec }`
  - Updates the existing row — does not create a new one
- Self-discovered portal browsing continues to use existing `ContactPropertyInterest` tracking

---

## Email

Sent via existing SMTP stack using a new `sendListingPackageEmail()` function.

**Before sending:** check `contact.emailOptOut` — if true, abort and return an error to the admin ("This contact has opted out of email").

**Template structure:**
1. Agent photo + name + brokerage
2. Personalised intro message (written by admin)
3. Prominent CTA button: "View All [N] Listings in Your Portal" → magic link to `/portal/packages/[token]`
4. Listing cards (one per item): property photo, address, price, beds/baths/sqft, "View This Listing" button → magic link to `/portal/packages/[token]?open=[listingKey]` so portal auto-scrolls to that card
5. Standard footer with unsubscribe / contact info

---

## Error Handling

- **Expired / invalid magic token:** portal shows a friendly "This link has expired — contact your agent" page
- **SMTP failure on send:** package is saved with `sentAt = null` (draft state), admin sees error toast, can retry send from the Listings tab on the contact
- **Missing RESO property (delisted):** item renders as "Listing no longer available" card in portal and admin view
- **Duplicate listing in package:** `POST /items` returns 409; UI shows "Already in this package"
- **emailOptOut contact:** send is blocked server-side; admin sees an inline error before the email is attempted

---

## Out of Scope

- Push / SMS delivery of packages (email only for now)
- Package expiry / auto-archive
- Contact-initiated listing requests from the portal
- PDF export of packages
