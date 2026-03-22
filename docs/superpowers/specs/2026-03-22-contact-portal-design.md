# Contact Portal — Design Spec

**Date:** 2026-03-22
**Status:** Approved

---

## Overview

Allow real estate agents to invite contacts from the CRM to create a self-service portal account. Once verified, contacts can browse all property listings (active and historical) and save favourites.

---

## Goals

1. Admin sends a portal invitation to any contact that has an email address.
2. Contact sets up their account (password + phone + address) via a one-time invite link.
3. Phone number is verified via SMS OTP (Twilio).
4. Verified contacts can log in to `/portal` and browse all listings regardless of status.
5. Contacts can save and unsave listings.

---

## Non-Goals

- Contacts cannot edit their CRM profile (read-only portal).
- No contact-to-agent messaging in V1.
- No property search map view in V1.
- Contacts cannot self-register without an invitation.

---

## Schema Changes

### Contact model additions

Add four nullable fields to the existing `Contact` model in `prisma/schema.prisma`:

```prisma
passwordHash        String?   // bcrypt hash of contact's portal password
accountStatus       String?   // null = no account | 'invited' | 'active'
invitationTokenHash String?   // bcrypt hash of one-time invite token
invitationExpiresAt DateTime? // 72 hours after invitation sent
```

### New ContactSavedListing model

```prisma
model ContactSavedListing {
  id        String   @id @default(cuid())
  contactId String
  listingId String
  savedAt   DateTime @default(now())

  contact   Contact  @relation(fields: [contactId], references: [id], onDelete: Cascade)
  listing   Listing  @relation(fields: [listingId], references: [id], onDelete: Cascade)

  @@unique([contactId, listingId])
  @@map("contact_saved_listings")
}
```

Add `savedListings ContactSavedListing[]` relation to `Contact` and `Listing` models.

---

## Auth Architecture

Contact auth is completely separate from admin auth.

### New cookie: `contact_token`

- HttpOnly, Secure, SameSite=Lax
- JWT signed with the same `JWT_SECRET`
- Payload: `{ contactId, email, type: 'contact' }`
- Expiry: 7 days
- Separate from the admin `auth_token` cookie — no conflicts

### New function: `getContactSession()`

Added to `lib/auth.ts`. Mirrors the existing `getSession()` but reads `contact_token` and validates `payload.type === 'contact'`. Returns the full `Contact` record or `null`.

### Route protection

All `/portal/*` routes except `/portal/login` and `/portal/invite/[token]` call `getContactSession()` and redirect to `/portal/login` if it returns null.

---

## Invitation Flow

### Admin action

On the admin contact detail page (`/admin/contacts/[id]`), a **"Send Portal Invitation"** button is added to the contact header area. It is visible when:
- The contact has an email address
- `accountStatus` is null or `'invited'` (not `'active'`)

Button label changes to **"Resend Invitation"** when `accountStatus === 'invited'`.

**API endpoint:** `POST /api/contacts/[id]/invite`

1. Generates a cryptographically random 32-byte token
2. Hashes it with bcrypt (rounds = 10)
3. Stores hash + 72-hour expiry on the contact
4. Sets `accountStatus = 'invited'`
5. Sends invitation email via existing Nodemailer infrastructure

**Invitation email** contains a single CTA link:
```
{APP_URL}/portal/invite/{raw_token}?contactId={id}
```

---

## Account Setup Flow

### `/portal/invite/[token]` (public)

1. Reads `contactId` from query param, loads contact from DB
2. Validates: token not expired, bcrypt compares raw token against `invitationTokenHash`
3. If invalid/expired → shows error page with "Contact your agent for a new invitation"
4. If valid → shows account setup form with fields:
   - **Password** (min 8 chars) + **Confirm Password**
   - **Phone** (pre-filled if already on contact record, editable)
   - **Address** — Street, City, Province, Postal Code (pre-filled if on record, editable)
5. On submit:
   - Saves bcrypt-hashed password to `passwordHash`
   - Saves phone and address fields to contact record
   - Sets `accountStatus = 'invited'` (stays invited until phone verified)
   - Clears `invitationTokenHash` and `invitationExpiresAt`
   - Sends SMS OTP via Twilio (existing `phoneOtpCode` / `phoneOtpExpiresAt` fields)
   - Redirects to `/portal/verify-phone?contactId={id}`

### `/portal/verify-phone` (public, post-setup only)

1. Shows 6-digit OTP input
2. On submit: validates OTP against `phoneOtpCode` and `phoneOtpExpiresAt`
3. On success:
   - Sets `phoneVerified = true`
   - Sets `accountStatus = 'active'`
   - Issues `contact_token` JWT cookie
   - Redirects to `/portal`
4. "Resend code" button re-triggers the SMS

