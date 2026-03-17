# Bulk Email Sending Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add bulk email sending to the CRM — select recipients by tag(s) and/or individual contacts, compose or pick a template, preview the deduplicated list, optionally schedule, and send via the existing job queue.

**Architecture:** A new `POST /api/emails/bulk` endpoint deduplicates recipients, resolves contacts, and enqueues one `bulk_email_send` job per recipient using the existing `enqueueJob` / `runJob` infrastructure. The contacts list gains checkbox selection + a tag filter. A new `/admin/bulk-email` wizard page handles recipient selection, composition, preview, and send.

**Tech Stack:** Next.js 15 App Router (server + client components), Prisma ORM, existing `enqueueJob` from `lib/automation/job-queue.ts`, existing `sendEmail` from `lib/communications/email-service.ts`, TailwindCSS, Lucide React icons, Zod validation.

**Spec:** `docs/superpowers/specs/2026-03-17-bulk-email-design.md`

---

## Chunk 1: Backend

### Task 1: Extend job queue with `bulk_email_send` type

**Files:**
- Modify: `lib/automation/job-queue.ts`

- [ ] **Step 1: Add `bulk_email_send` to the `JobType` union**

In `lib/automation/job-queue.ts`, find the `JobType` export (line 21) and add the new type:

```typescript
export type JobType =
  | 'send_email_job'
  | 'send_sms_job'
  | 'execute_campaign_step'
  | 'evaluate_rules'
  | 'bulk_email_send'
```

- [ ] **Step 2: Add handler case in `runJob` switch**

In the same file, inside the `runJob` function, add a new `case` before the `default` (after the `evaluate_rules` block, around line 166):

```typescript
    case 'bulk_email_send': {
      const { sendEmail } = await import('@/lib/communications/email-service')
      // Note: sendEmail() resolves merge tags internally (spec "runner behavior step 2")
      // — no separate resolveMergeTags call is needed here.
      await sendEmail({
        contactId:  payload.contactId  as string,
        subject:    payload.subject    as string,
        body:       payload.body       as string,
        toEmail:    payload.toEmail    as string,
        templateId: payload.templateId as string | undefined,
      })
      break
    }
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /c/Users/miket/Documents/realestateweb && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors (or only pre-existing errors unrelated to job-queue.ts).

- [ ] **Step 4: Commit**

```bash
git add lib/automation/job-queue.ts
git commit -m "feat: add bulk_email_send job type to job queue"
```

---

### Task 2: Create `POST /api/emails/bulk` endpoint

**Files:**
- Create: `app/api/emails/bulk/route.ts`

- [ ] **Step 1: Create the file**

Create `app/api/emails/bulk/route.ts` with this content:

```typescript
import { NextResponse }  from 'next/server'
import { z }             from 'zod'
import { prisma }        from '@/lib/prisma'
import { enqueueJob }    from '@/lib/automation/job-queue'
import { getSession }    from '@/lib/auth'

const schema = z.object({
  tagIds:      z.array(z.string()).optional().default([]),
  contactIds:  z.array(z.string()).optional().default([]),
  subject:     z.string().min(1, 'Subject is required'),
  body:        z.string().min(1, 'Body is required'),
  templateId:  z.string().optional(),
  scheduledAt: z.string().datetime().optional(),
}).refine(
  d => d.tagIds.length > 0 || d.contactIds.length > 0,
  { message: 'Provide at least one tagId or contactId' },
)

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let parsed: z.infer<typeof schema>
  try {
    const body = await request.json()
    parsed = schema.parse(body)
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0]?.message ?? 'Invalid request' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { tagIds, contactIds, subject, body, templateId, scheduledAt } = parsed

  // Fetch contacts by tag(s)
  const tagContacts = tagIds.length > 0
    ? await prisma.contact.findMany({
        where:  { tags: { some: { tagId: { in: tagIds } } } },
        select: { id: true, email: true },
      })
    : []

  // Fetch individually-selected contacts
  const indivContacts = contactIds.length > 0
    ? await prisma.contact.findMany({
        where:  { id: { in: contactIds } },
        select: { id: true, email: true },
      })
    : []

  // Deduplicate by contact ID
  const contactMap = new Map<string, { id: string; email: string | null }>()
  for (const c of [...tagContacts, ...indivContacts]) contactMap.set(c.id, c)
  const allContacts = Array.from(contactMap.values())

  const runAt       = scheduledAt ? new Date(scheduledAt) : new Date()
  const bulkSendId  = crypto.randomUUID()
  let scheduled = 0
  let skipped   = 0

  for (const contact of allContacts) {
    if (!contact.email) { skipped++; continue }
    await enqueueJob('bulk_email_send', {
      contactId:   contact.id,
      toEmail:     contact.email,
      subject,
      body,
      templateId,
      bulkSendId,
    }, runAt)
    scheduled++
  }

  return NextResponse.json({
    total:     allContacts.length,
    scheduled,
    skipped,
  })
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no new errors in `app/api/emails/bulk/route.ts`.

