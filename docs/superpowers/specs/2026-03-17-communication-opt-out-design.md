# Communication Opt-Out — Design Spec
**Date:** 2026-03-17
**Status:** Approved

---

## Overview

Allow contacts to opt in and out of email and SMS communications independently. Contact data is never deleted. When a contact is opted out of a channel, sending is blocked at the service layer and surfaced clearly in the UI.

---

## Goals

- Separate opt-out per channel: email and SMS are independent
- Full audit log: every opt-in/opt-out records who changed it, when, and an optional reason
- Service-layer enforcement: no message reaches SMTP or Twilio for an opted-out contact regardless of call path (direct send, campaign automation, bulk email)
- UI feedback: opted-out status is visible on the contact detail page; compose areas are replaced with a notice rather than a disabled button

---

## Data Layer

### Contact model additions

Two boolean fields added to the existing `Contact` model:

```prisma
emailOptOut  Boolean  @default(false)
smsOptOut    Boolean  @default(false)
```

`false` = contact receives communications (default). `true` = opted out.

### New model: `CommunicationOptLog`

Stores every opt-in and opt-out event as an immutable append-only row.

```prisma
model CommunicationOptLog {
  id           String   @id @default(cuid())
  contactId    String
  contact      Contact  @relation(fields: [contactId], references: [id], onDelete: Cascade)
  channel      String   // 'email' | 'sms'
  action       String   // 'opt_in' | 'opt_out'
  changedAt    DateTime @default(now())
  changedById  String?  // FK → User; null for system-initiated changes
  changedBy    User?    @relation(fields: [changedById], references: [id], onDelete: SetNull)
  reason       String?  // optional free-text note from the admin

  @@index([contactId, changedAt])
  @@map("communication_opt_log")
}
```

### Transaction guarantee

When `PATCH /api/contacts/[id]` updates `emailOptOut` or `smsOptOut`, the boolean update and the opt log insertion happen inside a single `prisma.$transaction`. The boolean and the log row are always consistent.

---

## API

### `PATCH /api/contacts/[id]`

Existing endpoint. Accepts two new optional fields in the request body:

```json
{
  "emailOptOut": true,
  "smsOptOut":   false,
  "optOutReason": "Requested by contact via phone"
}
```

Behavior:
1. If `emailOptOut` is present and differs from the current value → update `Contact.emailOptOut` and insert a `CommunicationOptLog` row (`channel: 'email'`, `action: 'opt_out'` or `'opt_in'`, `changedById: session.id`, `reason: optOutReason`)
2. Same for `smsOptOut`
3. Both changes (if present) execute in a single transaction
4. `optOutReason` is only stored when the action is `'opt_out'`; ignored on opt-in

### Contact detail page data

The existing `GET /api/contacts/[id]` (or the server component fetch) is extended to include:
- `emailOptOut`, `smsOptOut` from the Contact record
- The 10 most recent `CommunicationOptLog` rows for that contact (for the opt log panel)

---

## Service Enforcement

### `sendEmail()` — `lib/communications/email-service.ts`

The existing contact fetch (already done for merge-tag resolution) gains `emailOptOut` in its `select`. Immediately after the fetch, before any rendering or SMTP call:

```typescript
if (contact?.emailOptOut) {
  return prisma.emailMessage.create({
    data: {
      contactId: input.contactId,
      direction: 'outbound',
      status:    'opted_out',
      subject:   input.subject,
      body:      input.body,
      fromEmail,
      toEmail:   input.toEmail,
      templateId: input.templateId ?? null,
      trackingId: globalThis.crypto.randomUUID(),
      sentById:   input.sentById ?? null,
    },
    include: { contact: { ... }, template: { ... }, sentBy: { ... } },
  })
}
```

No SMTP call is made. The returned `EmailMessage` record has `status: 'opted_out'`, which:
- Lets the job queue complete the job successfully (no throw → no retry)
- Provides a visible record in the contact's email history
- Returns a real record to the direct-send API route so the UI can surface it

### `sendSms()` — `lib/communications/sms-service.ts`

A contact fetch is added at the top of `sendSms()` (it does not currently fetch the contact):

```typescript
const contact = await prisma.contact.findUnique({
  where:  { id: input.contactId },
  select: { smsOptOut: true },
})
if (contact?.smsOptOut) {
  return prisma.smsMessage.create({
    data: {
      contactId:  input.contactId,
      direction:  'outbound',
      status:     'opted_out',
      body:       input.body,
      fromNumber: process.env.TWILIO_FROM_NUMBER ?? null,
      toNumber:   input.toNumber,
      sentById:   input.sentById ?? null,
      groupId:    input.groupId  ?? null,
    },
    include: { contact: { ... }, sentBy: { ... } },
  })
}
```

No Twilio call is made. Same reasoning as email: job completes, record exists, no retry.

### Coverage

All send paths are covered by these two guards:

| Call path | Covered by |
|---|---|
| Direct email (EmailComposer → `/api/emails`) | `sendEmail()` |
| Campaign automation (job queue `send_email_job`) | `sendEmail()` |
| Bulk email (job queue `bulk_email_send`) | `sendEmail()` |
| Direct SMS (SmsThread → `/api/sms`) | `sendSms()` |
| Campaign automation (job queue `send_sms_job`) | `sendSms()` |
| Group SMS (`sendGroupSms`) | `sendSms()` (called internally) |

---

## Admin UI

### Contact detail page — opt-out badges

Displayed in the contact header alongside name/email. Shown only when opted out:

- Red pill: **"Email opted out"**
- Red pill: **"SMS opted out"**

### Contact edit modal — preference toggles

Two toggle switches added to the existing edit form:

- **"Receive email communications"** — maps to `!emailOptOut`
- **"Receive SMS communications"** — maps to `!smsOptOut`

When switching either toggle to off (opting out), an optional **"Reason"** text field appears. The reason is sent as `optOutReason` in the PATCH body and stored in the opt log.

### EmailComposer — opted-out notice

When `contactEmail` is present but `emailOptOut` is `true`, the compose form is replaced with:

> *"This contact has opted out of email communications. Edit the contact to re-enable."*

The send button is not rendered. The email history section continues to show past messages (including any `opted_out` status rows).

### SmsThread — opted-out notice

When `contact.smsOptOut` is `true`, the message input area is replaced with:

> *"This contact has opted out of SMS communications. Edit the contact to re-enable."*

The thread history continues to display past messages.

### Communication opt log panel

A small collapsible section on the contact detail page (below the existing panels) titled **"Communication Preferences"**. Shows:

- Current status for each channel (opted in / opted out) with the date of the last change
- A chronological list of the 10 most recent opt log entries: channel, action, date, changed by (user name or "System"), reason

---

## Out of Scope

- Self-service unsubscribe links in email footers
- Automatic opt-out triggered by inbound SMS keywords (e.g. "STOP")
- Bulk opt-out management across multiple contacts
- Per-campaign opt-out (opt out of one campaign but not others)
