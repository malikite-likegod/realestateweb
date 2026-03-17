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

`executeNextStep()` already queries the sequence via:
```ts
include: {
  sequence: { include: { steps: { orderBy: { order: 'asc' } } } },
  ...
}
```
Add `repeatAnnually: true` to the `sequence` include (or rely on Prisma selecting all scalar fields by default — confirm this is the case; if not, add it explicitly).

After the last step of any campaign runs successfully (the `else` branch that currently marks enrollment `completed`), check `enrollment.sequence.repeatAnnually`. If `true` AND `enrollment.sequence.trigger === 'special_event'`:
- Reset `currentStep` to 0
- Recompute `nextRunAt` using `computeSpecialEventDate()` for step 0 (same annual logic already used during enrollment)
- If `computeSpecialEventDate()` returns `null` (required contact data missing), fall back to marking enrollment `completed` — do not throw
- Otherwise: update enrollment with `{ currentStep: 0, nextRunAt, status: 'active' }` (status stays active, completedAt stays null)
- Enqueue a new job using the same pattern already used for non-final steps in `executeNextStep()`: `await enqueueJob('execute_campaign_step', { enrollmentId }, nextRunAt)`

If `repeatAnnually` is `false` (default), the existing behavior is unchanged — mark enrollment as `completed`.

### 2. `PATCH /api/campaigns/enrollments/[enrollmentId]`

`enrollContact()` already accepts a third parameter `startAtStep` (default 0):
```ts
enrollContact(sequenceId: string, contactId: string, startAtStep = 0)
```
No change to `enrollContact()` is needed.

Extend `patchSchema` to accept `status: z.enum(['active', 'paused', 'cancelled', 'restart'])`.

`restart` is not a real enrollment status — it is a command. When `status === 'restart'`, **skip all existing PATCH logic entirely** and use this branch exclusively:

1. Look up the existing enrollment to get `sequenceId` and `contactId`
2. If enrollment not found: return 404
3. If enrollment status is anything other than `completed` or `cancelled`: return 422 with `{ error: 'Can only restart a completed or cancelled enrollment' }`
4. Call `enrollContact(sequenceId, contactId, 0)` — `enrollContact()` checks `existing.status === 'active'` as its idempotency guard, so any non-active status (`completed`, `cancelled`, `paused`) causes the record to be updated to active. Both `completed` and `cancelled` are valid restart sources.
5. If `enrollContact()` returns `null` for any reason (sequence inactive, no steps, missing contact data): return 422 with `{ error: 'Could not restart enrollment' }`
6. Return `{ data: result }` with the updated enrollment

All other status values (`active`, `paused`, `cancelled`) use the existing code path unchanged.

### 3. `PATCH /api/campaigns/[id]`

Add `repeatAnnually: z.boolean().optional()` to `patchSchema`. The field passes through to `automationSequence.update()` via the existing `campaignFields` spread (destructured from `parsed` after extracting `steps`). No structural change needed beyond adding the field to the schema.

---

## UI

### `CampaignEnrollmentsModal`

Add action buttons for `completed` rows (currently no buttons are shown):

| Button | Color | Action |
|--------|-------|--------|
| Restart | Green | `PATCH enrollments/[id]` with `{ status: 'restart' }` → optimistic update row to `active` |
| Remove  | Red   | `PATCH enrollments/[id]` with `{ status: 'cancelled' }` → optimistic update row to `cancelled` |

`cancelled` rows remain action-less and stay visible in the list (this is intentional — the list is an audit trail, not a filtered view).

Existing `active` and `paused` row actions are unchanged.

### `AutomationManager` — Special Events tab

On each special event campaign card, add a `RefreshCw` icon button (lucide) next to the existing Pencil and ToggleLeft/ToggleRight buttons.

- When `repeatAnnually` is `true`: icon renders in green (`text-green-600`), title `"Repeats annually"`
- When `repeatAnnually` is `false`: icon renders in charcoal (`text-charcoal-400`), title `"Does not repeat"`
- Click calls `PATCH /api/campaigns/[id]` with `{ repeatAnnually: !current }` with optimistic update on the `specialEvents` state array

The `Campaign` type in `AutomationManager.tsx` gains a `repeatAnnually: boolean` field.

`normaliseCampaigns()` uses `...c` spread — `repeatAnnually` passes through automatically. No change required.

---

## Error Handling

| Scenario | Response |
|----------|----------|
| Restart on non-existent enrollment | 404 |
| Restart on non-completed/non-cancelled enrollment (active or paused) | 422 `'Can only restart a completed or cancelled enrollment'` |
| `enrollContact()` returns null for any reason (inactive sequence, no steps, missing contact data) | 422 `'Could not restart enrollment'` |
| `repeatAnnually` loop — contact data goes missing at annual reset time | Fall back to marking enrollment `completed` (no throw) |

---

## Files Touched

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add `repeatAnnually Boolean @default(false)` to `AutomationSequence` |
| `prisma/migrations/…` | New migration |
| `lib/automation/campaign-service.ts` | `executeNextStep` — check `repeatAnnually` after last step; add field to sequence query if needed |
| `app/api/campaigns/enrollments/[enrollmentId]/route.ts` | Accept `restart` command; branch before status update; call `enrollContact` |
| `app/api/campaigns/[id]/route.ts` | Add `repeatAnnually` to `patchSchema` |
| `components/crm/CampaignEnrollmentsModal.tsx` | Add Restart + Remove buttons to `completed` rows |
| `components/crm/AutomationManager.tsx` | Add `repeatAnnually` to `Campaign` type; add repeat toggle to special event cards; verify `normaliseCampaigns` passes field through |
