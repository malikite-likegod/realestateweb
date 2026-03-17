# Campaign Completed Actions Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Restart/Remove actions for completed enrollments, and a per-campaign "repeat annually" toggle for special event campaigns.

**Architecture:** Schema migration adds `repeatAnnually` to `AutomationSequence`. Backend changes extend the enrollment PATCH endpoint with a `restart` command and the campaign PATCH endpoint with the new field. The campaign service gains annual-cycle logic. UI adds buttons to completed enrollment rows and a toggle icon to special event campaign cards.

**Tech Stack:** Next.js 14 App Router, Prisma ORM, TypeScript, Zod validation, Tailwind CSS, lucide-react icons.

---

## Chunk 1: Data model + service logic

### Task 1: Add `repeatAnnually` to Prisma schema and migrate

**Files:**
- Modify: `prisma/schema.prisma` (AutomationSequence model, ~line 536)

- [ ] **Step 1: Add field to schema**

Open `prisma/schema.prisma`. Find the `AutomationSequence` model (search for `model AutomationSequence`). Add `repeatAnnually` after `isActive` and also update the trigger comment to include `special_event`:

```prisma
model AutomationSequence {
  id             String   @id @default(cuid())
  name           String
  description    String?
  trigger        String   // new_lead | deal_stage_change | showing_scheduled | manual | special_event
  isActive       Boolean  @default(true)
  repeatAnnually Boolean  @default(false)
  steps          AutomationStep[]
  enrollments    CampaignEnrollment[]
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@map("automation_sequences")
}
```

Note: the trigger comment in the current schema reads `// new_lead | deal_stage_change | showing_scheduled | manual` (missing `special_event`). Update it to match the snippet above.

- [ ] **Step 2: Generate and apply the migration**

```bash
npx prisma migrate dev --name add_repeat_annually
```

Expected output: `Your database is now in sync with your schema.`

- [ ] **Step 3: Verify migration file exists**

```bash
ls prisma/migrations/
```

Expected: a new folder like `20260317_add_repeat_annually` with `migration.sql` inside containing `ALTER TABLE "automation_sequences" ADD COLUMN "repeatAnnually" BOOLEAN NOT NULL DEFAULT false;`

- [ ] **Step 4: Regenerate Prisma client**

`prisma migrate dev` runs this automatically, but if you're unsure confirm with:

```bash
npx prisma generate
```