---

## Contact Login Flow

### `/portal/login` (public)

- Email + password form
- On submit: looks up contact by email, checks `accountStatus === 'active'`, bcrypt-compares password
- On success: issues `contact_token` JWT, redirects to `/portal`
- On failure: generic "Invalid email or password" error (no account enumeration)

### Logout

`POST /api/portal/logout` — clears `contact_token` cookie, redirects to `/portal/login`.

---

## Portal UI

### Layout

All portal pages share a minimal layout (`app/portal/layout.tsx`):
- Header: site logo + contact's first name + "Log out" button
- No sidebar
- Clean consumer-facing style (not the admin charcoal theme)

### Routes

| Route | Auth required | Purpose |
|---|---|---|
| `/portal/login` | No | Email + password login |
| `/portal/invite/[token]` | No | Account setup form |
| `/portal/verify-phone` | No | SMS OTP entry |
| `/portal` | Yes | All listings browse |
| `/portal/listings/[id]` | Yes | Single listing detail |
| `/portal/saved` | Yes | Contact's saved listings |

### `/portal` — Listings browse

- Filter bar: Status (All / Active / Sold / Expired), min/max price, min bedrooms
- Listing cards: primary photo, address, price, status badge, heart icon (save/unsave)
- Default sort: Active listings first, then by `listedAt` descending
- Fetches from `GET /api/portal/listings` (new endpoint)

### `/portal/listings/[id]` — Listing detail

- Photo gallery, address, price, status badge, bedrooms/bathrooms/sqft
- Save/unsave button
- Back to listings link

### `/portal/saved` — Saved listings

- Same card layout as browse, filtered to `ContactSavedListing` records for the contact
- Unsave button on each card

---

## API Endpoints

### Public (no contact session required)

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/contacts/[id]/invite` | Admin sends invitation (requires admin session) |
| GET | `/api/portal/invite/validate` | Validates invite token (params: contactId, token) |
| POST | `/api/portal/setup` | Completes account setup (password + phone + address) |
| POST | `/api/portal/verify-phone` | Validates SMS OTP, activates account |
| POST | `/api/portal/login` | Issues contact_token JWT |
| POST | `/api/portal/logout` | Clears contact_token cookie |

### Protected (contact session required)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/portal/listings` | All listings with optional filters |
| GET | `/api/portal/listings/[id]` | Single listing detail |
| GET | `/api/portal/saved` | Contact's saved listings |
| POST | `/api/portal/saved` | Save a listing `{ listingId }` |
| DELETE | `/api/portal/saved/[listingId]` | Unsave a listing |

---

## Data Flow Summary

```
Admin clicks "Send Portal Invitation"
  → POST /api/contacts/[id]/invite (admin session)
  → Token generated, hashed, stored on Contact
  → Invitation email sent via Nodemailer

Contact clicks email link → /portal/invite/[token]
  → Token validated against DB hash
  → Setup form: password + phone + address
  → POST /api/portal/setup
  → SMS OTP sent via Twilio

Contact enters OTP → /portal/verify-phone
  → POST /api/portal/verify-phone
  → accountStatus = 'active', phoneVerified = true
  → contact_token JWT issued → redirect to /portal

Contact browses listings → GET /api/portal/listings
  → All Listings with Property relation, no status filter by default
  → Heart icon → POST/DELETE /api/portal/saved

Returning contact → /portal/login
  → POST /api/portal/login
  → Bcrypt compare password, check accountStatus = 'active'
  → contact_token JWT issued
```

---

## Files to Create / Modify

### New files
- `prisma/migrations/…` — migration for 4 new Contact fields + ContactSavedListing
- `app/portal/layout.tsx` — portal shell layout
- `app/portal/login/page.tsx` — login page
- `app/portal/invite/[token]/page.tsx` — account setup page
- `app/portal/verify-phone/page.tsx` — OTP verification page
- `app/portal/(protected)/page.tsx` — listings browse
- `app/portal/(protected)/listings/[id]/page.tsx` — listing detail
- `app/portal/(protected)/saved/page.tsx` — saved listings
- `app/api/portal/login/route.ts`
- `app/api/portal/logout/route.ts`
- `app/api/portal/setup/route.ts`
- `app/api/portal/verify-phone/route.ts`
- `app/api/portal/listings/route.ts`
- `app/api/portal/listings/[id]/route.ts`
- `app/api/portal/saved/route.ts`
- `app/api/portal/saved/[listingId]/route.ts`
- `app/api/contacts/[id]/invite/route.ts`

### Modified files
- `prisma/schema.prisma` — add fields + ContactSavedListing model
- `lib/auth.ts` — add `getContactSession()`
- `app/admin/contacts/[id]/page.tsx` — add "Send Portal Invitation" button
