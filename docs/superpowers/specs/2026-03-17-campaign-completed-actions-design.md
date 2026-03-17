# Campaign Completed Actions — Design Spec

**Date:** 2026-03-17
**Status:** Approved

## Overview

Three related enhancements to the campaign/enrollment system:

1. **Restart a completed enrollment** — re-enroll a contact from step 0 in a campaign they've already completed.
2. **Remove a completed enrollment** — cancel a contact's completed enrollment (record-keeping cleanup).
3. **Repeat annually (never complete)** — a campaign-level flag on special event campaigns that causes the enrollment to automatically cycle back to step 0 after the last step runs each year, instead of completing.

---

## Data Model

### `AutomationSequence` — add one field

```prisma
repeatAnnually  Boolean  @default(false)
```

Only meaningful for `trigger = 'special_event'` campaigns, but stored on all sequences for simplicity. No changes to `CampaignEnrollment` — existing statuses (`active | paused | completed | cancelled`) are sufficient.

A new Prisma migration is required.

---

## Backend

### 1. `campaign-service.ts` — `executeNextStep()`

After the last step of a `special_event` campaign runs successfully, check `sequence.repeatAnnually`. If `true`:
- Reset `currentStep` to 0
- Recompute `nextRunAt` using `computeSpecialEventDate()` for step 0 (same annual logic already used during enrollment)
- Update the enrollment record (`status` stays `active`, `completedAt` stays null)
- Enqueue a new `execute_campaign_step` job for the computed date

If `repeatAnnually` is `false` (default), the existing behavior is unchanged — mark enrollment as `completed`.

The `sequence` must be included in the `executeNextStep` query with `repeatAnnually` selected.

### 2. `PATCH /api/campaigns/enrollments/[enrollmentId]`

Extend `patchSchema` to accept `status: z.enum(['active', 'paused', 'cancelled', 'restart'])`.

When `status === 'restart'`:
- Look up the existing enrollment to get `sequenceId` and `contactId`
- Call `enrollContact(sequenceId, contactId, 0)` — this already handles updating a completed record back to active and re-queuing step 0
- Return the updated enrollment

All other status values behave exactly as today.

### 3. `PATCH /api/campaigns/[id]`

Add `repeatAnnually: z.boolean().optional()` to `patchSchema`. The field passes through to `automationSequence.update()` via the existing `campaignFields` spread — no structural change needed.

---

## UI

### `CampaignEnrollmentsModal`

Add action buttons for `completed` rows (currently no buttons are shown):

| Button | Color | Action |
|--------|-------|--------|
| Restart | Green | `PATCH enrollments/[id]` with `{ status: 'restart' }` → optimistic update row to `active` |
| Remove  | Red   | `PATCH enrollments/[id]` with `{ status: 'cancelled' }` → optimistic update row to `cancelled` |

Existing `active` and `paused` row actions are unchanged. `cancelled` rows remain action-less.

### `AutomationManager` — Special Events tab

On each special event campaign card, add a `RefreshCw` icon button (lucide) next to the existing Pencil and ToggleLeft/ToggleRight buttons.

- When `repeatAnnually` is `true`: icon renders in green (`text-green-600`), title `"Repeats annually"`
- When `repeatAnnually` is `false`: icon renders in charcoal (`text-charcoal-400`), title `"Does not repeat"`
- Click calls `PATCH /api/campaigns/[id]` with `{ repeatAnnually: !current }` with optimistic update

The `Campaign` type in `AutomationManager.tsx` gains a `repeatAnnually: boolean` field. The `specialEvents` state and `normaliseCampaigns()` helper already pass through all fields from the API, so no structural changes are needed there beyond adding the type field.

---

## Error Handling

- **Restart on a non-existent enrollment:** 404 from API, shown in existing modal error state.
- **Restart when required contact data is missing** (e.g. no birthday for a birthday campaign): `enrollContact()` returns `null` — the API should return a 422 with a descriptive message.
- **`repeatAnnually` loop when contact data goes missing at restart time:** `computeSpecialEventDate()` returns `null` → fall back to marking enrollment completed (existing behavior in `executeNextStep` for this case).

---

## Files Touched

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add `repeatAnnually Boolean @default(false)` to `AutomationSequence` |
| `prisma/migrations/…` | New migration |
| `lib/automation/campaign-service.ts` | `executeNextStep` — check `repeatAnnually` after last step |
| `app/api/campaigns/enrollments/[enrollmentId]/route.ts` | Accept `restart` status, call `enrollContact` |
| `app/api/campaigns/[id]/route.ts` | Add `repeatAnnually` to `patchSchema` |
| `components/crm/CampaignEnrollmentsModal.tsx` | Add Restart + Remove buttons to completed rows |
| `components/crm/AutomationManager.tsx` | Add `repeatAnnually` to `Campaign` type; add repeat toggle to special event cards |
