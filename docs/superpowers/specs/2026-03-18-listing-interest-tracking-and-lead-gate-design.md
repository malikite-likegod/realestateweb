# Listing Interest Tracking & Lead Capture Gate — Design Spec

**Date:** 2026-03-18
**Status:** Approved

---

## Overview

Two related features that together improve lead capture and contact intelligence:

1. **Listing Interest Tracking** — Surface which properties a contact has viewed or been manually linked to, with a buyer-profile summary derived from their browsing behavior.
2. **Lead Capture Gate** — Limit anonymous visitors to a configurable number of free listing views before requiring them to register (name + email + email verification) to continue browsing.

---

## Feature 1: Listing Interest Tracking

### Goals

- Give agents a quick "buyer profile" for each contact based on their browsing behavior.
- Allow manual attachment of properties to contacts (from either the contact page or the listing page).
- Preserve a full audit-trail view history separate from the deduplicated interest records.

### Data Model

#### `ContactPropertyInterest` (new table)

| Field | Type | Notes |
|-------|------|-------|
| `id` | String (cuid) | Primary key |
| `contactId` | String | FK → Contact |
| `propertyId` | String | FK → Property |
| `source` | Enum: `manual \| auto` | `manual` = explicitly attached; `auto` = created on verified contact's listing view |
| `notes` | String? | Optional agent note |
| `createdAt` | DateTime | First attached/viewed |
| `updatedAt` | DateTime | Last viewed (auto-updated on repeat views) |

- Unique constraint on `(contactId, propertyId)` — one record per pair, updated on repeat views.
- `auto` records are created/upserted whenever a verified (identified) contact views a listing.
- `manual` records are created by the agent from the contact profile or listing detail page.
- The `Contact` model in `schema.prisma` must include a `propertyInterests ContactPropertyInterest[]` relation field (Prisma requires both sides of a relation).

**Note on IDs:** `BehaviorEvent.entityId` stores the `Property.id` (not `Listing.id`) when `eventType = listing_view`. The listing detail page URL uses `Property.id` as the route param. `ContactPropertyInterest.propertyId` is therefore consistent with `BehaviorEvent.entityId` — both reference `Property.id`. The View History tab joins on `entityId = property.id` cleanly.

#### `SiteSettings` (new table)

| Field | Type | Notes |
|-------|------|-------|
| `id` | String (cuid) | Primary key |
| `key` | String (unique) | Setting identifier |
| `value` | String | Stored as string, parsed by consumer |
| `updatedAt` | DateTime | Last modified |

Initial keys:
- `listing_gate_limit` — integer string, default `"3"`
- `listing_gate_enabled` — boolean string, default `"true"`

#### `EmailVerificationToken` (new table)

| Field | Type | Notes |
|-------|------|-------|
| `id` | String (cuid) | Primary key |
| `email` | String | Email the token was sent to |
| `firstName` | String | Captured from gate form |
| `lastName` | String | Captured from gate form |
| `tokenHash` | String | Hashed token (SHA-256) |
| `sessionId` | String | Browser session UUID (re_session cookie) |
| `returnUrl` | String? | The listing URL the visitor was trying to view when gated |
| `expiresAt` | DateTime | 24 hours from creation |
| `usedAt` | DateTime? | Set when token is consumed |
| `createdAt` | DateTime | |

- Single-use: once `usedAt` is set, token is invalid.
- `sessionId` is stored for audit/linking purposes but is not required to match during verification (cross-device support — see Verification Flow).

### Contact Profile UI

Located at `/app/admin/contacts/[id]/page.tsx` — a new **"Property Interests"** panel is added.

**Buyer Profile Summary (header of panel)**
- Auto-computed from the contact's BehaviorEvents and ContactPropertyInterest records.
- Displays: most common `propertyType`, price range browsed, most viewed city.
- Example: *"Mostly viewing: Detached · $600K–$900K · Ottawa"*
- Falls back to "No browsing data yet" if no events exist.

**Tab 1 — Interests**
- Lists all `ContactPropertyInterest` records for this contact.
- Columns: property thumbnail, address, price, property type, source badge (`Viewed` for `auto` / `Linked` for `manual`), date added, notes.
- **Add button** — opens a listing search modal; selecting a listing creates a `manual` interest record.
- **Remove button** per row — deletes the interest record (does not affect BehaviorEvents).
- Sorted by `updatedAt` descending.

**Tab 2 — View History**
- Reads directly from `BehaviorEvent` where `eventType = listing_view` and `contactId = contact.id`.
- Groups by `entityId` (which is `Property.id` — see ID note above), shows: property address, total view count, first seen, last seen.
- Read-only audit trail.

