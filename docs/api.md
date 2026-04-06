# LuxeRealty — API Reference

> Last updated: 2026-04-05  
> Base URL: `NEXT_PUBLIC_APP_URL` (e.g. `https://app.example.com`)

## Authentication

Most endpoints require a valid session cookie set during login. Two token types exist:

| Cookie | For | Set by |
|--------|-----|--------|
| `auth_token` | Admin/agent routes | `POST /api/auth/login` |
| `contact_token` | Portal routes | `POST /api/portal/login` |

API key auth (header `Authorization: Bearer <key>`) is accepted on `/api/ai/command`.

All auth cookies are `HttpOnly` and `Secure` in production.

---

## Error Responses

| Status | Meaning |
|--------|---------|
| 400 | Validation error — body contains Zod error array |
| 401 | Missing or expired session |
| 403 | IP blocked, rate limited, or insufficient role |
| 404 | Resource not found |
| 429 | Rate limit exceeded |
| 500 | Unexpected server error |

```json
// 400 validation error
{ "error": [{ "code": "invalid_string", "path": ["email"], "message": "Invalid email" }] }

// All others
{ "error": "Unauthorized" }
```

---

## Auth Endpoints

### `GET /api/auth/me`
Returns current admin session. No body required.

**Response 200**
```json
{ "user": { "id": "...", "name": "...", "email": "...", "role": "admin|agent|viewer", "avatarUrl": "..." } }
```

### `POST /api/auth/logout`
Clears `auth_token` cookie.

**Response 200** `{ "message": "Logged out" }`

### `POST /api/auth/forgot-password`
Sends a password reset email. Never reveals whether the email exists.

**Body** `{ "email": "string" }`  
**Response 200** `{ "ok": true }`

### `POST /api/auth/reset-password/validate`
Validates a password reset token before submitting a new password.

**Body** `{ "email": "string", "token": "string" }`  
**Response 200** `{ "valid": true|false, "message": "string?" }`

### `POST /api/auth/reset-password`
Completes password reset.

**Body** `{ "email": "string", "token": "string", "newPassword": "string" }`  
**Response 200** `{ "ok": true }`

### `POST /api/auth/2fa/enable`
Generates a TOTP secret and QR code for the current user.

**Response 200** `{ "secret": "...", "qrCode": "data:image/png;base64,..." }`

### `POST /api/auth/2fa/confirm`
Confirms TOTP setup with a 6-digit code.

**Body** `{ "code": "123456" }`  
**Response 200** `{ "enabled": true }`

### `POST /api/auth/2fa/clear`
Disables 2FA for the current user.

**Response 200** `{ "disabled": true }`

---

## Contacts

### `GET /api/contacts/[id]`
Returns a full contact record including phones, addresses, tags, activities, tasks, deals, and opt logs.

### `PATCH /api/contacts/[id]`
Updates a contact. All fields are optional.

**Body**
```json
{
  "firstName": "string",
  "lastName": "string",
  "email": "email",
  "phone": "string",
  "phones": [{ "label": "mobile|home|work|other", "number": "string", "isPrimary": true }],
  "addresses": [{
    "label": "home|work|other",
    "street": "string",
    "city": "string",
    "province": "string",
    "postalCode": "string",
    "country": "string",
    "isPrimary": true
  }],
  "company": "string",
  "jobTitle": "string",
  "source": "web|referral|idx|manual",
  "status": "lead|prospect|client|past_client",
  "notes": "string",
  "emailOptOut": false,
  "smsOptOut": false,
  "emailOptOutReason": "string",
  "smsOptOutReason": "string"
}
```

### `DELETE /api/contacts/[id]`
**Response 200** `{ "message": "Deleted" }`

### `POST /api/contacts/[id]/invite`
Sends a 72-hour portal invitation email to the contact.

**Response 200** `{ "message": "Invitation sent" }`

### `GET|POST|DELETE /api/contacts/[id]/tags`
Manage tags on a contact.

### `GET|POST /api/contacts/[id]/property-interests`
**POST body** `{ "resoPropertyId": "string", "notes": "string?" }`

