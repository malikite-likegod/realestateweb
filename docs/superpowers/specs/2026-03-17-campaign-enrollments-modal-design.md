# Campaign Enrollments Modal — Design Spec
**Date:** 2026-03-17
**Status:** Approved

---

## Overview

Add an enrollment management modal to the Automation Manager. Clicking the "N active enrollments" count on any campaign card opens a modal that lists all enrollees and allows Pause, Resume, and Unenroll actions per contact.

---

## Goals

- Surface enrollment management from within the Automation Manager (campaign side), not just the contact detail page
- Reuse existing API endpoints — no new backend work required
- Follow established modal and table patterns in the codebase

---

## UI

### Trigger

The plain-text "N active enrollments" paragraph on each campaign card (drip and special events) is replaced with a button styled as a subtle link (`text-charcoal-400 hover:text-charcoal-700 hover:underline`). Clicking it opens `CampaignEnrollmentsModal` for that campaign.

The campaign's `totalSteps` count (derived from `steps.length`, already available on the campaign card data in `AutomationManager`) is passed as a prop to the modal so each enrollment row can show "N of Total" without an extra API call.

### Modal

- **Component:** `Modal` with `size="xl"` (`max-w-4xl`, for comfortable 5-column layout)
- **`title` prop:** campaign name (e.g., "New Buyer Drip")
- **Enrollment count:** rendered inside the modal body, above the table — e.g., "42 enrollments" as a small muted line. This is separate from the `title` prop since `Modal` only renders a single `<h2>` in its header.

### Enrollment table

Columns:

| Column | Content |
|---|---|
| Contact | Full name (bold) + email below in muted text; if email is null, email line is omitted |
| Step | `currentStep + 1` of `totalSteps` — e.g., "2 of 5". `currentStep` is the 0-based index of the next step to execute, so adding 1 gives the human-readable step number |
| Status | Badge (Active = success, Paused = gold, Unenrolled = default, Completed = info) |
| Next run | Formatted date, or "—" if `nextRunAt` is null |
| Actions | Context-sensitive buttons (see below) |

Action buttons per row:

| Status | Buttons |
|---|---|
| active | Pause · Unenroll |
| paused | Resume · Unenroll |
| completed | _(none)_ |
| cancelled | _(none)_ |

### Optimistic updates

- **Pause / Resume:** update the row's `status` in local state immediately on success.
- **Unenroll:** update the row's `status` to `'cancelled'` in local state. The row stays in the list with the "Unenrolled" badge and no action buttons. It is not removed.
- The campaign card's enrollment count underneath the modal is loaded at page-load time and will show a stale count until the page is refreshed — this is accepted behaviour.

### Pagination

25 rows per page. Previous / Next controls shown when `totalPages > 1`.

### Loading state

Spinner shown while fetching. Error message shown on fetch failure.

### Empty state

"No enrollments yet." message centered in the modal body.

---

## Data flow

### Fetch enrollments on open

```
GET /api/campaigns/[id]/enrollments?page=1&pageSize=25
```

Response shape:
```typescript
{
  data: Array<{
    id:          string
    status:      'active' | 'paused' | 'completed' | 'cancelled'
    currentStep: number        // 0-based index of next step to execute
    nextRunAt:   string | null
    enrolledAt:  string
    completedAt: string | null
    contact: {
      id:        string
      firstName: string
      lastName:  string
      email:     string | null  // may be null
    }
  }>
  total:      number
  page:       number
  pageSize:   number
  totalPages: number
}
```

### Update enrollment status

```
PATCH /api/campaigns/enrollments/[enrollmentId]
Body: { status: 'paused' | 'active' | 'cancelled' }
```

On success: update the matching row in local state.

---

## Files

| Action | File |
|---|---|
| Create | `components/crm/CampaignEnrollmentsModal.tsx` |
| Modify | `components/crm/AutomationManager.tsx` |

---

## Out of scope

- Bulk unenroll
- Enrollment search / filter
- Adding enrollments from this modal (use the existing Enroll button on campaign cards)
- Per-campaign detail page
- Reactive update of the campaign card's enrollment count after modal actions