### Listing Detail Page — Assign Contact

On the admin listing detail page, an **"Assign Contact"** button opens a contact search modal. Selecting a contact creates a `ContactPropertyInterest` record (`source: manual`) linking that contact to the listing.

On the public listing detail page, no change for identified contacts — their views are tracked automatically via `BehaviorEvent` (existing) and a new `ContactPropertyInterest` upsert.

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/contacts/[id]/property-interests` | List interests + view history summary for a contact |
| `POST` | `/api/contacts/[id]/property-interests` | Manually attach a property to a contact |
| `DELETE` | `/api/contacts/[id]/property-interests/[propertyId]` | Remove a manual interest |
| `POST` | `/api/listings/[id]/assign-contact` | Attach a contact to a listing (from listing side) |

All endpoints are admin-only (JWT protected).

The existing `POST /api/behavior` endpoint is updated to upsert a `ContactPropertyInterest` (`source: auto`) when a `listing_view` event is tracked for an identified contact (i.e., `contactId` is present).

---

## Feature 2: Lead Capture Gate

### Goals

- Encourage anonymous visitors to register before browsing unlimited listings.
- Minimise friction for genuine leads while capturing their details.
- Give the agent full control over the view limit from the admin settings page.

### Session & View Tracking (Anonymous)

Cookies used by the gate system:

| Cookie | Value | Expiry | Flags | Purpose |
|--------|-------|--------|-------|---------|
| `re_session` | UUID v4 | 1 year | `HttpOnly; SameSite=Lax` | Persistent session ID, links anon behavior to future contact |
| `re_views` | JSON array of property IDs | 30 days | `SameSite=Lax` | Tracks which listings the visitor has viewed (not HttpOnly — read by middleware) |
| `re_pending` | email string | Session | `SameSite=Lax` | Set after gate form submitted; persists "waiting for verification" state across navigations |
| `re_verified` | contactId string | 1 year | `HttpOnly; Secure; SameSite=Lax` | Set after email verification; unlocks unrestricted browsing |

- `re_views` stores property IDs (not a raw count) so revisiting the same listing doesn't increment the gate counter.
- Unique property count is compared against `listing_gate_limit`.
- `Secure` flag is applied to `re_verified` (contains a contact ID — sensitive). Other cookies (`re_session`, `re_views`, `re_pending`) are not sensitive enough to require `Secure` in dev, but should have it added in production via environment-based config.

### Gate Trigger

**Cookie write constraint:** Next.js 15 Server Components cannot write cookies during render (`cookies()` is read-only in that context). Next.js Middleware CAN write cookies, but runs in the **Edge runtime** and cannot use Prisma or access the database. The gate logic is therefore split between middleware and the Server Component:

**Middleware responsibilities (cookie manipulation only):**
1. Read `re_views` cookie (JSON array of property IDs) and `re_session` cookie.
2. If current `propertyId` is not in the array: add it, write updated `re_views` on the response.
3. Set a request header `x-view-count: <n>` with the current unique view count.
4. If `re_verified` cookie is present: set `x-gate-bypass: true` header.
5. If `re_pending` cookie is present (submitted but not yet verified): set `x-gate-pending: true` header.

**Server Component responsibilities (gate decision):**
1. Read `x-view-count`, `x-gate-bypass`, and `x-gate-pending` headers from the incoming request.
2. Fetch `SiteSettings` from the database using `unstable_cache` with a 60-second revalidation — this is a standard Next.js server-side cached fetch, fully compatible with Server Components.
3. If `x-gate-bypass` is set: render normally, track BehaviorEvent.
4. If `x-gate-pending` is set: render "Waiting for verification" overlay.
5. If `x-view-count ≥ listing_gate_limit` AND `listing_gate_enabled = true`: render gate modal over blurred content.
6. Otherwise: render normally.

### Gate Modal

Non-dismissible overlay (no close button, clicking outside does nothing).

Fields:
- First Name (required)
- Last Name (required)
- Email (required, validated)

Submit button: **"Get Full Access"**

Subtext: *"We'll send you a quick verification link — then you can browse freely."*

**On submit:**
1. `POST /api/gate/submit` — creates `EmailVerificationToken`, sends verification email. Also stores `re_pending=<email>` cookie (session-scoped) so the "waiting" state persists across page navigations.
2. Modal transitions to **"Check your inbox"** state:
   - Shows the email address entered.
   - "Resend email" link (rate-limited: once per 60 seconds — enforced server-side by querying the most recent `EmailVerificationToken` for the `(email, sessionId)` pair and rejecting if `createdAt > now - 60s`).
3. Every listing page now shows a **"Waiting for verification"** overlay with the same "Check your inbox" message until the token is used. Middleware detects `re_pending` cookie (without `re_verified`) and sets `x-gate-pending: true` regardless of view count.

### Verification Email

- Subject: *"Confirm your email to browse listings"*
- Body: brief intro, large CTA button linking to `/verify-email?token=<raw-token>`
- Token is hashed (SHA-256) before storage; raw token only exists in the email link.
- Link expiry: 24 hours.

### Verification Flow (`/verify-email`)

1. Read `token` from query string, hash it, look up `EmailVerificationToken`.
2. Validate: exists, not expired (`expiresAt > now`), not already used (`usedAt` is null).
3. **Session match (cross-device aware):** If `re_session` cookie is present and matches `token.sessionId`, proceed normally. If `re_session` is absent or differs (e.g., visitor opened the email on a different device), still proceed — drop the session-match requirement and simply consume the token. This is intentional: a lead-capture gate is a friction incentive, not a security boundary, so cross-device verification is acceptable.
4. Mark `usedAt = now`.
5. Upsert `Contact` (`email`, `firstName`, `lastName`, `source: web`, `status: lead`).
6. Set `re_verified=<contactId>` cookie (1-year expiry, `HttpOnly`, `Secure`, `SameSite=Lax`). Clear `re_pending` cookie.
7. Redirect to the listing page the visitor was trying to view (stored in `EmailVerificationToken.returnUrl` or fallback to `/listings`).

If token is invalid/expired/already used: show error page with option to re-enter email and get a new link.

### Post-Verification Behavior

- `re_verified` cookie present → listing pages render normally, no gate.
- Each listing view fires `POST /api/behavior` with `contactId` from the cookie, creating `BehaviorEvent` + upserting `ContactPropertyInterest` (`source: auto`).
- Contact appears in CRM immediately on verification (before any manual agent action).

---

## Feature 3: Admin Settings Page

### Location

New page at `/app/admin/settings/page.tsx`. "Settings" link added to the admin sidebar.

### Lead Capture Section

| Setting | UI | Default |
|---------|----|-|
| Gate enabled | Toggle (on/off) | On |
| Free listing views before registration | Number input (min: 1) | 3 |

Save button hits `PATCH /api/admin/settings` with `{ listing_gate_limit: "5", listing_gate_enabled: "true" }`.

Settings are fetched server-side on listing pages with a 60-second revalidation cache — changes take effect within one minute, no redeployment needed.

### API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/admin/settings` | Admin JWT | Returns all `SiteSettings` as flat key/value object |
| `PATCH` | `/api/admin/settings` | Admin JWT | Upserts one or more settings by key |