Expected: `Generated Prisma Client` (no errors). After this the TypeScript type for `AutomationSequence` will include `repeatAnnually: boolean`.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add repeatAnnually field to AutomationSequence"
```

---

### Task 2: Implement annual repeat logic in `executeNextStep()`

**Files:**
- Modify: `lib/automation/campaign-service.ts` (lines ~260–265, the `else` branch at the end of the try block)

Context: `executeNextStep()` ends with this block after advancing to the next step or completing:

```ts
} else {
  await prisma.campaignEnrollment.update({
    where: { id: enrollmentId },
    data:  { status: 'completed', completedAt: new Date(), nextRunAt: null },
  })
}
```

This is the "no next step" branch — the one to modify. **Task 1 must be completed first** — `repeatAnnually` is added to the schema there. Once migrated, Prisma selects all scalar fields by default, so `enrollment.sequence.repeatAnnually` is available without any query changes in this file. Note: `special_event` is already used as a trigger value throughout the codebase (e.g. `enrollContact()`, the campaign API route Zod schema) — only the schema comment was outdated, which Task 1 fixes.

**Design note — step 0 config:** `special_event` sequences always have event-type configs on every step (including step 0); this is the same pattern used in `enrollContact()` which also passes `entryStep.config` to `computeSpecialEventDate()`. So calling `computeSpecialEventDate(steps[0].config, ...)` is safe and consistent.

**Design note — early-exit path:** There is a separate guard at lines 132–139 of the current file that completes the enrollment when `currentStep` is out of bounds (edge case: job fires after steps were deleted). That path does NOT go through the else-branch modified here and therefore never triggers annual repeat. This is acceptable — it's a degenerate state and completing is the right fallback.

- [ ] **Step 1: Replace the completion else-branch**

Find the final `else` block inside `executeNextStep()` (after the `if (nextStep)` block, just before the closing `}` of the try block). Replace it with:

```ts
} else {
  // Last step done — either cycle annually or complete
  const shouldRepeat =
    enrollment.sequence.repeatAnnually &&
    enrollment.sequence.trigger === 'special_event'

  if (shouldRepeat && steps.length > 0) {
    const step0Config    = JSON.parse(steps[0].config) as Record<string, unknown>
    const lastDeal       = await getLastClosedDealDate(enrollment.contactId)
    const nextRunAt      = computeSpecialEventDate(step0Config, enrollment.contact.birthday, lastDeal)

    if (nextRunAt) {
      // Cycle back to step 0 for next year
      await prisma.campaignEnrollment.update({
        where: { id: enrollmentId },
        data:  { currentStep: 0, nextRunAt },
      })
      await enqueueJob('execute_campaign_step', { enrollmentId }, nextRunAt)
    } else {
      // Required contact data missing — fall back to completing
      await prisma.campaignEnrollment.update({
        where: { id: enrollmentId },
        data:  { status: 'completed', completedAt: new Date(), nextRunAt: null },
      })
    }
  } else {
    await prisma.campaignEnrollment.update({
      where: { id: enrollmentId },
      data:  { status: 'completed', completedAt: new Date(), nextRunAt: null },
    })
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/automation/campaign-service.ts
git commit -m "feat: cycle special event enrollments annually when repeatAnnually is true"
```

---

## Chunk 2: API endpoints

> **Prerequisite:** Chunk 1 must be completed before this chunk. Task 1 adds `repeatAnnually` to the Prisma schema and migrates. Once that migration is applied and `npx prisma generate` has run, the Prisma client will include the new field and all references to `repeatAnnually` in this chunk will compile correctly.

### Task 3: Extend enrollment PATCH to accept `restart` command

**Files:**
- Modify: `app/api/campaigns/enrollments/[enrollmentId]/route.ts`

The current file structure (see `route.ts`):
- `patchSchema` validates `status: z.enum(['active', 'paused', 'cancelled'])`
- The handler does a direct DB update then handles the paused→active resume case

- [ ] **Step 1: Add the `enrollContact` import**

At the top of `route.ts`, add the import after the existing imports:

```ts
import { enrollContact } from '@/lib/automation/campaign-service'
```

- [ ] **Step 2: Extend patchSchema**

Change:
```ts
const patchSchema = z.object({
  status: z.enum(['active', 'paused', 'cancelled']),
})
```

To:
```ts
const patchSchema = z.object({
  status: z.enum(['active', 'paused', 'cancelled', 'restart']),
})
```

- [ ] **Step 3: Add the restart branch before the existing DB update**

After `const parsed = patchSchema.parse(body)` and the existing `findUnique` call, add the restart branch. The full updated PATCH handler body should look like this:

```ts
export async function PATCH(request: Request, { params }: Props) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { enrollmentId } = await params
    const body   = await request.json()
    const parsed = patchSchema.parse(body)

    const existing = await prisma.campaignEnrollment.findUnique({ where: { id: enrollmentId } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // ── Restart command ────────────────────────────────────────────────────────
    if (parsed.status === 'restart') {
      if (existing.status !== 'completed' && existing.status !== 'cancelled') {
        return NextResponse.json(
          { error: 'Can only restart a completed or cancelled enrollment' },
          { status: 422 },
        )
      }
      const result = await enrollContact(existing.sequenceId, existing.contactId, 0)
      if (!result) {
        return NextResponse.json(
          { error: 'Could not restart enrollment' },
          { status: 422 },
        )
      }
      return NextResponse.json({ data: result })
    }

    // ── Normal status update ───────────────────────────────────────────────────
    const enrollment = await prisma.campaignEnrollment.update({
      where: { id: enrollmentId },
      data:  {
        status:      parsed.status,
        completedAt: parsed.status === 'cancelled' ? new Date() : undefined,
      },
    })

    // When resuming a paused enrollment, re-enqueue the current step because
    // the original job was consumed (and skipped) while status was 'paused'.
    if (parsed.status === 'active' && existing.status === 'paused') {
      const nextRunAt = existing.nextRunAt && existing.nextRunAt > new Date()
        ? existing.nextRunAt
        : new Date()
      await enqueueJob('execute_campaign_step', { enrollmentId }, nextRunAt)
    }

    return NextResponse.json({ data: enrollment })
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.errors }, { status: 400 })
    console.error('[PATCH /api/campaigns/enrollments/[enrollmentId]]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add app/api/campaigns/enrollments/[enrollmentId]/route.ts
git commit -m "feat: add restart command to enrollment PATCH endpoint"
```

---

### Task 4: Add `repeatAnnually` to campaign PATCH schema

**Files:**
- Modify: `app/api/campaigns/[id]/route.ts` (patchSchema, ~line 17)

- [ ] **Step 1: Add field to patchSchema**

Find `patchSchema` in `app/api/campaigns/[id]/route.ts`. Add `repeatAnnually` as an optional boolean:

```ts
const patchSchema = z.object({
  name:           z.string().min(1).optional(),
  description:    z.string().optional(),
  trigger:        z.enum(['new_lead', 'deal_stage_change', 'showing_scheduled', 'manual', 'special_event']).optional(),
  isActive:       z.boolean().optional(),
  repeatAnnually: z.boolean().optional(),
  /** When provided, replaces all existing steps */
  steps:          z.array(stepSchema).min(1).optional(),
})
```

No other changes needed — `repeatAnnually` passes through in `campaignFields` via the existing `const { steps, ...campaignFields } = parsed` destructure.

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/campaigns/[id]/route.ts
git commit -m "feat: accept repeatAnnually in campaign PATCH endpoint"
```

---

## Chunk 3: UI

### Task 5: Add Restart + Remove buttons for completed enrollments

**Files:**
- Modify: `components/crm/CampaignEnrollmentsModal.tsx`

Currently `updateStatus` only accepts `'active' | 'paused' | 'cancelled'`. The completed row renders an empty actions cell (lines ~151–180 show the conditional blocks for `active` and `paused` only).

- [ ] **Step 1: Extend `updateStatus` to accept `'restart'`**

Change the function signature from:

```ts
async function updateStatus(enrollmentId: string, status: 'active' | 'paused' | 'cancelled') {
```

To:

```ts
async function updateStatus(enrollmentId: string, status: 'active' | 'paused' | 'cancelled' | 'restart') {
```

- [ ] **Step 2: Update optimistic state for restart**

In `updateStatus`, the optimistic line is:
```ts
setRows(prev => prev.map(r => r.id === enrollmentId ? { ...r, status } : r))
```

`restart` is a command, not a valid `EnrollmentStatus`, so the optimistic update needs to map it to `'active'`. Change the optimistic update line to:

```ts
const optimisticStatus = status === 'restart' ? 'active' : status
setRows(prev => prev.map(r => r.id === enrollmentId ? { ...r, status: optimisticStatus } : r))
```

- [ ] **Step 3: Add buttons to completed rows**

In the actions cell, after the `{row.status === 'paused' && (...)}` block, add:

```tsx
{row.status === 'completed' && (
  <>
    <button
      onClick={() => updateStatus(row.id, 'restart')}
      className="rounded px-2 py-1 text-xs text-green-600 hover:bg-green-50 transition-colors">
      Restart
    </button>
    <button
      onClick={() => updateStatus(row.id, 'cancelled')}
      className="rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50 transition-colors">
      Remove
    </button>
  </>
)}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add components/crm/CampaignEnrollmentsModal.tsx
git commit -m "feat: add Restart and Remove actions for completed enrollments"
```

---

### Task 6: Add `repeatAnnually` toggle to special event campaign cards

**Files:**
- Modify: `components/crm/AutomationManager.tsx`

- [ ] **Step 1: Add `repeatAnnually` to the `Campaign` type**

Find the `Campaign` type (~line 29). Add the field:

```ts
type Campaign = {
  id:                string
  name:              string
  description:       string | null
  trigger:           string
  isActive:          boolean
  repeatAnnually:    boolean
  activeEnrollments: number
  steps:             CampaignStep[]
  createdAt:         Date | string
}
```

- [ ] **Step 2: Add `RefreshCw` to the lucide import**

Find the existing lucide import at the top of the file:

```ts
import { Plus, Zap, CheckCircle, XCircle, Clock, Play, ToggleLeft, ToggleRight, Pencil, X } from 'lucide-react'
```

Add `RefreshCw`:

```ts
import { Plus, Zap, CheckCircle, XCircle, Clock, Play, ToggleLeft, ToggleRight, Pencil, X, RefreshCw } from 'lucide-react'
```

- [ ] **Step 3: Add `toggleRepeatAnnually` handler**

After the `toggleSpecialEvent` function (~line 145), add:

```ts
async function toggleRepeatAnnually(id: string, current: boolean) {
  setSpecialEvents(prev => prev.map(c => c.id === id ? { ...c, repeatAnnually: !current } : c))
  try {
    const res = await fetch(`/api/campaigns/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repeatAnnually: !current }),
    })
    if (!res.ok) throw new Error()
  } catch {
    // Revert optimistic update on failure
    setSpecialEvents(prev => prev.map(c => c.id === id ? { ...c, repeatAnnually: current } : c))
  }
}
```

- [ ] **Step 4: Add the toggle button to special event cards**

In the Special Events tab, find the campaign card header buttons for special events (the section rendering `specialEvents.map(c => ...)`). It will have a `flex items-center gap-2` div containing the Pencil and Toggle buttons. Add the `RefreshCw` button before the Pencil button:

```tsx
<button
  onClick={() => toggleRepeatAnnually(c.id, c.repeatAnnually)}
  className="text-charcoal-400 hover:text-charcoal-700"
  title={c.repeatAnnually ? 'Repeats annually' : 'Does not repeat'}>
  <RefreshCw size={16} className={c.repeatAnnually ? 'text-green-600' : ''} />