- [ ] **Step 3: Smoke-test the endpoint manually**

Start the dev server (`npm run dev`), then in another terminal:

```bash
curl -s -X POST http://localhost:3000/api/emails/bulk \
  -H "Content-Type: application/json" \
  -d '{"subject":"Test","body":"Hello","contactIds":[]}' | cat
```

Expected: `{"error":"Provide at least one tagId or contactId"}` (400).

- [ ] **Step 4: Commit**

```bash
git add app/api/emails/bulk/route.ts
git commit -m "feat: add POST /api/emails/bulk endpoint"
```

---

## Chunk 2: Contacts List Updates

### Task 3: Add `Tag` type and update `ContactFilters` with tag dropdown

**Files:**
- Modify: `types/crm.ts`
- Modify: `components/crm/ContactFilters.tsx`

- [ ] **Step 1: Add `Tag` type to `types/crm.ts`**

Open `types/crm.ts` and add after the `ContactStatus` line (line 1):

```typescript
export type Tag = { id: string; name: string; color: string }
```

- [ ] **Step 2: Update `ContactFilters` to accept and display tags**

Replace the entire contents of `components/crm/ContactFilters.tsx` with:

```typescript
'use client'

/**
 * ContactFilters
 *
 * Status pill filters + optional tag dropdown for the contacts list.
 * Updates URL query params so the server page can filter server-side.
 */

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import type { Tag } from '@/types'

const STATUSES = [
  { value: '',            label: 'All' },
  { value: 'lead',        label: 'Lead' },
  { value: 'prospect',    label: 'Prospect' },
  { value: 'client',      label: 'Client' },
  { value: 'past_client', label: 'Past Client' },
]

interface ContactFiltersProps {
  tags?: Tag[]
}

export function ContactFilters({ tags }: ContactFiltersProps) {
  const router       = useRouter()
  const pathname     = usePathname()
  const searchParams = useSearchParams()
  const current      = searchParams.get('status') ?? ''
  const currentTag   = searchParams.get('tag')    ?? ''

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set(key, value)
    else        params.delete(key)
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      {STATUSES.map(s => (
        <button
          key={s.value}
          onClick={() => setParam('status', s.value)}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
            current === s.value
              ? 'bg-charcoal-900 text-white'
              : 'bg-charcoal-100 text-charcoal-600 hover:bg-charcoal-200'
          }`}
        >
          {s.label}
        </button>
      ))}

      {tags && tags.length > 0 && (
        <select
          value={currentTag}
          onChange={e => setParam('tag', e.target.value)}
          className="ml-2 px-2 py-1 rounded-full text-xs font-medium border border-charcoal-200 bg-white text-charcoal-600 focus:outline-none focus:ring-1 focus:ring-charcoal-400 cursor-pointer"
        >
          <option value="">All Tags</option>
          {tags.map(t => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
git add types/crm.ts components/crm/ContactFilters.tsx
git commit -m "feat: add Tag type and tag dropdown to ContactFilters"
```

---

### Task 4: Refactor contacts page to use a client shell with checkbox selection

**Files:**
- Create: `components/crm/ContactsClientShell.tsx`
- Modify: `components/crm/ContactTable.tsx`
- Modify: `components/crm/index.ts`
- Modify: `app/admin/contacts/page.tsx`

**Why a shell component?** The contacts page is a server component (can't hold React state), but checkbox selection requires `useState`. The shell is a thin client wrapper that owns selected-IDs state, renders filters + table, and shows the "Email Selected" toolbar.

- [ ] **Step 1: Update `ContactTable` to support checkbox selection**

Replace the entire contents of `components/crm/ContactTable.tsx` with:

```typescript
'use client'

import Link from 'next/link'
import { Avatar, Badge } from '@/components/ui'
import { formatDate } from '@/lib/utils'
import type { ContactWithTags } from '@/types'

const statusVariants: Record<string, 'default' | 'info' | 'success' | 'gold' | 'warning'> = {
  lead: 'info', prospect: 'warning', client: 'success', past_client: 'default',
}

interface ContactTableProps {
  contacts:          ContactWithTags[]
  selectedIds?:      Set<string>
  onToggle?:         (id: string) => void
  onToggleAll?:      (checked: boolean) => void
}

export function ContactTable({
  contacts,
  selectedIds,
  onToggle,
  onToggleAll,
}: ContactTableProps) {
  const selectable   = !!onToggle
  const allChecked   = selectable && contacts.length > 0 && contacts.every(c => selectedIds?.has(c.id))
  const someChecked  = selectable && !allChecked && contacts.some(c => selectedIds?.has(c.id))

  return (
    <div className="overflow-x-auto rounded-xl border border-charcoal-100">
      <table className="w-full text-sm">
        <thead className="bg-charcoal-50 border-b border-charcoal-100">
          <tr>
            {selectable && (
              <th className="px-4 py-3 w-10">
                <input
                  type="checkbox"
                  checked={allChecked}
                  ref={el => { if (el) el.indeterminate = someChecked }}
                  onChange={e => onToggleAll?.(e.target.checked)}
                  className="rounded border-charcoal-300 text-charcoal-900 cursor-pointer"
                />
              </th>
            )}
            {['Name', 'Email', 'Phone', 'Status', 'Lead Score', 'Added'].map(h => (
              <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-charcoal-500 uppercase tracking-wide">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-charcoal-100 bg-white">
          {contacts.map(c => (
            <tr
              key={c.id}
              className={`hover:bg-charcoal-50 transition-colors ${selectable && selectedIds?.has(c.id) ? 'bg-indigo-50' : ''}`}
            >
              {selectable && (
                <td className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={selectedIds?.has(c.id) ?? false}
                    onChange={() => onToggle?.(c.id)}
                    className="rounded border-charcoal-300 text-charcoal-900 cursor-pointer"
                  />
                </td>
              )}
              <td className="px-4 py-3">
                <Link href={`/admin/contacts/${c.id}`} className="flex items-center gap-3">
                  <Avatar name={`${c.firstName} ${c.lastName}`} size="sm" />
                  <div>
                    <p className="font-medium text-charcoal-900">{c.firstName} {c.lastName}</p>
                    {c.company && <p className="text-xs text-charcoal-400">{c.company}</p>}
                  </div>
                </Link>
              </td>
              <td className="px-4 py-3 text-charcoal-600">{c.email ?? '—'}</td>
              <td className="px-4 py-3 text-charcoal-600">{
                (() => {
                  const mobile  = c.phones.find(p => p.label === 'mobile')
                  const primary = c.phones.find(p => p.isPrimary)
                  const any     = c.phones[0]
                  return (mobile ?? primary ?? any)?.number ?? c.phone ?? ''
                })()
              }</td>
              <td className="px-4 py-3">
                <Badge variant={statusVariants[c.status] ?? 'default'} className="capitalize">
                  {c.status.replace('_', ' ')}
                </Badge>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="w-16 h-1.5 rounded-full bg-charcoal-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        c.leadScore >= 75 ? 'bg-green-500' :
                        c.leadScore >= 40 ? 'bg-gold-500' : 'bg-charcoal-300'
                      }`}
                      style={{ width: `${Math.min(c.leadScore, 100)}%` }}
                    />
                  </div>
                  <span className="text-xs text-charcoal-600 font-medium tabular-nums">{c.leadScore}</span>
                </div>
              </td>
              <td className="px-4 py-3 text-charcoal-400 text-xs">{formatDate(c.createdAt, { month: 'short', day: 'numeric', year: 'numeric' })}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 2: Create `ContactsClientShell.tsx`**

Create `components/crm/ContactsClientShell.tsx`:

```typescript
'use client'

/**
 * ContactsClientShell
 *
 * Client wrapper for the contacts list page. Owns checkbox selection state
 * and renders: tag/status filters, selection toolbar, contacts table.
 */

import { useState, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { Mail, X } from 'lucide-react'
import { ContactTable } from './ContactTable'
import { ContactFilters } from './ContactFilters'
import type { ContactWithTags, Tag } from '@/types'

interface Props {
  contacts: ContactWithTags[]
  tags:     Tag[]
}

export function ContactsClientShell({ contacts, tags }: Props) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else               next.add(id)
      return next
    })
  }

  function toggleAll(checked: boolean) {
    setSelected(checked ? new Set(contacts.map(c => c.id)) : new Set())
  }

  function clearSelection() {
    setSelected(new Set())
  }

  function emailSelected() {
    const ids = Array.from(selected).join(',')
    router.push(`/admin/bulk-email?contactIds=${ids}`)
  }

  return (
    <>
      <Suspense>
        <ContactFilters tags={tags} />
      </Suspense>

      {selected.size > 0 && (
        <div className="flex items-center gap-3 mb-3 px-4 py-2 bg-indigo-50 border border-indigo-200 rounded-lg text-sm">
          <span className="font-medium text-indigo-700">{selected.size} selected</span>
          <button
            onClick={emailSelected}
            className="flex items-center gap-1.5 px-3 py-1 bg-indigo-600 text-white rounded-md text-xs font-medium hover:bg-indigo-700 transition-colors"
          >
            <Mail size={13} />
            Email Selected
          </button>
          <button
            onClick={clearSelection}
            className="flex items-center gap-1 text-xs text-charcoal-500 hover:text-charcoal-700 transition-colors"
          >
            <X size={13} /> Clear
          </button>
        </div>
      )}

      <ContactTable
        contacts={contacts}
        selectedIds={selected}
        onToggle={toggle}
        onToggleAll={toggleAll}
      />
    </>
  )
}
```

- [ ] **Step 3: Export `ContactsClientShell` from the crm index**

In `components/crm/index.ts`, add at the end:

```typescript
export { ContactsClientShell } from './ContactsClientShell'
```

- [ ] **Step 4: Update `app/admin/contacts/page.tsx`**

Replace the contents of `app/admin/contacts/page.tsx` with:

```typescript
import { getSession }          from '@/lib/auth'
import { prisma }              from '@/lib/prisma'
import { DashboardLayout }     from '@/components/dashboard'
import { PageHeader }          from '@/components/layout'
import { ContactsClientShell } from '@/components/crm'
import { Button }              from '@/components/ui'
import type { ContactWithTags, Tag } from '@/types'
import Link                    from 'next/link'
import { UserPlus, Upload, Mail } from 'lucide-react'

interface Props {
  searchParams: Promise<{ status?: string; tag?: string }>
}

export default async function ContactsPage({ searchParams }: Props) {
  const session = await getSession()
  if (!session) return null

  const { status, tag } = await searchParams

  const where = {
    ...(status ? { status }                                           : {}),
    ...(tag    ? { tags: { some: { tagId: tag } } }                  : {}),
  }

  const [contacts, tags] = await Promise.all([
    prisma.contact.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        tags:   { include: { tag: true } },
        phones: { orderBy: { createdAt: 'asc' } },
      },
    }) as Promise<ContactWithTags[]>,
    prisma.tag.findMany({ orderBy: { name: 'asc' } }) as Promise<Tag[]>,
  ])

  return (
    <DashboardLayout user={session}>
      <PageHeader
        title="Contacts"
        subtitle={`${contacts.length}${status ? ` ${status.replace('_', ' ')}` : ''} contacts`}
        breadcrumbs={[{ label: 'Dashboard', href: '/admin/dashboard' }, { label: 'Contacts' }]}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" leftIcon={<Mail size={16} />} asChild>
              <Link href="/admin/bulk-email">Bulk Email</Link>
            </Button>
            <Button variant="outline" leftIcon={<Upload size={16} />} asChild>
              <Link href="/admin/contacts/import">Import Contacts</Link>
            </Button>
            <Button variant="primary" leftIcon={<UserPlus size={16} />} asChild>
              <Link href="/admin/contacts/new">Add Contact</Link>
            </Button>
          </div>
        }
      />
      <ContactsClientShell contacts={contacts} tags={tags} />
    </DashboardLayout>
  )
}
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 6: Manual verification**

- Open http://localhost:3000/admin/contacts
- Confirm checkboxes appear on each row
- Check a few rows → selection toolbar appears with count
- Click "Email Selected" → should redirect to `/admin/bulk-email?contactIds=...`
- Confirm tag dropdown in filters works (pick a tag → page reloads with filtered contacts)
- Confirm status pills still work as before

- [ ] **Step 7: Commit**

```bash
git add components/crm/ContactTable.tsx components/crm/ContactsClientShell.tsx components/crm/index.ts app/admin/contacts/page.tsx
git commit -m "feat: add checkbox selection and tag filter to contacts list"
```

---

## Chunk 3: Bulk Email Wizard

### Task 5: Create `BulkEmailWizard` component

**Files:**
- Create: `components/crm/BulkEmailWizard.tsx`
- Modify: `components/crm/index.ts`

This is a 3-step wizard:
- **Step 1** — Select recipients (by tag and/or individual, live count, deduplication in memory)
- **Step 2** — Compose (template picker, subject, body, merge tag picker)
- **Step 3** — Preview recipient list, schedule, send

- [ ] **Step 1: Create `BulkEmailWizard.tsx`**

Create `components/crm/BulkEmailWizard.tsx`:

```typescript
'use client'

/**
 * BulkEmailWizard
 *
 * 3-step wizard for sending a bulk email:
 *   1. Select recipients (by tag and/or individual contacts)
 *   2. Compose subject + body (with optional template + merge tags)
 *   3. Preview deduplicated list, schedule, and send
 */

import { useState, useRef, useEffect } from 'react'
import { useRouter }                   from 'next/navigation'
import { ChevronRight, ChevronLeft, Mail, Search, Check, Clock } from 'lucide-react'
import { Button, useToast }            from '@/components/ui'
import { MergeTagPicker }              from './MergeTagPicker'
import type { ContactWithTags, Tag }   from '@/types'

// ── Types ────────────────────────────────────────────────────────────────────

type EmailTemplate = { id: string; name: string; subject: string; body: string }

interface Props {
  contacts:        ContactWithTags[]
  tags:            Tag[]
  preSelectedIds?: string[]
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function computeRecipients(
  contacts:        ContactWithTags[],
  selectedTagIds:  string[],
  selectedIds:     string[],
): ContactWithTags[] {
  const tagSet  = new Set(selectedTagIds)
  const idSet   = new Set(selectedIds)
  const result  = new Map<string, ContactWithTags>()

  for (const c of contacts) {
    if (idSet.has(c.id) || c.tags.some(t => tagSet.has(t.tag.id))) {
      result.set(c.id, c)
    }
  }
  return Array.from(result.values())
}

// ── Component ────────────────────────────────────────────────────────────────

export function BulkEmailWizard({ contacts, tags, preSelectedIds = [] }: Props) {
  const router            = useRouter()
  const { toast }         = useToast()
  const bodyRef           = useRef<HTMLTextAreaElement>(null)

  // Step — always start at 1; preSelectedIds pre-populate selectedIds state below
  const [step, setStep]   = useState<1 | 2 | 3>(1)

  // Step 1 state — default to 'individual' mode when arriving with pre-selected contacts
  const [mode, setMode]             = useState<'tag' | 'individual'>(preSelectedIds.length > 0 ? 'individual' : 'tag')
  const [selectedTagIds, setTagIds] = useState<string[]>([])
  const [selectedIds, setIds]       = useState<string[]>(preSelectedIds)
  const [search, setSearch]         = useState('')

  // Step 2 state
  const [templates, setTemplates]   = useState<EmailTemplate[]>([])
  const [templateId, setTemplateId] = useState('')
  const [subject, setSubject]       = useState('')
  const [body, setBody]             = useState('')

  // Step 3 state
  const [scheduledAt, setScheduledAt] = useState('')
  const [sending, setSending]         = useState(false)

  // Load templates
  useEffect(() => {
    fetch('/api/email-templates')
      .then(r => r.json())
      .then(d => setTemplates(d.data ?? []))
      .catch(() => {})
  }, [])

  // Computed recipients (deduplicated)
  const recipients = computeRecipients(contacts, selectedTagIds, selectedIds)
  const withEmail  = recipients.filter(c => c.email)
  const noEmail    = recipients.filter(c => !c.email)

  // ── Step 1 helpers ──────────────────────────────────────────────────────

  function toggleTag(id: string) {
    setTagIds(prev =>
      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
    )
  }

  function toggleContact(id: string) {
    setIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  const filteredContacts = search.trim()
    ? contacts.filter(c =>
        `${c.firstName} ${c.lastName} ${c.email ?? ''}`.toLowerCase().includes(search.toLowerCase())
      )
    : contacts

  // ── Step 2 helpers ──────────────────────────────────────────────────────

  function pickTemplate(id: string) {
    setTemplateId(id)
    const tpl = templates.find(t => t.id === id)
    if (tpl) { setSubject(tpl.subject); setBody(tpl.body) }
  }

  // ── Step 3: Send ────────────────────────────────────────────────────────

  async function handleSend() {
    setSending(true)
    try {
      const res = await fetch('/api/emails/bulk', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          tagIds:      selectedTagIds,
          contactIds:  selectedIds,
          subject,
          body,
          templateId:  templateId || undefined,
          scheduledAt: scheduledAt || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Send failed')

      toast(
        'success',
        scheduledAt ? 'Emails scheduled' : 'Emails queued',
        `${data.scheduled} email${data.scheduled !== 1 ? 's' : ''} queued${data.skipped > 0 ? `, ${data.skipped} skipped (no email)` : ''}.`,
      )
      router.push('/admin/contacts')
    } catch (err) {
      toast(
        'error',
        'Send failed',
        err instanceof Error ? err.message : 'Something went wrong.',
      )
    } finally {
      setSending(false)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="max-w-3xl mx-auto">

      {/* Progress indicator */}
      <div className="flex items-center gap-2 mb-8">
        {(['Recipients', 'Compose', 'Preview & Send'] as const).map((label, i) => {
          const n = (i + 1) as 1 | 2 | 3
          return (
            <div key={label} className="flex items-center gap-2">
              <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold ${
                step === n ? 'bg-charcoal-900 text-white' :
                step > n   ? 'bg-green-500 text-white'   :
                             'bg-charcoal-100 text-charcoal-400'
              }`}>
                {step > n ? <Check size={12} /> : n}
              </div>
              <span className={`text-sm ${step === n ? 'font-semibold text-charcoal-900' : 'text-charcoal-400'}`}>{label}</span>
              {i < 2 && <ChevronRight size={14} className="text-charcoal-300" />}
            </div>
          )
        })}
      </div>

      {/* ── Step 1: Recipients ─────────────────────────────────────────── */}
      {step === 1 && (
        <div className="space-y-5">
          <h2 className="text-lg font-semibold text-charcoal-900">Select Recipients</h2>

          {/* Mode toggle */}
          <div className="flex gap-2">
            {(['tag', 'individual'] as const).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  mode === m ? 'bg-charcoal-900 text-white' : 'bg-charcoal-100 text-charcoal-600 hover:bg-charcoal-200'
                }`}
              >
                {m === 'tag' ? 'By Tag' : 'Individual'}
              </button>
            ))}
          </div>

          {mode === 'tag' && (
            <div className="space-y-2">
              {tags.length === 0 && (
                <p className="text-sm text-charcoal-400">No tags found. Add tags to contacts first.</p>
              )}
              {tags.map(tag => {
                const count = contacts.filter(c => c.tags.some(t => t.tag.id === tag.id)).length
                const active = selectedTagIds.includes(tag.id)
                return (
                  <button
                    key={tag.id}
                    onClick={() => toggleTag(tag.id)}
                    className={`flex items-center justify-between w-full px-4 py-2.5 rounded-lg border text-sm transition-colors ${
                      active ? 'border-indigo-400 bg-indigo-50 text-indigo-800' : 'border-charcoal-200 bg-white text-charcoal-700 hover:bg-charcoal-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: tag.color }} />
                      <span className="font-medium">{tag.name}</span>
                    </div>
                    <span className="text-xs text-charcoal-400">{count} contact{count !== 1 ? 's' : ''}</span>
                  </button>
                )
              })}
            </div>
          )}

          {mode === 'individual' && (
            <div className="space-y-2">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-charcoal-400" />
                <input
                  type="text"
                  placeholder="Search contacts..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-charcoal-200 text-sm focus:outline-none focus:ring-1 focus:ring-charcoal-400"
                />
              </div>
              <div className="max-h-72 overflow-y-auto divide-y divide-charcoal-100 rounded-lg border border-charcoal-100">
                {filteredContacts.map(c => {
                  const checked = selectedIds.includes(c.id)
                  return (
                    <label
                      key={c.id}
                      className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${checked ? 'bg-indigo-50' : 'bg-white hover:bg-charcoal-50'}`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleContact(c.id)}
                        className="rounded border-charcoal-300 text-charcoal-900"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-charcoal-900 truncate">{c.firstName} {c.lastName}</p>
                        <p className="text-xs text-charcoal-400 truncate">{c.email ?? 'No email'}</p>
                      </div>
                    </label>
                  )
                })}
              </div>
            </div>
          )}

          {/* Live recipient count */}
          <div className="text-sm text-charcoal-500">
            <span className="font-semibold text-charcoal-900">{recipients.length}</span> unique recipient{recipients.length !== 1 ? 's' : ''} selected
            {noEmail.length > 0 && <span className="text-amber-600 ml-2">({noEmail.length} have no email and will be skipped)</span>}
          </div>

          <div className="flex justify-end">
            <Button
              variant="primary"
              rightIcon={<ChevronRight size={16} />}
              disabled={recipients.length === 0 || withEmail.length === 0}
              onClick={() => setStep(2)}
            >
              Next: Compose
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 2: Compose ────────────────────────────────────────────── */}
      {step === 2 && (
        <div className="space-y-5">
          <h2 className="text-lg font-semibold text-charcoal-900">Compose Email</h2>

          {/* Template picker */}
          {templates.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-charcoal-500 uppercase tracking-wide mb-1">
                Start from template (optional)
              </label>
              <select
                value={templateId}
                onChange={e => pickTemplate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-charcoal-200 text-sm focus:outline-none focus:ring-1 focus:ring-charcoal-400 bg-white"
              >
                <option value="">— No template —</option>
                {templates.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Subject */}
          <div>
            <label className="block text-xs font-semibold text-charcoal-500 uppercase tracking-wide mb-1">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="Email subject…"
              className="w-full px-3 py-2 rounded-lg border border-charcoal-200 text-sm focus:outline-none focus:ring-1 focus:ring-charcoal-400"
            />
          </div>

          {/* Merge tags for subject */}
          <MergeTagPicker
            textareaRef={{ current: null }}
            value={subject}
            onChange={setSubject}
          />

          {/* Body */}
          <div>
            <label className="block text-xs font-semibold text-charcoal-500 uppercase tracking-wide mb-1">Body (HTML)</label>
            <textarea
              ref={bodyRef}
              value={body}
              onChange={e => setBody(e.target.value)}
              rows={10}
              placeholder="Email body (HTML supported)…"
              className="w-full px-3 py-2 rounded-lg border border-charcoal-200 text-sm focus:outline-none focus:ring-1 focus:ring-charcoal-400 font-mono resize-y"
            />
          </div>

          {/* Merge tags for body */}
          <MergeTagPicker
            textareaRef={bodyRef}
            value={body}
            onChange={setBody}
          />

          <div className="flex justify-between">
            <Button variant="outline" leftIcon={<ChevronLeft size={16} />} onClick={() => setStep(1)}>
              Back
            </Button>
            <Button
              variant="primary"
              rightIcon={<ChevronRight size={16} />}
              disabled={!subject.trim() || !body.trim()}
              onClick={() => setStep(3)}
            >
              Next: Preview
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 3: Preview & Send ─────────────────────────────────────── */}
      {step === 3 && (
        <div className="space-y-5">
          <h2 className="text-lg font-semibold text-charcoal-900">Preview & Send</h2>

          {/* Recipient list */}
          <div>
            <p className="text-sm text-charcoal-600 mb-2">
              <span className="font-semibold text-charcoal-900">{withEmail.length}</span> email{withEmail.length !== 1 ? 's' : ''} will be sent
            </p>
            {noEmail.length > 0 && (
              <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                <Mail size={13} />
                {noEmail.length} contact{noEmail.length !== 1 ? 's' : ''} have no email address and will be skipped:&nbsp;
                {noEmail.map(c => `${c.firstName} ${c.lastName}`).join(', ')}
              </div>
            )}
            <div className="max-h-64 overflow-y-auto divide-y divide-charcoal-100 rounded-lg border border-charcoal-100">
              {withEmail.map(c => (
                <div key={c.id} className="flex items-center gap-3 px-4 py-2.5 bg-white text-sm">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-charcoal-900 truncate">{c.firstName} {c.lastName}</p>
                    <p className="text-xs text-charcoal-400 truncate">{c.email}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Subject preview */}
          <div className="px-3 py-2 bg-charcoal-50 rounded-lg text-sm">
            <span className="text-xs font-semibold text-charcoal-400 uppercase tracking-wide mr-2">Subject:</span>
            <span className="text-charcoal-700">{subject}</span>
          </div>

          {/* Schedule */}
          <div>
            <label className="block text-xs font-semibold text-charcoal-500 uppercase tracking-wide mb-1">
              <Clock size={12} className="inline mr-1" />
              Schedule (optional — leave blank to send immediately)
            </label>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={e => setScheduledAt(e.target.value)}
              className="px-3 py-2 rounded-lg border border-charcoal-200 text-sm focus:outline-none focus:ring-1 focus:ring-charcoal-400 bg-white"
            />
          </div>

          <div className="flex justify-between">
            <Button variant="outline" leftIcon={<ChevronLeft size={16} />} onClick={() => setStep(2)}>
              Back
            </Button>
            <Button
              variant="primary"
              leftIcon={<Mail size={16} />}
              onClick={handleSend}
              disabled={sending || withEmail.length === 0}
            >
              {sending ? 'Sending…' : scheduledAt ? 'Schedule Send' : `Send to ${withEmail.length} Contact${withEmail.length !== 1 ? 's' : ''}`}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Export `BulkEmailWizard` from the crm index**

In `components/crm/index.ts`, add at the end:

```typescript
export { BulkEmailWizard } from './BulkEmailWizard'
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
git add components/crm/BulkEmailWizard.tsx components/crm/index.ts
git commit -m "feat: add BulkEmailWizard component (3-step wizard)"
```

---

### Task 6: Create `/admin/bulk-email` page and add sidebar nav link

**Files:**
- Create: `app/admin/bulk-email/page.tsx`
- Modify: `components/navigation/Sidebar.tsx`

- [ ] **Step 1: Create `app/admin/bulk-email/page.tsx`**

Create the directory and file `app/admin/bulk-email/page.tsx`:

```typescript
import { getSession }      from '@/lib/auth'
import { prisma }          from '@/lib/prisma'
import { DashboardLayout } from '@/components/dashboard'
import { PageHeader }      from '@/components/layout'
import { BulkEmailWizard } from '@/components/crm'
import type { ContactWithTags, Tag } from '@/types'

interface Props {
  searchParams: Promise<{ contactIds?: string }>
}

export default async function BulkEmailPage({ searchParams }: Props) {
  const session = await getSession()
  if (!session) return null

  const { contactIds: rawIds } = await searchParams
  const preSelectedIds = rawIds ? rawIds.split(',').filter(Boolean) : []

  const [contacts, tags] = await Promise.all([
    prisma.contact.findMany({
      orderBy: { firstName: 'asc' },
      take: 500,
      include: {
        tags:   { include: { tag: true } },
        phones: { orderBy: { createdAt: 'asc' } },
      },
    }) as Promise<ContactWithTags[]>,
    prisma.tag.findMany({ orderBy: { name: 'asc' } }) as Promise<Tag[]>,
  ])

  return (
    <DashboardLayout user={session}>
      <PageHeader
        title="Bulk Email"
        subtitle="Send a personalized email to multiple contacts"
        breadcrumbs={[
          { label: 'Dashboard', href: '/admin/dashboard' },
          { label: 'Contacts',  href: '/admin/contacts'  },
          { label: 'Bulk Email' },
        ]}
      />
      <BulkEmailWizard
        contacts={contacts}
        tags={tags}
        preSelectedIds={preSelectedIds}
      />
    </DashboardLayout>
  )
}
```

- [ ] **Step 2: Add "Bulk Email" entry to the sidebar**

Open `components/navigation/Sidebar.tsx`. Find the `navItems` array (around line 14). Add a new entry after the `Contacts` entry:

```typescript
{ label: 'Bulk Email', href: '/admin/bulk-email', icon: Mail },
```

Also add `Mail` to the lucide-react import at the top of that file. Find the existing import line (it will look like `import { LayoutDashboard, Users, ... } from 'lucide-react'`) and add `Mail` to it.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 4: Full end-to-end manual test**

With the dev server running (`npm run dev`):

1. **From sidebar**: Click "Bulk Email" in the left nav → page loads at `/admin/bulk-email`
2. **By Tag flow**:
   - Step 1: Select 1-2 tags → confirm recipient count updates correctly
   - Click "Next: Compose"
   - Step 2: Pick a template (pre-fills subject/body), edit, insert a merge tag
   - Click "Next: Preview"
   - Step 3: Confirm recipient list shows correctly with emails
   - Leave schedule blank, click "Send to N Contacts"
   - Confirm success toast appears and redirects to contacts list
3. **From contacts list**: Go to `/admin/contacts`, check 2-3 contacts, click "Email Selected" → lands on `/admin/bulk-email?contactIds=...` with those contacts pre-checked in Individual mode
4. **Scheduled send**: Repeat step 2 but set a future date/time → confirm "Schedule Send" button text, send, confirm jobs appear in DB with future `runAt`

- [ ] **Step 5: Commit**

```bash
git add app/admin/bulk-email/page.tsx components/navigation/Sidebar.tsx
git commit -m "feat: add /admin/bulk-email page and sidebar nav link"
```

---

## Final verification

- [ ] Run `npx tsc --noEmit` — no new TypeScript errors
- [ ] All 3 steps of the wizard work end-to-end
- [ ] Tag filter on contacts list filters correctly
- [ ] Checkbox "select all" selects current page only
- [ ] "Email Selected" from contacts list pre-populates wizard with correct contacts
- [ ] Skipped contacts (no email) are shown with a warning in step 3
- [ ] Scheduled sends appear in `job_queue` with future `runAt`