**Middleware update required:** Add `/api/admin` to the `PROTECTED_PATHS` array in `middleware.ts` so all `/api/admin/*` routes require a valid admin JWT. The public gate routes (`/api/gate/submit`, `/api/gate/resend`, `/verify-email`) do not need protection — they are intentionally public and are not listed in `PROTECTED_PATHS`.

---

## Out of Scope

- Server-side fingerprinting to prevent gate bypass (cookie clearing is accepted behavior for a lead-capture incentive, not a security gate).
- Social login (Google/Facebook) as an alternative to email verification.
- Contact-facing "saved properties" dashboard (public-facing saved search feature).
- Notifications to agents when a new lead verifies their email (can be added later via existing automation rules).

---

## Affected Files (anticipated)

### New Files
- `prisma/migrations/` — new migration for 3 new tables
- `app/api/gate/submit/route.ts` — gate form submission + token creation
- `app/api/gate/resend/route.ts` — resend verification email
- `app/api/admin/settings/route.ts` — GET + PATCH site settings
- `app/api/contacts/[id]/property-interests/route.ts` — GET + POST interests
- `app/api/contacts/[id]/property-interests/[propertyId]/route.ts` — DELETE interest
- `app/api/listings/[id]/assign-contact/route.ts` — assign contact from listing side
- `app/(public)/verify-email/page.tsx` — email verification landing page
- `app/admin/settings/page.tsx` — admin settings page
- `components/admin/contacts/PropertyInterestsPanel.tsx` — contact profile panel
- `components/public/ListingGateModal.tsx` — gate modal component

### Modified Files
- `prisma/schema.prisma` — add 3 new models
- `app/(public)/listings/[id]/page.tsx` — gate logic + verified view tracking
- `app/api/behavior/route.ts` — upsert ContactPropertyInterest on listing_view for identified contacts
- `app/admin/contacts/[id]/page.tsx` — add PropertyInterestsPanel
- `components/admin/layout/Sidebar.tsx` — add Settings nav link