### `GET|POST|DELETE /api/contacts/[id]/saved-searches`
Manage saved search filters for a contact.

---

## Deals & Pipeline

### `GET /api/deals`
Lists deals, optionally filtered by stage.

**Query** `?stageId=X`  
**Response** `{ "data": [...], "pipeline": [{ "stage": {...}, "deals": [...], "total": 0 }] }`

### `POST /api/deals`
**Body**
```json
{
  "title": "string",
  "stageId": "string",
  "value": 0,
  "probability": 0,
  "expectedClose": "ISO8601",
  "propertyId": "string?",
  "assigneeId": "string?",
  "contactIds": ["string"],
  "notes": "string?"
}
```

### `GET|PATCH|DELETE /api/deals/[id]`
Standard deal CRUD.

### `GET /api/deals/[id]/stage-history`
Returns stage transitions with time-in-stage durations.

### `GET|POST /api/stages`
Manage pipeline stages.

**POST body** `{ "name": "string", "order": 0, "color": "#hex?", "isDefault": false }`

### `GET /api/pipeline/report`
Returns pipeline analytics: conversion rates, time-in-stage averages.

---

## Email

### `GET /api/emails`
Returns paginated email thread for a contact.

**Query** `?contactId=X&page=1&pageSize=20`

### `POST /api/emails`
Sends an email. Accepts `multipart/form-data` (with attachments) or `application/json`.

**Body**
```json
{
  "contactId": "string",
  "subject": "string",
  "body": "HTML string",
  "toEmail": "string",
  "fromEmail": "string?",
  "ccEmails": ["string"],
  "templateId": "string?"
}
```

### `GET|PATCH|DELETE /api/emails/[id]`
Standard email CRUD.

### `GET /api/emails/track/[trackingId]`
Returns a 1×1 transparent pixel and records an open event. No auth required (used in email clients).

### `GET|POST /api/email-templates`
**POST body** `{ "name": "string", "subject": "string", "body": "HTML", "category": "follow_up|listing|newsletter|custom" }`

Both `subject` and `body` support two classes of merge tags substituted at send time.

**Contact & agent tags — `{{tagName}}`**

| Tag | Value |
|-----|-------|
| `{{firstName}}` | Contact first name |
| `{{lastName}}` | Contact last name |
| `{{fullName}}` | Contact full name |
| `{{email}}` | Contact email address |
| `{{phone}}` | Contact phone number |
| `{{agentName}}` | Agent name (DB setting → `AGENT_NAME` env fallback) |
| `{{agentEmail}}` | Agent email (DB setting → `AGENT_EMAIL` env fallback) |
| `{{agentPhone}}` | Agent phone (DB setting → `AGENT_PHONE` env fallback) |
| `{{agentDesignation}}` | Agent designation / title (DB setting) |
| `{{agentBrokerage}}` | Brokerage name (DB setting) |
| `{{officeAddress}}` | Office address (DB setting) |
| `{{agentBio}}` | Agent bio paragraph (DB setting) |
| `{{agentImage}}` | Agent photo URL (DB setting) |
| `{{MONTH}}` | Current month name (e.g. `April`) |
| `{{YEAR}}` | Current four-digit year |

Agent profile values are stored in `siteSettings` and editable at `/admin/settings` → Agent Profile card.

**Listing tags — `{{listing:MLSNUMBER:field}}`**

Embed live listing data by MLS number. The MLS# is matched against `Property.mlsNumber` (internal listings) and `ResoProperty.listingKey` / `ResoProperty.listingId` (RESO/MLS listings). Internal listings take precedence when both share the same number.

| Field | Value |
|-------|-------|
| `address` | Full formatted address |
| `price` | Price formatted as `$1,250,000` |
| `image` | First photo URL |
| `link` | Absolute URL to the public listing page |

Example usage in an HTML body:
```html
<img src="{{listing:C1234567:image}}" width="600" />
<p>
  <a href="{{listing:C1234567:link}}">
    {{listing:C1234567:address}} — {{listing:C1234567:price}}
  </a>
</p>
```

