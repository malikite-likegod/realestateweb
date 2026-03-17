# Campaign Enrollments Modal Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a modal to the Automation Manager that lets admins view and manage (pause, resume, unenroll) all enrollees for a campaign by clicking the enrollment count on each campaign card.

**Architecture:** A new `CampaignEnrollmentsModal` client component fetches `GET /api/campaigns/[id]/enrollments` on open and renders a paginated table with per-row Pause/Resume/Unenroll actions that call `PATCH /api/campaigns/enrollments/[enrollmentId]`. The enrollment count text on each campaign card in `AutomationManager` is replaced with a `<button>` that opens the modal.

**Tech Stack:** Next.js 15, React useState, TailwindCSS, Lucide React, existing `Modal` + `Badge` + `Button` UI components.

**Spec:** `docs/superpowers/specs/2026-03-17-campaign-enrollments-modal-design.md`

---

## Chunk 1: CampaignEnrollmentsModal + AutomationManager wiring

### Task 1: Create CampaignEnrollmentsModal component

**Files:**
- Create: `components/crm/CampaignEnrollmentsModal.tsx`
- Modify: `components/crm/index.ts`

- [ ] **Step 1: Create `components/crm/CampaignEnrollmentsModal.tsx`**

```tsx
'use client'

/**
 * CampaignEnrollmentsModal
 *
 * Opens a paginated table of all enrollments for a campaign.
 * Supports Pause, Resume, and Unenroll actions per row.
 */

import { useState, useEffect } from 'react'
import { Users } from 'lucide-react'
import { Modal, Badge, Button } from '@/components/ui'
import { formatDate } from '@/lib/utils'

type EnrollmentStatus = 'active' | 'paused' | 'completed' | 'cancelled'

type EnrollmentRow = {
  id:          string
  status:      EnrollmentStatus
  currentStep: number
  nextRunAt:   string | null
  enrolledAt:  string
  completedAt: string | null
  contact: {
    id:        string
    firstName: string
    lastName:  string
    email:     string | null
  }
}

interface Props {
  open:         boolean
  onClose:      () => void
  campaignId:   string
  campaignName: string
  totalSteps:   number
}

const STATUS_CONFIG: Record<EnrollmentStatus, { label: string; variant: 'success' | 'gold' | 'info' | 'default' }> = {
  active:    { label: 'Active',     variant: 'success' },
  paused:    { label: 'Paused',     variant: 'gold'    },
  completed: { label: 'Completed',  variant: 'info'    },
  cancelled: { label: 'Unenrolled', variant: 'default' },
}

const PAGE_SIZE = 25

export function CampaignEnrollmentsModal({ open, onClose, campaignId, campaignName, totalSteps }: Props) {
  const [rows,       setRows]       = useState<EnrollmentRow[]>([])
  const [total,      setTotal]      = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [page,       setPage]       = useState(1)
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState('')

  useEffect(() => {
    if (!open) return
    setPage(1)
    fetchPage(1)
  }, [open, campaignId])

  async function fetchPage(p: number) {
    setLoading(true)
    setError('')
    try {
      const res  = await fetch(`/api/campaigns/${campaignId}/enrollments?page=${p}&pageSize=${PAGE_SIZE}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to load enrollments')
      setRows(json.data)
      setTotal(json.total)
      setTotalPages(json.totalPages)
      setPage(p)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load enrollments')
    } finally {
      setLoading(false)
    }
  }

  async function updateStatus(enrollmentId: string, status: 'active' | 'paused' | 'cancelled') {
    setError('')
    try {
      const res  = await fetch(`/api/campaigns/enrollments/${enrollmentId}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ status }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to update enrollment')
      setRows(prev => prev.map(r => r.id === enrollmentId ? { ...r, status } : r))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update enrollment')
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={campaignName} size="xl">
      <div className="flex flex-col gap-4">

        {/* Count */}
        <p className="text-sm text-charcoal-500 flex items-center gap-1.5">
          <Users size={14} />
          {loading ? 'Loading…' : `${total} enrollment${total !== 1 ? 's' : ''}`}
        </p>

        {error && <p className="text-xs text-red-600">{error}</p>}

        {/* Table */}
        {!loading && rows.length === 0 && !error && (
          <p className="text-sm text-charcoal-400 text-center py-10">No enrollments yet.</p>
        )}

        {rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-charcoal-100 text-xs text-charcoal-500 uppercase tracking-wide">
                  <th className="pb-2 text-left font-medium">Contact</th>
                  <th className="pb-2 text-left font-medium">Step</th>
                  <th className="pb-2 text-left font-medium">Status</th>
                  <th className="pb-2 text-left font-medium">Next run</th>
                  <th className="pb-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-charcoal-50">
                {rows.map(row => {
                  const cfg = STATUS_CONFIG[row.status]
                  return (
                    <tr key={row.id} className="hover:bg-charcoal-50 transition-colors">
                      <td className="py-2.5 pr-4">
                        <p className="font-medium text-charcoal-900">
                          {row.contact.firstName} {row.contact.lastName}
                        </p>
                        {row.contact.email && (
                          <p className="text-xs text-charcoal-400">{row.contact.email}</p>
                        )}
                      </td>
                      <td className="py-2.5 pr-4 text-charcoal-600 whitespace-nowrap">
                        {row.currentStep + 1} of {totalSteps}
                      </td>
                      <td className="py-2.5 pr-4">
                        <Badge variant={cfg.variant} className="text-xs">{cfg.label}</Badge>
                      </td>
                      <td className="py-2.5 pr-4 text-xs text-charcoal-500 whitespace-nowrap">
                        {row.nextRunAt
                          ? formatDate(new Date(row.nextRunAt), { month: 'short', day: 'numeric' })
                          : '—'
                        }
                      </td>
                      <td className="py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {row.status === 'active' && (
                            <>
                              <button
                                onClick={() => updateStatus(row.id, 'paused')}
                                className="rounded px-2 py-1 text-xs text-charcoal-500 hover:bg-charcoal-100 transition-colors">
                                Pause
                              </button>
                              <button
                                onClick={() => updateStatus(row.id, 'cancelled')}
                                className="rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50 transition-colors">
                                Unenroll
                              </button>
                            </>
                          )}
                          {row.status === 'paused' && (
                            <>
                              <button
                                onClick={() => updateStatus(row.id, 'active')}
                                className="rounded px-2 py-1 text-xs text-green-600 hover:bg-green-50 transition-colors">
                                Resume
                              </button>
                              <button
                                onClick={() => updateStatus(row.id, 'cancelled')}
                                className="rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50 transition-colors">
                                Unenroll
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2 border-t border-charcoal-100">
            <p className="text-xs text-charcoal-400">
              Page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="ghost" size="sm"
                disabled={page <= 1}
                onClick={() => fetchPage(page - 1)}>
                Previous
              </Button>
              <Button
                variant="ghost" size="sm"
                disabled={page >= totalPages}
                onClick={() => fetchPage(page + 1)}>
                Next
              </Button>
            </div>
          </div>
        )}

      </div>
    </Modal>
  )
}
```

- [ ] **Step 2: Export from `components/crm/index.ts`**

Add at the end of `components/crm/index.ts`:

```typescript
export { CampaignEnrollmentsModal } from './CampaignEnrollmentsModal'
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd C:\Users\miket\Documents\realestateweb && npx tsc --noEmit 2>&1 | head -20
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
cd C:\Users\miket\Documents\realestateweb && git add components/crm/CampaignEnrollmentsModal.tsx components/crm/index.ts && git commit -m "feat: add CampaignEnrollmentsModal component"
```

---

### Task 2: Wire CampaignEnrollmentsModal into AutomationManager

**Files:**
- Modify: `components/crm/AutomationManager.tsx`

The enrollment count `<p>` appears in two places — the Drip Campaigns card (around line 243) and the Special Events card (around line 381). Both must become clickable buttons that open the modal for that campaign.

- [ ] **Step 1: Add modal state and import to AutomationManager**

At the top of `AutomationManager.tsx`, add `CampaignEnrollmentsModal` to the import from `./CampaignEnrollmentsModal` (import it directly, not via the barrel):

```typescript
import { CampaignEnrollmentsModal } from './CampaignEnrollmentsModal'
```

Inside the `AutomationManager` component function, after the existing `useState` declarations, add:

```typescript
  const [enrollmentModal, setEnrollmentModal] = useState<{ campaignId: string; campaignName: string; totalSteps: number } | null>(null)
```

- [ ] **Step 2: Replace enrollment count in Drip Campaigns card**

Find this block in the Drip Campaigns section (inside the `campaigns.map(c => ...)` render):

```tsx
              <p className="text-xs text-charcoal-400">
                {c.activeEnrollments} active enrollment{c.activeEnrollments !== 1 ? 's' : ''}
              </p>
```

Replace with:

```tsx
              <button
                type="button"
                onClick={() => setEnrollmentModal({ campaignId: c.id, campaignName: c.name, totalSteps: c.steps.length })}
                className="text-xs text-charcoal-400 hover:text-charcoal-700 hover:underline text-left">
                {c.activeEnrollments} active enrollment{c.activeEnrollments !== 1 ? 's' : ''}
              </button>
```

- [ ] **Step 3: Replace enrollment count in Special Events card**

Find this identical block in the Special Events section (inside the `specialEvents.map(c => ...)` render):

```tsx
              <p className="text-xs text-charcoal-400">
                {c.activeEnrollments} active enrollment{c.activeEnrollments !== 1 ? 's' : ''}
              </p>
```

Replace with:

```tsx
              <button
                type="button"
                onClick={() => setEnrollmentModal({ campaignId: c.id, campaignName: c.name, totalSteps: c.steps.length })}
                className="text-xs text-charcoal-400 hover:text-charcoal-700 hover:underline text-left">
                {c.activeEnrollments} active enrollment{c.activeEnrollments !== 1 ? 's' : ''}
              </button>
```

- [ ] **Step 4: Render the modal at the bottom of the return statement**

Find the `return (` at the bottom of `AutomationManager`. It renders `<Tabs ... />`. Wrap it in a fragment and add the modal after the Tabs:

```tsx
  return (
    <>
      <Tabs tabs={[
        { id: 'campaigns',      label: `Drip Campaigns (${campaigns.length})`,     content: CampaignsTab },
        { id: 'special_events', label: `Special Events (${specialEvents.length})`, content: SpecialEventsTab },
        { id: 'rules',          label: `Automation Rules (${rules.length})`,       content: RulesTab },
        { id: 'queue',          label: `Job Queue (${jobStats.pending} pending)`,  content: QueueTab },
      ]} />

      {enrollmentModal && (
        <CampaignEnrollmentsModal
          open={!!enrollmentModal}
          onClose={() => setEnrollmentModal(null)}
          campaignId={enrollmentModal.campaignId}
          campaignName={enrollmentModal.campaignName}
          totalSteps={enrollmentModal.totalSteps}
        />
      )}
    </>
  )
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd C:\Users\miket\Documents\realestateweb && npx tsc --noEmit 2>&1 | head -20
```

Expected: no output. Fix any errors before proceeding.

- [ ] **Step 6: Commit**

```bash
cd C:\Users\miket\Documents\realestateweb && git add components/crm/AutomationManager.tsx && git commit -m "feat: wire CampaignEnrollmentsModal into AutomationManager campaign cards"
```

---

## Final verification

- [ ] `npx tsc --noEmit` — no TypeScript errors
- [ ] Navigate to `/admin/automation` — Drip Campaigns tab shows campaign cards
- [ ] Click the "N active enrollments" text on a campaign card — modal opens with campaign name in header
- [ ] Modal shows enrollment count, table with Contact / Step / Status / Next run / Actions columns
- [ ] Active enrollment row has Pause and Unenroll buttons; paused has Resume and Unenroll
- [ ] Click Unenroll — row status changes to "Unenrolled" badge, buttons disappear
- [ ] Click Pause — row status changes to "Paused", buttons change to Resume + Unenroll
- [ ] Click Resume — row status changes to "Active"
- [ ] Contact with no email — email line is absent (not an empty line)
- [ ] Empty campaign — modal shows "No enrollments yet."
- [ ] Close modal — modal disappears; enrollment count on card is unchanged (accepted — stale until page refresh)
- [ ] Special Events tab — same behavior on its campaign cards
