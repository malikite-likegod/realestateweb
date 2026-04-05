# Email Campaign Analytics — Design Spec

**Date:** 2026-04-04
**Status:** Approved

---

## Overview

Add email campaign analytics to the admin area so the agent can see aggregate open/click rates per campaign and drill down to see exactly which contacts opened or clicked each email.

---

## Existing Infrastructure (do not rebuild)

**`EmailMessage` fields relevant to analytics** (confirmed in `prisma/schema.prisma`):

| Field | Type | Notes |
|-------|------|-------|
| `id` | String | PK |
| `contactId` | String? | FK to Contact |
| `contact` | Contact? | relation |
| `toEmail` | String? | recipient address |
| `status` | String | `sent \| delivered \| bounced \| failed \| opted_out` |
| `openCount` | Int | incremented by tracking pixel |
| `openedAt` | DateTime? | timestamp of first open |
| `clickCount` | Int | incremented by click redirect |
| `clickedAt` | DateTime? | timestamp of first click |
| `sentAt` | DateTime | when the message was sent |

**Bulk email fan-out flow** (confirmed by reading source):
1. `BulkEmailWizard` POSTs to `app/api/emails/bulk/route.ts`
2. The route deduplicates contacts, filters out those with no email, then calls `prisma.jobQueue.createMany()` with one job per recipient (`type: 'bulk_email_send'`, payload includes `contactId`, `toEmail`, `subject`, `body`, `templateId`, `bulkSendId`)
3. `lib/automation/job-queue.ts` — `case 'bulk_email_send'` — calls `sendEmail()` from `lib/communications/email-service.ts`

---

## Schema Changes

### New model: `EmailCampaign`

Add to `prisma/schema.prisma`:

```prisma
model EmailCampaign {
  id             String         @id @default(cuid())
  name           String         // always mirrors subject — not user-editable
  subject        String
  sentAt         DateTime       @default(now())   // time the campaign was queued (not when jobs run)
  recipientCount Int            @default(0)       // contacts with a valid email, after dedup
  createdAt      DateTime       @default(now())
  emails         EmailMessage[]

  @@map("email_campaigns")
}
```

**`sentAt`** is set to `scheduledAt` (if provided) or `new Date()` at campaign creation time — see bulk route changes below. For scheduled campaigns this records the intended delivery time.

**`recipientCount`** = number of jobs enqueued (contacts with a valid email after deduplication) — this is the denominator for all open/click rate calculations.

### Modified model: `EmailMessage`

Add to the `EmailMessage` model:

```prisma
campaignId  String?
campaign    EmailCampaign? @relation(fields: [campaignId], references: [id], onDelete: SetNull)
```

`onDelete: SetNull` matches the pattern used by other nullable relations (e.g. `contact`). Individual one-off emails leave `campaignId` null and never appear in campaign analytics.

---

## Pages

Both new pages are **server components**. Each must:
1. `const session = await getSession()` — `if (!session) redirect('/admin/login')`
2. For the detail page: `const { id } = await params`

### `/admin/communications/email-analytics` — Campaign List

**Breadcrumbs:** Dashboard → Communications → Email Analytics

**Data query:**
```ts
const campaigns = await prisma.emailCampaign.findMany({
  orderBy: { sentAt: 'desc' },
  include: { emails: { select: { openCount: true, clickCount: true } } },
})
```

**Stat computation (in JS):**
```ts
const opens     = emails.filter(e => e.openCount  > 0).length  // unique openers
const clicks    = emails.filter(e => e.clickCount > 0).length  // unique clickers
const openRate  = recipientCount > 0 ? (opens  / recipientCount * 100).toFixed(1) + '%' : '—'
const clickRate = recipientCount > 0 ? (clicks / recipientCount * 100).toFixed(1) + '%' : '—'
```
Use this formula on **both** pages (list and detail).

**Avg open/click rates** (for the top stat cards) = simple average of per-campaign rates (numeric values only, excluding "—" campaigns). Show "—" if no campaigns exist.

**Layout:**
- `PageHeader` — title "Email Analytics", subtitle "Campaign open and click rates"
- `CampaignStatsCards` — 4 cards: Total Campaigns, Total Sent (sum of all `recipientCount`), Avg Open Rate, Avg Click Rate
- Campaign table with columns:
  - Name (link to `/admin/communications/email-analytics/[id]`)
  - Sent (formatted `sentAt`)
  - Recipients (`recipientCount`)
  - Opens (count)
  - Open Rate
  - Clicks (count)
  - Click Rate
- Empty state row ("No campaigns yet") if `campaigns` is empty

---

### `/admin/communications/email-analytics/[id]` — Campaign Detail

**Breadcrumbs:** Dashboard → Communications → Email Analytics → [campaign name]

**Data query:**
```ts
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
```

**Layout:**
- `PageHeader` — title = `campaign.name`, subtitle = subject + formatted `sentAt`
- `CampaignStatsCards` — 4 cards: Recipients (`recipientCount`), Opens (count where `openCount > 0`), Open Rate, Click Rate (same formula as list page; show "—" if `recipientCount === 0`)
- Contact table with columns:
  - Contact name — link to `/admin/contacts/[id]`; if `contactId` is null, render `toEmail` as a plain `<span>` (no link)
  - Email (`toEmail ?? '—'`)
  - Status (pill badge)
  - Opened (`openedAt` formatted using the existing `formatDate` utility from `@/lib/utils`, or "—")
  - Clicked (`clickedAt` formatted using `formatDate`, or "—")