Tags for an unrecognised MLS# are left unchanged in the output. Multiple different listings can appear in the same template.

Unknown standard tags are also left as-is.

**Response 200** `{ "data": { "id": "...", "name": "...", "subject": "...", "body": "...", "category": "...", "isActive": true, "createdAt": "...", "updatedAt": "..." } }`

### `GET|PATCH|DELETE /api/email-templates/[id]`

---

## SMS

### `GET /api/sms`
Paginated SMS thread for a contact.

**Query** `?contactId=X&page=1&pageSize=50`

### `POST /api/sms`
Send to one contact or bulk-send to many.

**Single**
```json
{ "contactId": "string", "body": "string", "toNumber": "+1...", "mediaUrls": ["url"] }
```
**Bulk**
```json
{ "contactIds": ["id1", "id2"], "body": "string" }
```

### `GET|POST /api/calls`
Log or list call records.

**POST body**
```json
{
  "contactId": "string?",
  "direction": "in|out",
  "status": "completed|missed|voicemail|failed",
  "durationSec": 0,
  "notes": "string?",
  "recordingUrl": "string?",
  "fromNumber": "string?",
  "toNumber": "string?"
}
```

---

## Automation Campaigns

### `GET /api/campaigns`
**Query** `?trigger=new_lead|deal_stage_change|showing_scheduled|manual|special_event`

### `POST /api/campaigns`
```json
{
  "name": "string",
  "description": "string?",
  "trigger": "new_lead|deal_stage_change|showing_scheduled|manual|special_event",
  "triggerTagId": "string?",
  "isActive": true,
  "steps": [{
    "order": 1,
    "type": "send_email|send_sms|create_task|wait|update_lead_score|transfer_campaign|send_portal_invite",
    "config": {
      "subject": "string",
      "body": "HTML string",
      "templateId": "string?"
    },
    "delayMinutes": 0
  }]
}
```

### `GET|PATCH|DELETE /api/campaigns/[id]`

### `GET /api/campaigns/[id]/steps`
Returns ordered steps for a campaign. Used to populate the step picker when enrolling a contact at a specific starting point.

**Response 200**
```json
{ "data": [{ "id": "string", "order": 0, "type": "send_email|send_sms|wait|...", "delayMinutes": 0 }] }
```

### `POST /api/campaigns/[id]/enroll`
**Body**
```json
{
  "contactId": "string",
  "startAtStep": 0
}
```
`startAtStep` is zero-indexed and optional (defaults to `0`). Use it to skip earlier steps when re-enrolling a contact partway through a campaign. For bulk enroll use `contactIds` instead of `contactId` (step picker not supported for bulk).

### `GET /api/campaigns/[id]/enrollments`

### `GET|PATCH /api/campaigns/enrollments/[enrollmentId]`

---

## Automation Rules

Event-triggered rules (fire once per triggering event, not a drip sequence).

### `GET|POST /api/automation/rules`
**POST body**
```json
{
  "name": "string",
  "description": "string?",
  "trigger": "new_lead|deal_stage_changed|lead_inactive|listing_viewed|manual",
  "conditions": [{
    "field": "string",
    "operator": "gte|lte|eq|neq|contains",
    "value": "any"
  }],
  "actions": [{
    "type": "send_email|send_sms|assign_task|change_stage|enroll_campaign|update_score",
    "config": {}
  }]
}
```

### `GET|PATCH|DELETE /api/automation/rules/[id]`

---

## Tasks

### `GET /api/tasks`
**Query** `?status=todo|in_progress|done|cancelled&assigneeId=X&contactId=Y`

### `POST /api/tasks`
```json
{
  "title": "string",
  "description": "string?",
  "status": "todo|in_progress|done|cancelled",
  "priority": "low|normal|high|urgent",
  "dueAt": "ISO8601?",
  "startDatetime": "ISO8601?",
  "endDatetime": "ISO8601?",
  "allDay": false,
  "taskTypeId": "string?",
  "assigneeId": "string?",
  "contactId": "string?",
  "dealId": "string?"
}
```

### `GET|PATCH|DELETE /api/tasks/[id]`

