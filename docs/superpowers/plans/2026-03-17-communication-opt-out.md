# Communication Opt-Out Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-channel (email/SMS) opt-out to contacts, enforced at the service layer, with a full audit log and UI feedback on the contact detail page.

**Architecture:** Two boolean flags (`emailOptOut`, `smsOptOut`) on the Contact model track current state. A new `CommunicationOptLog` model stores every change as an append-only row. Guards at the top of `sendEmail()` and `sendSms()` block delivery for opted-out contacts and write an `'opted_out'` status record instead. The contact edit modal exposes toggles; the contact detail page shows badges and the opt log panel.

**Tech Stack:** Prisma ORM (SQLite), Next.js 15 App Router, TailwindCSS, Lucide React, Zod.

**Spec:** `docs/superpowers/specs/2026-03-17-communication-opt-out-design.md`

---

## Chunk 1: Data Layer + Service Enforcement

### Task 1: Schema migration

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add opt-out fields to the Contact model**

In `prisma/schema.prisma`, find the Contact model. After the `birthday` field (around line 68), add:

```prisma
  emailOptOut  Boolean  @default(false) // true = do not send email
  smsOptOut    Boolean  @default(false) // true = do not send SMS
```

Also add `optLogs` to the Contact relations block (before `@@map`):

```prisma
  optLogs           CommunicationOptLog[]
```

- [ ] **Step 2: Add the CommunicationOptLog model**

After the Contact model block (after its closing `}`), add this new model. Find the User model and check it has an `id String @id` — it does. Add:

```prisma
model CommunicationOptLog {
  id          String   @id @default(cuid())
  contactId   String
  contact     Contact  @relation(fields: [contactId], references: [id], onDelete: Cascade)
  channel     String   // 'email' | 'sms'
  action      String   // 'opt_in' | 'opt_out'
  changedAt   DateTime @default(now())
  changedById String?
  changedBy   User?    @relation(fields: [changedById], references: [id], onDelete: SetNull)
  reason      String?

  @@index([contactId, changedAt])
  @@map("communication_opt_log")
}
```

Also add the reverse relation to the User model. Find `model User` and add inside its relations block:

```prisma
  optLogEntries CommunicationOptLog[]
```

- [ ] **Step 3: Update status comments on EmailMessage and SmsMessage**

Find the `EmailMessage` model. Find the `status` field comment and update it:

```prisma
  status      String   @default("sent") // draft | sent | delivered | bounced | failed | opted_out
```

Find the `SmsMessage` model. Find the `status` field comment and update it:

```prisma
  status      String   // queued | sent | delivered | failed | received | opted_out
```

- [ ] **Step 4: Run the migration**

```bash
cd C:\Users\miket\Documents\realestateweb
npx prisma migrate dev --name add_communication_opt_out
```

Expected: migration created and applied, no errors. Prisma client regenerated.

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no output (clean).

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add emailOptOut/smsOptOut to Contact and CommunicationOptLog model"
```

---

### Task 2: Service enforcement — email

**Files:**
- Modify: `lib/communications/email-service.ts`

The `sendEmail()` function already fetches the contact for merge-tag resolution. Add `emailOptOut` to that select and insert the guard immediately after.

- [ ] **Step 1: Add `emailOptOut` to the contact select and insert the guard**

In `lib/communications/email-service.ts`, find the contact fetch inside `sendEmail()`:

```typescript
  const contact = await prisma.contact.findUnique({
    where:  { id: input.contactId },
    select: { firstName: true, lastName: true, email: true, phone: true },
  })
