# Email Campaign Analytics — Design Spec

**Date:** 2026-04-04
**Status:** Approved

---

## Overview

Add email campaign analytics to the admin area so the agent can see aggregate open/click rates per campaign and drill down to see exactly which contacts opened or clicked each email.

---

## Schema Changes

### New model: `EmailCampaign`

```prisma
model EmailCampaign {
  id             String         @id @default(cuid())
  name           String         // user-visible label, defaults to subject
  subject        String         // original subject line
  sentAt         DateTime       @default(now())
  recipientCount Int            @default(0)
  createdAt      DateTime       @default(now())
  emails         EmailMessage[]

  @@map("email_campaigns")
}
```

### Modified model: `EmailMessage`

Add a nullable FK:

```prisma
campaignId  String?
campaign    EmailCampaign? @relation(fields: [campaignId], references: [id])
```

Individual one-off emails leave `campaignId` null and do not appear in campaign analytics.

---

## Pages

### `/admin/communications/email-analytics`

Campaign list page (server component).

**Layout:**
- `PageHeader` — title "Email Analytics", subtitle "Campaign open and click rates"
- Breadcrumbs: Dashboard → Communications → Email Analytics
- Summary stat cards (4): Total Campaigns, Total Sent, Avg Open Rate, Avg Click Rate
- Table of campaigns with columns:
  - Name (links to detail page)
  - Sent date
  - Recipients
  - Opens (count)
  - Open rate (%)
  - Clicks (count)
  - Click rate (%)

**Data query:** Fetch all `EmailCampaign` records. For each, count `EmailMessage` records where `openCount > 0` (opened) and `clickCount > 0` (clicked). Compute rates as `opens / recipientCount`.

---

### `/admin/communications/email-analytics/[id]`

Campaign detail page (server component).

**Layout:**
- `PageHeader` — title = campaign name, subtitle = subject + sent date
- Breadcrumbs: Dashboard → Communications → Email Analytics → [name]
- Stat cards (4): Recipients, Opens, Open Rate, Click Rate
- Table of contacts with columns:
  - Contact name (links to `/admin/contacts/[id]`)
  - Email address
  - Status (sent / opted_out / failed — pill badge)
  - Opened (checkmark + formatted timestamp, or —)
  - Clicked (checkmark + formatted timestamp, or —)
- Back link to campaign list

**Data query:** `EmailMessage.findMany({ where: { campaignId: id }, include: { contact: ... } })`

---

## Bulk Email Wizard Changes

When the bulk send is submitted (`app/api/bulk-email/route.ts` or equivalent handler):

1. Create an `EmailCampaign` record first:
   - `name` defaults to the subject line
   - `subject` = email subject
   - `sentAt` = now
   - `recipientCount` = number of selected contacts
2. Pass the resulting `campaignId` to each `sendEmail()` call

### `sendEmail()` signature change

`SendEmailInput` gains an optional field:

```ts
campaignId?: string
```

The field is written to `EmailMessage.campaignId` when present.

---

## New Components

### `components/communications/CampaignStatsCards.tsx`

A row of 4 stat cards accepting props:
```ts
{ label: string; value: string | number; sub?: string }[]
```

Reused on both the list page (aggregate stats) and the detail page (per-campaign stats).

---

## Files to Create / Modify

| Action | File |
|--------|------|
| Create | `prisma/schema.prisma` — add `EmailCampaign` model + `EmailMessage.campaignId` |
| Create | `app/admin/communications/email-analytics/page.tsx` |
| Create | `app/admin/communications/email-analytics/[id]/page.tsx` |
| Create | `components/communications/CampaignStatsCards.tsx` |
| Modify | `lib/communications/email-service.ts` — `SendEmailInput` + `sendEmail()` |
| Modify | Bulk email API route — create `EmailCampaign` before fanning out sends |

---

## Out of Scope

- Naming / renaming campaigns after send
- Scheduling or drafting campaigns
- Client-side sorting of tables (future enhancement)
- Per-link click tracking (current tracking is per-email only)