### `GET|POST /api/task-types`
**POST body** `{ "name": "string", "color": "#hex?", "textColor": "#hex?", "highlightColor": "#hex?", "isDefault": false }`

---

## Activities

### `GET /api/activities`
**Query** `?contactId=X&dealId=Y&page=1`

### `POST /api/activities`
```json
{
  "type": "call|email|meeting|note|showing|task|deal_change",
  "subject": "string?",
  "body": "string?",
  "outcome": "string?",
  "durationMin": 0,
  "contactId": "string?",
  "dealId": "string?",
  "occurredAt": "ISO8601?"
}
```

---

## Listings (Internal)

### `GET /api/listings`
**Query** `?page=1&pageSize=20&status=active&search=keyword`

### `POST /api/listings`
```json
{
  "title": "string",
  "description": "string?",
  "propertyType": "string?",
  "listingType": "string?",
  "price": 0,
  "bedrooms": 0,
  "bathrooms": 0,
  "sqft": 0,
  "address": "string",
  "city": "string",
  "province": "string?",
  "postalCode": "string?",
  "latitude": 0.0,
  "longitude": 0.0,
  "images": ["url"],
  "features": {},
  "status": "active|sold|pending",
  "featured": false
}
```

### `GET|PATCH|DELETE /api/listings/[id]`

### `POST /api/listings/[id]/assign-contact`
**Body** `{ "contactId": "string" }`

---

## Property Search (Public)

### `GET /api/search`
Unified search across internal and RESO/MLS listings. No auth required.

**Query**
```
?source=all|internal|reso
&location=keyword
&city=string
&minPrice=0
&maxPrice=0
&minBeds=0
&maxBeds=0
&page=1
&pageSize=20
```

**Response** `{ "properties": [...], "total": 0, "page": 1 }`

### `GET /api/search/geo`
**Query** `?lat=43.6&lng=-79.3&radiusKm=5&page=1`

---

## Notes & Tags

### `GET|POST /api/notes`
**POST body** `{ "body": "string", "contactId": "string?", "dealId": "string?" }`

### `GET|POST /api/tags`
**POST body** `{ "name": "string", "color": "#hex?" }`

### `GET|PATCH|DELETE /api/tags/[id]`

---

## Calendar & Bookings

### `GET|POST /api/calendar/events`
**POST body** `{ "title": "string", "startAt": "ISO8601", "endAt": "ISO8601", "allDay": false, "description": "string?", "contactId": "string?", "dealId": "string?" }`

### `GET|POST /api/availability`
Manage agent booking schedules.

**POST body**
```json
{
  "slug": "string",
  "agentName": "string",
  "meetingTitle": "string?",
  "meetingDurationMin": 30,
  "bufferMinutes": 15,
  "advanceDays": 30,
  "timezone": "America/Toronto",
  "windows": [{ "dayOfWeek": 1, "startTime": "09:00", "endTime": "17:00" }]
}
```

### `GET /api/bookings`
**Query** `?status=confirmed|cancelled|rescheduled`

### `GET|PATCH /api/bookings/[id]`

---

## Contact Portal

All routes require `contact_token` cookie (except `validate` and package view).

### `GET /api/portal/session`
**Response 200** `{ "firstName": "string", "lastName": "string" }`

### `POST /api/portal/logout`

### `GET /api/portal/invite/validate`
Validates a portal invitation link. No auth required.

**Query** `?contactId=X&token=Y`  
**Response** `{ "valid": true, "firstName": "string?", "prefill": {}, "reason": "string?" }`

### `GET /api/portal/listings/[id]`
Returns a listing with images and features for portal display.

### `GET|POST /api/portal/saved`
**POST body** `{ "listingId": "string" }`

### `DELETE /api/portal/saved/[listingId]`

### `GET|POST /api/portal/reso-saved/[propertyId]`
Save/retrieve a RESO property.

### `GET|POST /api/portal/saved-searches`
**POST body** `{ "name": "string", "filters": {} }`

### `PATCH|DELETE /api/portal/saved-searches/[id]`

### `GET /api/portal/packages/[token]/view`
Returns a curated listing package by magic token. No auth required.

