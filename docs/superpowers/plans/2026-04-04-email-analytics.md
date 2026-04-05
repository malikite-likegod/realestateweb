# Email Campaign Analytics Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an email campaign analytics section at `/admin/communications/email-analytics` showing open/click rates per bulk email campaign, with a per-contact drilldown.

**Architecture:** A new `EmailCampaign` Prisma model groups bulk-sent `EmailMessage` records. The bulk send route creates an `EmailCampaign` record before enqueuing jobs; the job runner forwards `campaignId` to `sendEmail()`, which writes it onto each `EmailMessage`. Two new server-component pages and one reusable stat cards component surface the data.

**Tech Stack:** Next.js 16 App Router (server components), Prisma + PostgreSQL, TypeScript, Tailwind CSS, Lucide icons. No test framework — use `npm run build` to catch type errors.

**Spec:** `docs/superpowers/specs/2026-04-04-email-analytics-design.md`

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `prisma/schema.prisma` | Add `EmailCampaign` model + `EmailMessage.campaignId` FK |
| Modify | `lib/communications/email-service.ts` | Add `campaignId` to `SendEmailInput` and both `create` calls |
| Modify | `lib/automation/job-queue.ts` | Forward `campaignId` from job payload to `sendEmail()` |
| Modify | `app/api/emails/bulk/route.ts` | Create `EmailCampaign` before fan-out, add `campaignId` to payloads |
| Create | `components/communications/CampaignStatsCards.tsx` | Reusable row of 4 stat cards |
| Create | `app/admin/communications/email-analytics/page.tsx` | Campaign list page |
| Create | `app/admin/communications/email-analytics/[id]/page.tsx` | Campaign detail page |
| Modify | `app/admin/communications/page.tsx` | Add "Email Analytics" nav link |

---

## Chunk 1: Data Layer

### Task 1: Add `EmailCampaign` schema + migrate

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add `EmailCampaign` model to schema**

Open `prisma/schema.prisma`. Find the `// ─── Analytics / Tracking` section (search for `VisitorLog`). Add the new model immediately before it:

```prisma
// EmailCampaign: groups all EmailMessage records sent in one bulk send.
model EmailCampaign {
  id             String         @id @default(cuid())
  name           String         // always mirrors subject line — not user-editable
  subject        String
  sentAt         DateTime       @default(now())  // scheduled time or now() at queue time
  recipientCount Int            @default(0)      // contacts with valid email, after dedup
  createdAt      DateTime       @default(now())
  emails         EmailMessage[]

  @@map("email_campaigns")
}
```

- [ ] **Step 2: Add `campaignId` FK to `EmailMessage`**

In the `EmailMessage` model block, find the line `imapMessageId String? @unique` and add after it:

```prisma
campaignId    String?
campaign      EmailCampaign? @relation(fields: [campaignId], references: [id], onDelete: SetNull)
```

- [ ] **Step 3: Push schema to database**

**Locally** (development):
```bash
npx prisma db push
```

**On the production server** (`npx` is NOT available in the Docker runtime image — use this instead):
```bash
docker compose exec app node node_modules/prisma/build/index.js db push
```

Expected output: `Your database is now in sync with your Prisma schema.`

If you see `EACCES unlink index.js` after the sync message — that is harmless, the migration applied successfully.

- [ ] **Step 4: Regenerate Prisma client**

**Locally:**
```bash
npx prisma generate
```

On production the client is regenerated at build time (`prisma generate` runs as part of `npm run build`) — no extra step needed there.

Expected: `✔ Generated Prisma Client`

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npm run build 2>&1 | tail -20
```

Expected: no type errors related to `EmailCampaign` or `campaignId`.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: add EmailCampaign model and campaignId FK to EmailMessage"
```

---

### Task 2: Add `campaignId` to `sendEmail()`

**Files:**
- Modify: `lib/communications/email-service.ts`

- [ ] **Step 1: Add `campaignId` to `SendEmailInput`**

Find the `SendEmailInput` type (around line 236):

```ts
export type SendEmailInput = {
  contactId:    string
  subject:      string
  body:         string
  toEmail:      string
  fromEmail?:   string
  ccEmails?:    string[]
  templateId?:  string
  sentById?:    string
  attachments?: Array<{ filename: string; content: Buffer }>
}
```

Add `campaignId?: string` after `templateId?`:

```ts
export type SendEmailInput = {
  contactId:    string
  subject:      string
  body:         string
  toEmail:      string
  fromEmail?:   string
  ccEmails?:    string[]
  templateId?:  string
  campaignId?:  string
  sentById?:    string
  attachments?: Array<{ filename: string; content: Buffer }>
}
```

- [ ] **Step 2: Write `campaignId` in the opted-out path**

Find the first `prisma.emailMessage.create()` call — the one inside the `if (contact?.emailOptOut)` block. It has `data: { ... templateId: input.templateId ?? null, ... }`. Add after `templateId`:

```ts
campaignId: input.campaignId ?? null,
```

- [ ] **Step 3: Write `campaignId` in the normal send path**

Find the second `prisma.emailMessage.create()` call — the one at the bottom of `sendEmail()` that runs after SMTP. Its `data` block has `templateId: input.templateId ?? null`. Add after that:

```ts
campaignId: input.campaignId ?? null,
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npm run build 2>&1 | grep -E "error|Error" | head -20
```

Expected: no errors in `email-service.ts`.

- [ ] **Step 5: Commit**

```bash
git add lib/communications/email-service.ts
git commit -m "feat: add campaignId to SendEmailInput and EmailMessage create calls"
```

---

### Task 3: Forward `campaignId` through the job runner

**Files:**
- Modify: `lib/automation/job-queue.ts`

- [ ] **Step 1: Add `campaignId` to the `bulk_email_send` case**

Find the `case 'bulk_email_send':` block (around line 172). The current `sendEmail()` call is:

```ts
await sendEmail({
  contactId:  payload.contactId  as string,
  subject:    payload.subject    as string,
  body:       payload.body       as string,
  toEmail:    payload.toEmail    as string,
  templateId: payload.templateId as string | undefined,
})
```

Replace it with:

```ts
await sendEmail({
  contactId:  payload.contactId  as string,
  subject:    payload.subject    as string,
  body:       payload.body       as string,
  toEmail:    payload.toEmail    as string,
  templateId: payload.templateId as string | undefined,
  campaignId: payload.campaignId as string | undefined,
})
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run build 2>&1 | grep -E "error|Error" | head -20
```

Expected: no errors in `job-queue.ts`.

- [ ] **Step 3: Commit**

```bash
git add lib/automation/job-queue.ts
git commit -m "feat: forward campaignId from job payload to sendEmail"
```

---

### Task 4: Create `EmailCampaign` in the bulk send route

**Files:**
- Modify: `app/api/emails/bulk/route.ts`

- [ ] **Step 1: Read the current route**

Read `app/api/emails/bulk/route.ts` in full so you know the exact variable names. Key variables confirmed from the spec research:
- `recipients` — array of `{ id, email }` contacts with valid emails, after dedup
- `emailBody` — the resolved body string
- `scheduledAt` — optional ISO datetime string from the parsed request
- `bulkSendId` — `crypto.randomUUID()` generated near the top of the try block
- `runAt` — `scheduledAt ? new Date(scheduledAt) : new Date()`

- [ ] **Step 2: Add campaign creation with rollback**

The existing route has a single outer `try { ... } catch (err) { ... return 500 }` block (starting around line 37) that wraps all the DB work. The new campaign code must go **inside** this existing outer `try` block — not after it. If placed outside, errors from campaign creation will crash the route instead of returning a clean 500.

Find the line `await prisma.jobQueue.createMany({` (which is already inside the outer try) and insert the following immediately before it:

```ts
// Create campaign record before enqueuing jobs.
// If job enqueue fails, clean up the orphaned campaign record.
const campaign = await prisma.emailCampaign.create({
  data: {
    name:           subject,
    subject,
    sentAt:         runAt,
    recipientCount: recipients.length,
  },
})
let jobsCreated = false
```

Then find the `await prisma.jobQueue.createMany({` block and replace it with:

```ts
try {
  await prisma.jobQueue.createMany({
    data: recipients.map(contact => ({
      type:    'bulk_email_send',
      payload: JSON.stringify({
        contactId:  contact.id,
        toEmail:    contact.email,
        subject,
        body:       emailBody,
        templateId,
        bulkSendId,
        campaignId: campaign.id,
      }),
      runAt,
    })),
  })
  jobsCreated = true
} catch (err) {
  await prisma.emailCampaign.delete({ where: { id: campaign.id } })
  throw err
}
```

- [ ] **Step 3: Add `campaignId` to the response**

Find the `return NextResponse.json({` at the end. Add `campaignId: campaign.id` to the response object:

```ts
return NextResponse.json({
  total:      allContacts.length,
  scheduled:  recipients.length,
  skipped,
  bulkSendId,
  campaignId: campaign.id,
})
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npm run build 2>&1 | grep -E "error|Error" | head -20
```

Expected: no errors. If you see `Property 'emailCampaign' does not exist on type 'PrismaClient'`, run `npx prisma generate` first.

- [ ] **Step 5: Smoke-test the bulk send**

Start the dev server (`npm run dev`) and send a test bulk email to 2–3 contacts via the wizard. Then check the database:

```bash
npx prisma studio
```

Open the `email_campaigns` table — one row should appear with the correct subject, `recipientCount`, and `sentAt`. Open `email_messages` — the matching rows should have a non-null `campaignId`.

- [ ] **Step 6: Commit**

```bash
git add app/api/emails/bulk/route.ts
git commit -m "feat: create EmailCampaign record on bulk send and link messages via campaignId"
```

---

## Chunk 2: UI Layer

### Task 5: `CampaignStatsCards` component

**Files:**
- Create: `components/communications/CampaignStatsCards.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { Card } from '@/components/layout'

type StatCard = { label: string; value: string | number }
interface Props { stats: StatCard[] }

export function CampaignStatsCards({ stats }: Props) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 mb-6">
      {stats.map(stat => (
        <Card key={stat.label} className="flex flex-col gap-1">
          <p className="text-2xl font-bold text-charcoal-900">{stat.value}</p>
          <p className="text-xs text-charcoal-500">{stat.label}</p>
        </Card>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run build 2>&1 | grep -E "error|Error" | head -20
```

Expected: no errors in the new file.

- [ ] **Step 3: Commit**

```bash
git add components/communications/CampaignStatsCards.tsx
git commit -m "feat: add CampaignStatsCards reusable stat row component"
```

---

### Task 6: Campaign list page

**Files:**
- Create: `app/admin/communications/email-analytics/page.tsx`

- [ ] **Step 1: Create the page file**