- Back link: `← Back to Email Analytics` pointing to `/admin/communications/email-analytics`, rendered below the table (same pattern as existing email detail page)

**Status pill badge colours:**

| Status | Tailwind classes |
|--------|-----------------|
| `sent` | `bg-blue-100 text-blue-700` |
| `delivered` | `bg-green-100 text-green-700` |
| `bounced` | `bg-red-100 text-red-700` |
| `failed` | `bg-red-100 text-red-700` |
| `opted_out` | `bg-charcoal-100 text-charcoal-500` |

---

## Navigation

In `app/admin/communications/page.tsx`, the `PageHeader` `actions` prop already holds `<InboxComposeButton />`. Wrap both in a fragment:

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

Import `BarChart2` from `lucide-react` and `Link` from `next/link`.

---

## Bulk Email API Changes — Three Files

### 1. `app/api/emails/bulk/route.ts`

After computing `recipients` (contacts with a valid email, after dedup), wrap both the campaign creation and job enqueue in a `prisma.$transaction()` so a failed job write does not leave an orphaned campaign record with zero emails:

```ts
const runAt = scheduledAt ? new Date(scheduledAt) : new Date()

const [campaign] = await prisma.$transaction([
  prisma.emailCampaign.create({
    data: {
      name:           subject,
      subject,
      sentAt:         runAt,             // scheduled time or now
      recipientCount: recipients.length,
    },
  }),
  // jobQueue.createMany is called after we have campaign.id — use sequential transaction instead:
])
// Then outside the transaction (or in a sequential flow):
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
```

**Note on transaction:** Because `campaign.id` is needed in each job payload, a true atomic transaction is not straightforward with `createMany`. Instead, wrap just the campaign create; if `createMany` subsequently fails, delete the orphaned campaign:

```ts
const campaign = await prisma.emailCampaign.create({ data: { ... } })
try {
  await prisma.jobQueue.createMany({ data: recipients.map(...) })
} catch (err) {
  await prisma.emailCampaign.delete({ where: { id: campaign.id } })
  throw err
}
```

Return `campaignId` in the response JSON alongside the existing `total`, `scheduled`, `skipped`, `bulkSendId` fields.

### 2. `lib/automation/job-queue.ts` — `case 'bulk_email_send'`

Extract `campaignId` from the payload and forward it to `sendEmail()`:

```ts
case 'bulk_email_send': {
  const { sendEmail } = await import('@/lib/communications/email-service')
  await sendEmail({
    contactId:  payload.contactId  as string,
    subject:    payload.subject    as string,
    body:       payload.body       as string,
    toEmail:    payload.toEmail    as string,
    templateId: payload.templateId as string | undefined,
    campaignId: payload.campaignId as string | undefined,  // ← add this
  })
  break
}
```

### 3. `lib/communications/email-service.ts`

Add one optional field to `SendEmailInput`:

```ts
campaignId?: string
```

In **both** `prisma.emailMessage.create()` calls (the opted-out early-return path and the normal send path), add:

```ts
campaignId: input.campaignId ?? null,
```

---

## New Component: `CampaignStatsCards`

**File:** `components/communications/CampaignStatsCards.tsx`

```ts
type StatCard = { label: string; value: string | number }
interface Props { stats: StatCard[] }
```

Renders `grid grid-cols-2 gap-4 sm:grid-cols-4`. Each cell is a `Card` with `value` rendered large (`text-2xl font-bold text-charcoal-900`) and `label` small (`text-xs text-charcoal-500`). Always receives exactly 4 cards.

---

## Pagination

No pagination. Fetch all campaigns and all messages. Acceptable for the expected data scale. Add as a future enhancement if needed.

---

## Files to Create / Modify

| Action | File | Change |
|--------|------|--------|
| **Modify** | `prisma/schema.prisma` | Add `EmailCampaign` model + `EmailMessage.campaignId` FK |
| **Create** | `app/admin/communications/email-analytics/page.tsx` | Campaign list page |
| **Create** | `app/admin/communications/email-analytics/[id]/page.tsx` | Campaign detail page |
| **Create** | `components/communications/CampaignStatsCards.tsx` | Stat cards component |
| **Modify** | `lib/communications/email-service.ts` | Add `campaignId` to `SendEmailInput` and both `create` calls |
| **Modify** | `app/api/emails/bulk/route.ts` | Create `EmailCampaign`, add `campaignId` to job payloads |
| **Modify** | `lib/automation/job-queue.ts` | Forward `campaignId` from payload to `sendEmail()` |
| **Modify** | `app/admin/communications/page.tsx` | Add "Email Analytics" link to `PageHeader` actions |

---

## Out of Scope

- Renaming or editing campaigns after send
- Scheduling or drafting campaigns
- Client-side table sorting
- Per-link click tracking
- Dedicated sidebar nav entry
- Pagination
- Updating `sentAt` to reflect actual delivery time for scheduled campaigns