---

## Listing Packages

### `GET|POST /api/listing-packages`
**POST body** `{ "contactId": "string", "title": "string", "message": "string?", "items": ["listingKey1", "listingKey2"] }`

### `GET|PATCH|DELETE /api/listing-packages/[id]`

### `GET|POST /api/listing-packages/[id]/items`
**POST body** `{ "listingKey": "string" }`

---

## Content: Blog, Market Reports, Landing Pages

### `GET /api/blog` (public)
**Query** `?page=1&status=published`

### `POST /api/blog`
```json
{
  "title": "string",
  "excerpt": "string?",
  "body": "HTML",
  "coverImage": "url?",
  "status": "draft|published|archived",
  "authorName": "string?",
  "metaTitle": "string?",
  "metaDesc": "string?",
  "tags": ["string"]
}
```

### `GET|PATCH|DELETE /api/blog/[slug]`

### `GET|POST /api/market-reports`
**POST body**
```json
{
  "title": "string",
  "slug": "string",
  "reportMonth": "YYYY-MM?",
  "area": "string?",
  "excerpt": "string?",
  "body": "HTML",
  "coverImage": "url?",
  "status": "draft|published",
  "publishedAt": "ISO8601?",
  "authorName": "string?",
  "ctaTitle": "string?",
  "ctaSubtitle": "string?"
}
```

### `GET|PATCH|DELETE /api/market-reports/[slug]`

### `GET|POST /api/landing-pages`
**POST body**
```json
{
  "title": "string",
  "slug": "string",
  "content": "HTML",
  "status": "draft|published",
  "ctaTitle": "string?",
  "ctaSubtitle": "string?",
  "autoTags": ["string"],
  "agentName": "string?",
  "agentTitle": "string?",
  "agentPhoto": "url?",
  "agentBio": "string?",
  "metaTitle": "string?",
  "metaDesc": "string?"
}
```

### `GET|PATCH|DELETE /api/landing-pages/[slug]`

---

## Communities

### `GET|POST /api/admin/communities`
**POST body**
```json
{
  "name": "string",
  "slug": "string",
  "description": "string?",
  "imageUrl": "url?",
  "city": "string",
  "municipality": "string?",
  "neighbourhood": "string?"
}
```

### `GET|PATCH|DELETE /api/admin/communities/[id]`

---

## Notifications

### `GET /api/notifications`
Returns last 50 unread notifications for the current user.

### `POST /api/notifications`
Marks notifications as read.

**Body** `{ "ids": ["id1", "id2"] }` — omit `ids` to mark all as read.  
**Response** `{ "ok": true }`

---

## Users

### `GET /api/users`
**Response** `{ "data": [{ "id": "...", "name": "...", "email": "...", "role": "...", "avatarUrl": "..." }] }`

---

## AI Commands

### `POST /api/ai/command`
Requires `Authorization: Bearer <api_key>` header.

**Body**
```json
{
  "command": "create_task|log_activity|update_lead_score|create_contact|create_note|generate_listing_description",
  "data": {}
}
```

**Response** — command-specific result object.

---

## Admin Settings

### `GET /api/admin/settings`
Returns all site settings as key-value pairs.

### `PATCH /api/admin/settings`
**Body** `{ "key": "value", ... }` — any number of setting keys.

---

## Admin Security

### `GET|POST /api/admin/blocked-ips`
**POST body** `{ "ip": "1.2.3.4", "expiresAt": "ISO8601?" }`

### `DELETE /api/admin/blocked-ips`
**Body** `{ "ip": "1.2.3.4" }`

### `GET /api/admin/security-audit`
Returns security audit log with optional filters.

---

## Mock RESO Server (dev only)

Used to simulate the Amplify/TREB IDX feed during local development.

| Route | Purpose |
|-------|---------|
| `GET /api/mock-reso/Property` | Search properties (RESO filter params) |
| `GET /api/mock-reso/Property/[ListingKey]` | Single property |
| `GET /api/mock-reso/Member` | Search agents |
| `GET /api/mock-reso/Office` | Search offices |