```tsx
import { redirect }            from 'next/navigation'
import { getSession }          from '@/lib/auth'
import { prisma }              from '@/lib/prisma'
import { DashboardLayout }     from '@/components/dashboard'
import { PageHeader, Card }    from '@/components/layout'
import { CampaignStatsCards }  from '@/components/communications/CampaignStatsCards'
import { formatDate }          from '@/lib/utils'
import Link                    from 'next/link'

export default async function EmailAnalyticsPage() {
  const session = await getSession()
  if (!session) redirect('/admin/login')

  const campaigns = await prisma.emailCampaign.findMany({
    orderBy: { sentAt: 'desc' },
    include: { emails: { select: { openCount: true, clickCount: true } } },
  })

  // Per-campaign stats
  const rows = campaigns.map(c => {
    const opens     = c.emails.filter(e => e.openCount  > 0).length
    const clicks    = c.emails.filter(e => e.clickCount > 0).length
    const openRate  = c.recipientCount > 0
      ? (opens  / c.recipientCount * 100).toFixed(1) + '%'
      : '—'
    const clickRate = c.recipientCount > 0
      ? (clicks / c.recipientCount * 100).toFixed(1) + '%'
      : '—'
    return { ...c, opens, clicks, openRate, clickRate }
  })

  // Aggregate top-level stats
  const totalSent    = campaigns.reduce((sum, c) => sum + c.recipientCount, 0)
  const rateRows     = rows.filter(r => r.recipientCount > 0)
  const avgOpenRate  = rateRows.length > 0
    ? (rateRows.reduce((sum, r) => sum + (r.opens / r.recipientCount * 100), 0) / rateRows.length).toFixed(1) + '%'
    : '—'
  const avgClickRate = rateRows.length > 0
    ? (rateRows.reduce((sum, r) => sum + (r.clicks / r.recipientCount * 100), 0) / rateRows.length).toFixed(1) + '%'
    : '—'

  return (
    <DashboardLayout user={session}>
      <PageHeader
        title="Email Analytics"
        subtitle="Campaign open and click rates"
        breadcrumbs={[
          { label: 'Dashboard',      href: '/admin/dashboard' },
          { label: 'Communications', href: '/admin/communications' },
          { label: 'Email Analytics' },
        ]}
      />

      <CampaignStatsCards stats={[
        { label: 'Total Campaigns', value: campaigns.length },
        { label: 'Total Sent',      value: totalSent },
        { label: 'Avg Open Rate',   value: avgOpenRate },
        { label: 'Avg Click Rate',  value: avgClickRate },
      ]} />

      <Card padding="none">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-charcoal-100 text-left text-xs text-charcoal-500 uppercase tracking-wide">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Sent</th>
              <th className="px-4 py-3 text-right">Recipients</th>
              <th className="px-4 py-3 text-right">Opens</th>
              <th className="px-4 py-3 text-right">Open Rate</th>
              <th className="px-4 py-3 text-right">Clicks</th>
              <th className="px-4 py-3 text-right">Click Rate</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-charcoal-400">
                  No campaigns yet
                </td>
              </tr>
            ) : rows.map(row => (
              <tr key={row.id} className="border-b border-charcoal-50 hover:bg-charcoal-50 transition-colors">
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/communications/email-analytics/${row.id}`}
                    className="text-gold-600 hover:underline font-medium"
                  >
                    {row.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-charcoal-500">
                  {formatDate(row.sentAt, { month: 'short', day: 'numeric', year: 'numeric' })}
                </td>
                <td className="px-4 py-3 text-right text-charcoal-700">{row.recipientCount}</td>
                <td className="px-4 py-3 text-right text-charcoal-700">{row.opens}</td>
                <td className="px-4 py-3 text-right font-medium text-charcoal-900">{row.openRate}</td>
                <td className="px-4 py-3 text-right text-charcoal-700">{row.clicks}</td>
                <td className="px-4 py-3 text-right font-medium text-charcoal-900">{row.clickRate}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </DashboardLayout>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run build 2>&1 | grep -E "error|Error" | head -20
```

Expected: no errors.

- [ ] **Step 3: Manual smoke test**

Visit `http://localhost:3000/admin/communications/email-analytics` (run `npm run dev` first). You should see:
- The page loads without error
- All 4 stat cards are visible
- If no campaigns yet: the table shows "No campaigns yet"
- If campaigns exist (from Task 4 smoke test): rows appear with correct data

- [ ] **Step 4: Commit**

```bash
git add app/admin/communications/email-analytics/page.tsx
git commit -m "feat: add email analytics campaign list page"
```

---

### Task 7: Campaign detail page

**Files:**
- Create: `app/admin/communications/email-analytics/[id]/page.tsx`

- [ ] **Step 1: Create the page file**

```tsx
import { notFound, redirect }  from 'next/navigation'
import { getSession }          from '@/lib/auth'
import { prisma }              from '@/lib/prisma'
import { DashboardLayout }     from '@/components/dashboard'
import { PageHeader, Card }    from '@/components/layout'
import { CampaignStatsCards }  from '@/components/communications/CampaignStatsCards'
import { formatDate }          from '@/lib/utils'
import Link                    from 'next/link'
import { ArrowLeft }           from 'lucide-react'

interface Props { params: Promise<{ id: string }> }

const STATUS_CLASSES: Record<string, string> = {
  sent:      'bg-blue-100 text-blue-700',
  delivered: 'bg-green-100 text-green-700',
  bounced:   'bg-red-100 text-red-700',
  failed:    'bg-red-100 text-red-700',
  opted_out: 'bg-charcoal-100 text-charcoal-500',
}

export default async function CampaignDetailPage({ params }: Props) {
  const session = await getSession()
  if (!session) redirect('/admin/login')

  const { id } = await params

  const campaign = await prisma.emailCampaign.findUnique({
    where: { id },
    include: {
      emails: {
        include: { contact: { select: { id: true, firstName: true, lastName: true } } },
        orderBy: { sentAt: 'asc' },
      },
    },
  })
  if (!campaign) notFound()

  const opens     = campaign.emails.filter(e => e.openCount  > 0).length
  const clicks    = campaign.emails.filter(e => e.clickCount > 0).length
  const openRate  = campaign.recipientCount > 0
    ? (opens  / campaign.recipientCount * 100).toFixed(1) + '%'
    : '—'
  const clickRate = campaign.recipientCount > 0
    ? (clicks / campaign.recipientCount * 100).toFixed(1) + '%'
    : '—'

  return (
    <DashboardLayout user={session}>
      <PageHeader
        title={campaign.name}
        subtitle={`${campaign.subject} · ${formatDate(campaign.sentAt, { month: 'long', day: 'numeric', year: 'numeric' })}`}
        breadcrumbs={[
          { label: 'Dashboard',       href: '/admin/dashboard' },
          { label: 'Communications',  href: '/admin/communications' },
          { label: 'Email Analytics', href: '/admin/communications/email-analytics' },
          { label: campaign.name },
        ]}
      />

      <CampaignStatsCards stats={[
        { label: 'Recipients', value: campaign.recipientCount },
        { label: 'Opens',      value: opens },
        { label: 'Open Rate',  value: openRate },
        { label: 'Click Rate', value: clickRate },
      ]} />

      <Card padding="none">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-charcoal-100 text-left text-xs text-charcoal-500 uppercase tracking-wide">
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Opened</th>
              <th className="px-4 py-3">Clicked</th>
            </tr>
          </thead>
          <tbody>
            {campaign.emails.map(msg => {
              const contactName = msg.contact
                ? `${msg.contact.firstName} ${msg.contact.lastName}`
                : msg.toEmail ?? '—'
              const statusClass = STATUS_CLASSES[msg.status] ?? 'bg-charcoal-100 text-charcoal-500'

              return (
                <tr key={msg.id} className="border-b border-charcoal-50 hover:bg-charcoal-50 transition-colors">
                  <td className="px-4 py-3">
                    {msg.contact ? (
                      <Link
                        href={`/admin/contacts/${msg.contact.id}`}
                        className="text-gold-600 hover:underline"
                      >
                        {contactName}
                      </Link>
                    ) : (
                      <span className="text-charcoal-500">{contactName}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-charcoal-500">{msg.toEmail ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusClass}`}>
                      {msg.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-charcoal-700">
                    {msg.openedAt
                      ? formatDate(msg.openedAt, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-charcoal-700">
                    {msg.clickedAt
                      ? formatDate(msg.clickedAt, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
                      : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Card>

      <Link
        href="/admin/communications/email-analytics"
        className="inline-flex items-center gap-1.5 mt-4 text-sm text-charcoal-500 hover:text-charcoal-900 transition-colors"
      >
        <ArrowLeft size={14} /> Back to Email Analytics
      </Link>
    </DashboardLayout>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run build 2>&1 | grep -E "error|Error" | head -20
```

Expected: no errors.

- [ ] **Step 3: Manual smoke test**

Click through from the campaign list to a campaign detail page:
- Stat cards show correct counts
- Contact table rows appear with name links, status pills, and timestamps
- "Back to Email Analytics" link returns to the list
- Visit a non-existent ID (e.g. `/admin/communications/email-analytics/bad-id`) — expect a 404 page

- [ ] **Step 4: Commit**

```bash
git add "app/admin/communications/email-analytics/[id]/page.tsx"
git commit -m "feat: add campaign detail page with per-contact open/click drilldown"
```

---

### Task 8: Add navigation link

**Files:**
- Modify: `app/admin/communications/page.tsx`

- [ ] **Step 1: Add imports**

Open `app/admin/communications/page.tsx`. At the top, add to the existing imports:

```tsx
import Link        from 'next/link'
import { BarChart2 } from 'lucide-react'
```

(`Link` from `next/link` may already be imported — check first and skip if so.)

- [ ] **Step 2: Update `PageHeader` actions**

Find the `<PageHeader` block. It currently has:

```tsx
actions={<InboxComposeButton />}
```

Replace with:

```tsx
actions={
  <>
    <Link
      href="/admin/communications/email-analytics"
      className="inline-flex items-center gap-1.5 text-sm border border-charcoal-300 rounded-md px-3 py-1.5 text-charcoal-700 hover:bg-charcoal-50 transition-colors"
    >
      <BarChart2 size={14} />
      Email Analytics
    </Link>
    <InboxComposeButton />
  </>
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npm run build 2>&1 | grep -E "error|Error" | head -20
```

Expected: no errors.

- [ ] **Step 4: Manual smoke test**

Visit `http://localhost:3000/admin/communications`. An "Email Analytics" button should appear in the top-right of the page header, linking to the analytics page.

- [ ] **Step 5: Commit**

```bash
git add app/admin/communications/page.tsx
git commit -m "feat: add Email Analytics nav link to communications hub"
```

---

## Final Verification

- [ ] Run a full build to confirm zero TypeScript errors:

```bash
npm run build
```

Expected: `✓ Compiled successfully` (or equivalent — no `error TS` lines).

- [ ] Send a new bulk email via the wizard. Confirm:
  1. A new row appears in `email_campaigns` (check via Prisma Studio or the analytics page)
  2. The campaign list page shows the new campaign with correct recipient count
  3. After the tracking pixel fires (open an email), the detail page shows the contact as "opened" with a timestamp
  4. The back link works from detail → list
  5. The "Email Analytics" button on `/admin/communications` links correctly
