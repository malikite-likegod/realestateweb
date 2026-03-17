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

### Modal

- **Component:** `Modal` with `size="lg"`
- **Header title:** campaign name (e.g., "New Buyer Drip")
- **Subheading:** live count — "N enrollments"

### Enrollment table

Columns:

| Column | Content |
|---|---|
| Contact | Full name (bold) + email (muted, below) |
| Step | "2 of 5" |
| Status | Badge (Active = success, Paused = gold, Unenrolled = default, Completed = info) |
| Next run | Formatted date, or "—" if null |
| Actions | Context-sensitive buttons (see below) |

Action buttons per row:

| Status | Buttons |
|---|---|
| active | Pause · Unenroll |
| paused | Resume · Unenroll |
| completed | _(none)_ |
| cancelled | _(none)_ |

### Pagination

25 rows per page. "Previous / Next" controls shown when `totalPages > 1`.

### Empty state

"No enrollments yet." message centered in the modal body.

### Loading state

Spinner shown while fetching. Error message shown on fetch failure.

---

## Data flow

1. Modal opens → `GET /api/campaigns/[id]/enrollments?page=1&pageSize=25`
2. User clicks Pause / Resume / Unenroll → `PATCH /api/campaigns/enrollments/[enrollmentId]` with `{ status: 'paused' | 'active' | 'cancelled' }`
3. On success: update that row in local state optimistically (no full refetch needed)
4. Modal header count updates to reflect current data

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