</button>
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add components/crm/AutomationManager.tsx
git commit -m "feat: add repeatAnnually toggle to special event campaign cards"
```

---

## Chunk 4: Manual verification

### Task 7: End-to-end verification

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

Navigate to the Automation page (wherever the `AutomationManager` is rendered — check `app/(public)/page.tsx` or the automations route).

- [ ] **Step 2: Verify Restart/Remove on completed enrollments**

1. Open a campaign's enrollments modal (click the enrollment count badge on any campaign card)
2. Find a row with status "Completed"
3. Confirm two buttons appear: "Restart" (green) and "Remove" (red)
4. Click **Restart** — row should optimistically change to "Active"; refresh the page and confirm the enrollment is active with `currentStep = 0`
5. Click **Remove** on a completed row — row should change to "Unenrolled"; no buttons should appear on that row

- [ ] **Step 3: Verify repeat annually toggle on special event cards**

1. Go to the Special Events tab in the Automation section
2. Confirm a `RefreshCw` icon appears on each special event campaign card (grey by default)
3. Click it — icon should turn green; refresh the page and confirm it stays green
4. Click again — icon should return to grey; refresh and confirm

- [ ] **Step 4: Verify annual cycle behavior (if test data available)**

If you have a special event campaign with `repeatAnnually = true` and an enrollment that has just processed its last step, confirm the enrollment remains `active` with `currentStep = 0` and `nextRunAt` set to next year's date, rather than `completed`.

If no live test data is available, confirm the logic is in place by reading `lib/automation/campaign-service.ts` and tracing the `repeatAnnually` branch manually.

- [ ] **Step 5: Final commit (if any last-minute fixes)**

```bash
git add -p
git commit -m "fix: <describe any final fixes>"
```