```

Replace it with:

```typescript
  const contact = await prisma.contact.findUnique({
    where:  { id: input.contactId },
    select: { firstName: true, lastName: true, email: true, phone: true, emailOptOut: true },
  })

  // Block delivery for opted-out contacts — record the attempt without sending
  if (contact?.emailOptOut) {
    return prisma.emailMessage.create({
      data: {
        contactId:  input.contactId,
        direction:  'outbound',
        status:     'opted_out',
        subject:    input.subject,
        body:       input.body,
        fromEmail,
        toEmail:    input.toEmail,
        templateId: input.templateId ?? null,
        trackingId: globalThis.crypto.randomUUID(),
        sentById:   input.sentById ?? null,
      },
      include: {
        contact:  { select: { firstName: true, lastName: true } },
        template: { select: { name: true } },
        sentBy:   { select: { name: true } },
      },
    })
  }
```

The guard must appear **before** the merge-tag rendering and SMTP call — right after the contact fetch.

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add lib/communications/email-service.ts
git commit -m "feat: block email delivery for opted-out contacts in sendEmail()"
```

---

### Task 3: Service enforcement — SMS

**Files:**
- Modify: `lib/communications/sms-service.ts`

`sendSms()` does not currently fetch the contact. Add a fetch at the top and insert the guard.

- [ ] **Step 1: Add contact fetch and opt-out guard to `sendSms()`**

In `lib/communications/sms-service.ts`, find `export async function sendSms(input: SendSmsInput) {`. Immediately after the opening brace, add:

```typescript
  // Block delivery for opted-out contacts — record the attempt without sending
  const contactPref = await prisma.contact.findUnique({
    where:  { id: input.contactId },
    select: { smsOptOut: true },
  })
  if (contactPref?.smsOptOut) {
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
      include: {
        contact: { select: { firstName: true, lastName: true } },
        sentBy:  { select: { name: true } },
      },
    })
  }
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add lib/communications/sms-service.ts
git commit -m "feat: block SMS delivery for opted-out contacts in sendSms()"
```

---

## Chunk 2: API + Edit Modal

### Task 4: Extend PATCH /api/contacts/[id] and GET

**Files:**
- Modify: `app/api/contacts/[id]/route.ts`

The PATCH handler already uses a `prisma.$transaction`. We extend it to handle opt-out changes. The GET handler is extended to include the opt log.

- [ ] **Step 1: Add opt-out fields to the Zod schema**

In `app/api/contacts/[id]/route.ts`, find `const updateSchema = z.object({`. Add these fields inside the schema (after `addresses`):

```typescript
  emailOptOut:   z.boolean().optional(),
  smsOptOut:     z.boolean().optional(),
  optOutReason:  z.string().optional(),
```

- [ ] **Step 2: Extend the PATCH handler to read opt-out fields and detect changes**

The PATCH handler currently does:

```typescript
const { birthday, phones, addresses, ...rest } = updateSchema.parse(body)
```

Change to:

```typescript
const { birthday, phones, addresses, emailOptOut, smsOptOut, optOutReason, ...rest } = updateSchema.parse(body)
```

Then the handler needs to know the contact's current opt-out values to detect changes. Add a fetch inside the try block, before the transaction:

```typescript
    // Fetch current opt-out state to detect changes
    const current = (emailOptOut !== undefined || smsOptOut !== undefined)
      ? await prisma.contact.findUnique({ where: { id }, select: { emailOptOut: true, smsOptOut: true } })
      : null

    // Auth for opt log entries — get session (best-effort; null = system)
    const { getSession } = await import('@/lib/auth')
    const session = await getSession()
```

- [ ] **Step 3: Extend the transaction to create opt log entries**

Find the existing transaction body. It currently updates the contact and handles phones/addresses. Extend it to handle opt-out fields:

```typescript
    const contact = await prisma.$transaction(async (tx) => {
      // Build scalar data including opt-out booleans if provided
      const scalarUpdate = {
        ...scalarData,
        ...(emailOptOut !== undefined ? { emailOptOut } : {}),
        ...(smsOptOut   !== undefined ? { smsOptOut   } : {}),
      }
      const updated = await tx.contact.update({ where: { id }, data: scalarUpdate })

      // Create opt log entry for email channel if it changed
      if (emailOptOut !== undefined && current && emailOptOut !== current.emailOptOut) {
        await tx.communicationOptLog.create({
          data: {
            contactId:   id,
            channel:     'email',
            action:      emailOptOut ? 'opt_out' : 'opt_in',
            changedById: session?.id ?? null,
            reason:      emailOptOut ? (optOutReason ?? null) : null,
          },
        })
      }

      // Create opt log entry for SMS channel if it changed
      if (smsOptOut !== undefined && current && smsOptOut !== current.smsOptOut) {
        await tx.communicationOptLog.create({
          data: {
            contactId:   id,
            channel:     'sms',
            action:      smsOptOut ? 'opt_out' : 'opt_in',
            changedById: session?.id ?? null,
            reason:      smsOptOut ? (optOutReason ?? null) : null,
          },
        })
      }

      // ... existing phone/address handling unchanged ...

      return updated
    })
```

Make sure the existing phone and address handling is preserved inside the transaction.

- [ ] **Step 4: Extend GET to include opt log**

Find the GET handler. It currently fetches the contact with several includes. Add `optLogs` to the include:

```typescript
      optLogs: {
        orderBy: { changedAt: 'desc' },
        take:    10,
        include: { changedBy: { select: { name: true } } },
      },
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add app/api/contacts/[id]/route.ts
git commit -m "feat: extend contacts PATCH to handle opt-out changes and log entries"
```

---

### Task 5: ContactEditModal — opt-out toggles

**Files:**
- Modify: `components/crm/ContactEditModal.tsx`

- [ ] **Step 1: Add `emailOptOut` and `smsOptOut` to the `ContactData` interface**

Find `interface ContactData {` and add:

```typescript
  emailOptOut: boolean
  smsOptOut:   boolean
```

- [ ] **Step 2: Add opt-out toggle state**

Find where `const [form, setForm] = useState({` is declared (around line 65). After it, add:

```typescript
  const [emailOptOut, setEmailOptOut] = useState(contact.emailOptOut)
  const [smsOptOut,   setSmsOptOut]   = useState(contact.smsOptOut)
  const [emailReason, setEmailReason] = useState('')
  const [smsReason,   setSmsReason]   = useState('')
```

- [ ] **Step 3: Include opt-out fields in the PATCH body**

Find the `handleSave` function. It builds the fetch body from `form`, `phones`, `addresses`. Add opt-out fields to the JSON body:

```typescript
        body: JSON.stringify({
          ...form,
          email:       form.email    || null,
          company:     form.company  || null,
          jobTitle:    form.jobTitle || null,
          source:      form.source   || null,
          birthday:    form.birthday || null,
          notes:       form.notes    || null,
          phones,
          addresses,
          emailOptOut,
          smsOptOut,
          // Only send reason when opting out; backend ignores it on opt-in
          optOutReason: (!emailOptOut && contact.emailOptOut) || (!smsOptOut && contact.smsOptOut)
            ? undefined
            : (emailOptOut && !contact.emailOptOut)
              ? emailReason || undefined
              : (smsOptOut && !contact.smsOptOut)
                ? smsReason || undefined
                : undefined,
        }),
```

Wait — the reason needs to be per-channel. Since the API only accepts one `optOutReason`, send it when either channel is being opted out. If both channels are being opted out at once the same reason applies to both (acceptable). Simplify:

```typescript
          emailOptOut,
          smsOptOut,
          optOutReason: (emailReason || smsReason) || undefined,
```

- [ ] **Step 4: Add toggle UI inside the modal form**

Find the modal's form body (look for the closing tags of the last field before the action buttons). Add a section for communication preferences before the save button:

```tsx
        {/* Communication preferences */}
        <div className="pt-2 border-t border-charcoal-100">
          <p className="text-xs font-semibold text-charcoal-500 uppercase tracking-wide mb-3">
            Communication Preferences
          </p>
          <div className="flex flex-col gap-3">

            {/* Email toggle */}
            <div>
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm text-charcoal-700">Receive email communications</span>
                <button
                  type="button"
                  onClick={() => { setEmailOptOut(v => !v); setEmailReason('') }}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
                    emailOptOut ? 'bg-red-500' : 'bg-green-500'
                  }`}
                >
                  <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                    emailOptOut ? 'translate-x-1' : 'translate-x-4'
                  }`} />
                </button>
              </label>
              {emailOptOut && !contact.emailOptOut && (
                <input
                  type="text"
                  value={emailReason}
                  onChange={e => setEmailReason(e.target.value)}
                  placeholder="Reason (optional)…"
                  className={`${INPUT_CLASS} mt-2 text-xs`}
                />
              )}
            </div>

            {/* SMS toggle */}
            <div>
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm text-charcoal-700">Receive SMS communications</span>
                <button
                  type="button"
                  onClick={() => { setSmsOptOut(v => !v); setSmsReason('') }}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
                    smsOptOut ? 'bg-red-500' : 'bg-green-500'
                  }`}
                >
                  <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                    smsOptOut ? 'translate-x-1' : 'translate-x-4'
                  }`} />
                </button>
              </label>
              {smsOptOut && !contact.smsOptOut && (
                <input
                  type="text"
                  value={smsReason}
                  onChange={e => setSmsReason(e.target.value)}
                  placeholder="Reason (optional)…"
                  className={`${INPUT_CLASS} mt-2 text-xs`}
                />
              )}
            </div>

          </div>
        </div>
```

The reason field appears only when the toggle is being switched from opted-in to opted-out (not when it was already opted out before opening the modal). When the user toggles back (opted-out → opted-in), the reason is cleared via `setEmailReason('')` / `setSmsReason('')`.

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add components/crm/ContactEditModal.tsx
git commit -m "feat: add opt-out toggles to ContactEditModal"
```

---

## Chunk 3: UI — Detail Page + Components

### Task 6: CommOptLogPanel component

**Files:**
- Create: `components/crm/CommOptLogPanel.tsx`
- Modify: `components/crm/index.ts`

- [ ] **Step 1: Create `CommOptLogPanel.tsx`**

Create `C:\Users\miket\Documents\realestateweb\components\crm\CommOptLogPanel.tsx`:

```tsx
'use client'

/**
 * CommOptLogPanel
 *
 * Collapsible panel showing current communication opt-out status for a contact
 * and the 10 most recent opt-in/opt-out log entries.
 */

import { useState } from 'react'
import { ChevronDown, Mail, MessageSquare } from 'lucide-react'
import { formatDate } from '@/lib/utils'

type OptLogEntry = {
  id:         string
  channel:    string
  action:     string
  changedAt:  Date | string
  reason:     string | null
  changedBy:  { name: string } | null
}

interface Props {
  emailOptOut: boolean
  smsOptOut:   boolean
  optLogs:     OptLogEntry[]
}

