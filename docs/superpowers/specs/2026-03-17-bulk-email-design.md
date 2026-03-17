# Bulk Email Sending — Design Spec
**Date:** 2026-03-17
**Status:** Approved

---

## Overview

Add bulk email sending to the LuxeRealty CRM. Users can select recipients by individual contact and/or by tag(s), compose or pick a template, preview the deduplicated recipient list, optionally schedule delivery, and send. Each recipient gets a personalized email via the existing job queue infrastructure.

---

## Goals

- Select recipients by tag(s), individual contacts, or a combination
- Deduplicate: contacts appearing in multiple selected tags or in both tag and individual selection receive exactly one email
- Skip contacts with no email address (with visible warning)
- Compose freely or start from a saved template; merge tags personalize each email
- Preview recipient list and optionally schedule before sending
- Per-contact open/click tracking via existing EmailMessage infrastructure
- No new database schema required

---

## Entry Points

### 1. Contacts List (`/admin/contacts`)
- Checkbox column added as first column; header checkbox selects all visible rows
- Selection toolbar appears when ≥1 contact is checked: "X selected", **Email Selected** button, **Clear** link
- Tag dropdown filter added alongside existing status pills — filter by tag(s) first, then select all visible to target a tag's contacts
- **Email Selected** navigates to `/admin/bulk-email?contactIds=c1,c2,...`

### 2. Dedicated Page (`/admin/bulk-email`)
- Accessible directly from admin nav
- Also the destination when arriving from the contacts list with pre-selected IDs

---

## Bulk Email Wizard (`/admin/bulk-email`)

### Step 1 — Recipients

Two modes, combinable:

**By Tag**
- Multi-select tag picker with color swatches and checkboxes
- Live count of unique recipients updates as tags are toggled

**Individual**
- Searchable contact list with checkboxes
- Pre-checked if arriving from contacts list via `?contactIds=` query param

Final recipient set = union of tag contacts + individual picks, deduplicated by contact ID.

### Step 2 — Compose

- Optional template picker — selecting a template pre-fills subject and body
- Subject input with merge tag picker
- HTML body editor with merge tag picker
- Reuses the existing `EmailComposer` component (extracted/adapted)

### Step 3 — Preview & Schedule

- Scrollable deduplicated recipient list: avatar, name, email address
- Warning banner: "X contacts have no email address and will be skipped"
- Optional scheduled date/time picker (defaults to "Send now" — immediate)
- **Send** button → `POST /api/emails/bulk` → success toast → redirect to contacts list

---

## API

### `POST /api/emails/bulk`

**Request body:**
```json
{
  "tagIds": ["tag1", "tag2"],
  "contactIds": ["c1", "c2"],
  "subject": "Hello {{firstName}}",
  "body": "<p>Hi {{firstName}}, ...</p>",
  "templateId": "optional-template-id",
  "scheduledAt": "2026-03-20T10:00:00Z"
}
```

At least one of `tagIds` or `contactIds` must be provided. `scheduledAt` is optional; omit for immediate send.

**Server logic:**
1. Fetch all contacts matching `tagIds` (via `ContactTag` join) + explicit `contactIds`
2. Deduplicate by contact ID
3. Filter out contacts with no email address — track count for response
4. Generate a shared `bulkSendId` (UUID) to group this blast
5. Create one `job_queue` entry per recipient (type: `bulk_email_send`)
6. Return `{ total, scheduled, skipped }`

**Response:**
```json
{ "total": 52, "scheduled": 49, "skipped": 3 }
```

---

## Job Queue

**New job type: `bulk_email_send`**

Payload per job:
```json
{
  "type": "bulk_email_send",
  "contactId": "c123",
  "subject": "Hello {{firstName}}",
  "body": "<p>Hi {{firstName}}, ...</p>",
  "templateId": "optional",
  "bulkSendId": "uuid"
}
```

**Runner behavior (one new case in existing switch statement):**
1. Load contact by `contactId`
2. Resolve merge tags using existing `resolveMergeTags(contact, subject, body)`
3. Call existing `sendEmail({ contactId, subject, body, templateId })`
4. Job runner's existing retry/error handling applies

`scheduledAt` on the job entry defers pickup until that time — already supported by the job queue.

---

## Tracking & Observability

- Each send creates an `EmailMessage` record (direction: `outbound`, status: `sent`/`failed`)
- `bulkSendId` stored in job payload for grouping (future reporting)
- Open/click tracking via existing pixel injection and `trackingId` per `EmailMessage`
- No new schema columns required

---

## Out of Scope (not in this spec)

- Bulk send reporting / analytics dashboard
- Unsubscribe / opt-out management
- Attachment support in bulk sends
- Per-send reply-to customization
- A/B subject line testing