export function CommOptLogPanel({ emailOptOut, smsOptOut, optLogs }: Props) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="rounded-xl border border-charcoal-100 bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-charcoal-50 transition-colors"
      >
        <p className="text-xs font-semibold text-charcoal-700 uppercase tracking-wide">
          Communication Preferences
        </p>
        <ChevronDown
          size={14}
          className={`text-charcoal-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      {expanded && (
        <div className="border-t border-charcoal-100 px-4 py-3 flex flex-col gap-4">

          {/* Current status */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1.5 text-charcoal-600">
                <Mail size={13} /> Email
              </span>
              {emailOptOut
                ? <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full">Opted out</span>
                : <span className="text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full">Receiving</span>
              }
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1.5 text-charcoal-600">
                <MessageSquare size={13} /> SMS
              </span>
              {smsOptOut
                ? <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full">Opted out</span>
                : <span className="text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full">Receiving</span>
              }
            </div>
          </div>

          {/* Log history */}
          {optLogs.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <p className="text-xs font-semibold text-charcoal-400 uppercase tracking-wide">History</p>
              {optLogs.map(entry => (
                <div key={entry.id} className="flex items-start gap-2 text-xs text-charcoal-600">
                  <span className={`mt-0.5 shrink-0 w-1.5 h-1.5 rounded-full ${
                    entry.action === 'opt_out' ? 'bg-red-400' : 'bg-green-400'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <span className="font-medium capitalize">{entry.channel}</span>
                    {' '}
                    <span>{entry.action === 'opt_out' ? 'opted out' : 'opted in'}</span>
                    {entry.reason && <span className="text-charcoal-400"> — {entry.reason}</span>}
                  </div>
                  <div className="shrink-0 text-charcoal-400 text-right">
                    <div>{formatDate(new Date(entry.changedAt), { month: 'short', day: 'numeric' })}</div>
                    {entry.changedBy && <div>{entry.changedBy.name}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {optLogs.length === 0 && (
            <p className="text-xs text-charcoal-400">No preference changes recorded.</p>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Export from crm index**

In `components/crm/index.ts`, add at the end:

```typescript
export { CommOptLogPanel } from './CommOptLogPanel'
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add components/crm/CommOptLogPanel.tsx components/crm/index.ts
git commit -m "feat: add CommOptLogPanel component"
```

---

### Task 7: EmailComposer and SmsThread — opted-out notices

**Files:**
- Modify: `components/crm/EmailComposer.tsx`
- Modify: `components/crm/SmsThread.tsx`

- [ ] **Step 1: Add `emailOptOut` prop to `EmailComposer`**

In `components/crm/EmailComposer.tsx`, find `interface EmailComposerProps {` and add:

```typescript
  emailOptOut?: boolean
```

Find `export function EmailComposer({ emails, contactId, contactEmail }: EmailComposerProps)` and add `emailOptOut = false` to the destructuring:

```typescript
export function EmailComposer({ emails, contactId, contactEmail, emailOptOut = false }: EmailComposerProps) {
```

Find the compose form JSX (the `<form onSubmit={handleSend} ...>` block). Replace the entire form with a conditional:

```tsx
      {/* Compose form or opted-out notice */}
      {emailOptOut ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          This contact has opted out of email communications. Edit the contact to re-enable.
        </div>
      ) : (
        <form onSubmit={handleSend} className="rounded-xl border border-charcoal-200 bg-charcoal-50 p-4 flex flex-col gap-3">
          {/* ... existing form contents unchanged ... */}
        </form>
      )}
```

Preserve the email history section (the `{/* Email history */}` div) unchanged — it should render regardless of opt-out status.

- [ ] **Step 2: Add `smsOptOut` prop to `SmsThread`**

In `components/crm/SmsThread.tsx`, find the `interface` or props type for the component and add:

```typescript
  smsOptOut?: boolean
```

Add `smsOptOut = false` to the function destructuring.

Find the message input area at the bottom of the component (the `<form>` or `<div>` containing the text input and send button). Replace it with a conditional:

```tsx
      {smsOptOut ? (
        <div className="px-4 py-3 border-t border-charcoal-100 text-sm text-red-700 bg-red-50 rounded-b-xl">
          This contact has opted out of SMS communications. Edit the contact to re-enable.
        </div>
      ) : (
        /* ... existing input area unchanged ... */
      )}
```

The message thread history above remains visible regardless of opt-out status.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add components/crm/EmailComposer.tsx components/crm/SmsThread.tsx
git commit -m "feat: show opted-out notice in EmailComposer and SmsThread"
```

---

### Task 8: Contact detail page — fetch opt log, add badges, wire props

**Files:**
- Modify: `app/admin/contacts/[id]/page.tsx`

- [ ] **Step 1: Add opt log to the Prisma fetch**

In the `prisma.contact.findUnique` call inside `ContactDetailPage`, find the `include` block. Add:

```typescript
        optLogs: {
          orderBy: { changedAt: 'desc' },
          take:    10,
          include: { changedBy: { select: { name: true } } },
        },
```

- [ ] **Step 2: Add opt-out badges to the identity card**

Find the identity card section (around line 131, the `<Card>` containing the `<Avatar>` and the contact name). After the `<Badge>` that shows contact status (lead/client/etc.), add:

```tsx
              {/* Opt-out badges */}
              {(contact.emailOptOut || contact.smsOptOut) && (
                <div className="flex flex-wrap gap-1.5 justify-center">
                  {contact.emailOptOut && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                      <Mail size={10} /> Email opted out
                    </span>
                  )}
                  {contact.smsOptOut && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                      <MessageSquare size={10} /> SMS opted out
                    </span>
                  )}
                </div>
              )}
```

Add `MessageSquare` to the lucide-react import at the top of the file (it currently imports `Phone, Mail, MapPin, TrendingUp, Cake, Briefcase, Building2, Star`):

```typescript
import {
  Phone, Mail, MapPin, TrendingUp, Cake, Briefcase,
  Building2, Star, MessageSquare,
} from 'lucide-react'
```

- [ ] **Step 3: Pass `emailOptOut` to `EmailComposer`**

Find where `<EmailComposer` is rendered and add the prop:

```tsx
<EmailComposer
  emails={contact.emailMessages}
  contactId={contact.id}
  contactEmail={contact.email}
  emailOptOut={contact.emailOptOut}
/>
```

- [ ] **Step 4: Pass `smsOptOut` to `SmsThread`**

Find where `<SmsThread` is rendered and add the prop:

```tsx
<SmsThread
  messages={contact.smsMessages}
  contactId={contact.id}
  contactPhone={/* existing phone prop */}
  smsOptOut={contact.smsOptOut}
/>
```

- [ ] **Step 5: Pass `emailOptOut` and `smsOptOut` to `ContactEditModal`**

The `<ContactEditModal contact={contact} />` passes the whole contact object. Since `ContactData` interface now includes `emailOptOut` and `smsOptOut`, no change needed here as long as the Prisma query returns them (it does, they're scalar fields on Contact).

- [ ] **Step 6: Render `CommOptLogPanel` in the left sidebar**

Import `CommOptLogPanel` (it's already exported from `@/components/crm`). Add to the import at the top:

```typescript
import {
  NotesPanel, TaskList,
  CallLogger, SmsThread, EmailComposer, UnifiedTimeline,
  ContactEditModal, ContactTagEditor, ContactCampaigns,
  CommOptLogPanel,
} from '@/components/crm'
```

Find the left sidebar `<div className="flex flex-col gap-4">`. Add the panel at the bottom of the left sidebar (after `ContactTagEditor` or wherever makes sense):

```tsx
          <CommOptLogPanel
            emailOptOut={contact.emailOptOut}
            smsOptOut={contact.smsOptOut}
            optLogs={contact.optLogs}
          />
```

- [ ] **Step 7: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no output.

- [ ] **Step 8: Commit**

```bash
git add app/admin/contacts/[id]/page.tsx
git commit -m "feat: add opt-out badges, CommOptLogPanel, and pass props to EmailComposer and SmsThread"
```

---

## Final verification

- [ ] `npx tsc --noEmit` — no TypeScript errors
- [ ] Open a contact detail page — opt-out badges hidden when both are false
- [ ] Open contact edit modal — two toggle switches visible under "Communication Preferences"
- [ ] Toggle email opt-out ON — reason field appears; toggle back OFF — reason field disappears and clears
- [ ] Save → page reloads → "Email opted out" badge visible in identity card
- [ ] Open EmailComposer tab — opted-out notice shown; email history still visible
- [ ] Open SmsThread tab — opted-out notice shown; message history still visible
- [ ] CommOptLogPanel shows in left sidebar — expand it — log entry visible with correct action/channel/date
- [ ] Toggle opt-out back ON (opt back in) via modal — badge disappears; composers restore
- [ ] Check database: `npx prisma studio` → communication_opt_log table — two rows present (opt_out + opt_in)
