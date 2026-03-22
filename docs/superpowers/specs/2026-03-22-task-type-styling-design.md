# Task Type Styling Enhancement — Design Spec

**Date:** 2026-03-22
**Status:** Approved

---

## Overview

Extend the task type system with two additional styling fields — text color and highlight color — and update all task display surfaces (calendar and task list) to show tasks prefixed with their type name.

---

## Goals

1. When creating or editing a task type, users can configure: background color, text color, and highlight color (a highlighter-style background behind the text).
2. Tasks are displayed everywhere as `"TypeName - Task Title"` instead of just `"Task Title"`.
3. All three styling values are reflected visually on the calendar and task list.

---

## Schema Changes

Add two nullable columns to the `task_types` table:

```prisma
model TaskType {
  id             String   @id @default(cuid())
  name           String   @unique
  color          String   @default("#6366f1")   // background color (existing)
  textColor      String?                          // text color (new)
  highlightColor String?                          // text highlight/marker color (new)
  isDefault      Boolean  @default(false)
  createdAt      DateTime @default(now())

  tasks Task[]

  @@map("task_types")
}
```

- Both new fields are optional (null = no override, no styling applied).
- Both follow the same hex validation pattern as `color`: `^#[0-9a-fA-F]{6}$`.
- Validation is strict: an invalid hex value is rejected with a 400 error; omitting the field or sending `null` clears the value.
- A single Prisma migration adds both columns with no database-level defaults (nullable).

---

## API Changes

### POST `/api/task-types`

Accept two new optional fields in the request body:

```json
{
  "name": "Referral",
  "color": "#f59e0b",
  "textColor": "#1a1a1a",
  "highlightColor": "#fef08a"
}
```

Both new fields are validated as hex strings if present, ignored if absent.

### PATCH `/api/task-types/[id]`

Same two new optional fields accepted. All fields remain individually optional (partial update supported).

### GET `/api/task-types`

Returns all fields including the two new ones. Consumers treat null values as "no override".

### GET `/api/calendar/events`

Task events include `textColor` and `highlightColor` in `extendedProps` and pass `textColor` directly to the FullCalendar event object (FullCalendar natively supports a `textColor` field on events).

---

## Title Format

All task display surfaces format the title as:

```
TypeName - Task Title
```

- If a task has no type assigned, display just the task title (no prefix).
- The hyphen and space are literal: ` - `.

**Affected surfaces:**
1. Calendar event titles (built in the `/api/calendar/events` route)
2. Task list rows (`TasksManager` component)

---

## Calendar Display

Changes to `/api/calendar/events/route.ts`:

```ts
const taskTypeName = task.taskType?.name ?? null
const title = taskTypeName ? `${taskTypeName} - ${task.title}` : task.title

return {
  id:              `task_${task.id}`,
  title,                                              // prefixed title
  start:           toFC(start),
  end:             toFC(end),
  allDay:          task.allDay,
  backgroundColor: task.taskType?.color ?? '#6366f1',
  borderColor:     task.taskType?.color ?? '#6366f1',
  textColor:       task.taskType?.textColor ?? undefined,  // FullCalendar native field; undefined = FullCalendar picks contrast color automatically
  classNames:      task.status === 'done' ? ['fc-event-done'] : [],
  extendedProps: {
    recordType:     'task',
    taskId:         task.id,
    highlightColor: task.taskType?.highlightColor ?? null,  // for custom rendering
    // ... existing extendedProps unchanged
  },
}
```

**Highlight color rendering:** FullCalendar's `eventContent` render prop (already used or to be added in `CalendarView`) wraps the event title in a `<mark>` span when `highlightColor` is present:

```tsx
eventContent={(arg) => {
  const highlight = arg.event.extendedProps.highlightColor
  return (
    <div className="fc-event-title-container">
      {highlight ? (
        <mark style={{ background: highlight, color: 'inherit', padding: '0 2px' }}>
          {arg.event.title}
        </mark>
      ) : (
        <span>{arg.event.title}</span>
      )}
    </div>
  )
}}
```

---

## Task List Display

Changes to `TasksManager` (task row rendering):

- The displayed title becomes `"TypeName - Task Title"` when a type is assigned.
- If `highlightColor` is set on the type, the title text gets inline `background: highlightColor` styling.
- If `textColor` is set, the title text gets inline `color: textColor` styling.

The task query in `app/admin/tasks/page.tsx` (or wherever tasks are fetched) must include `taskType { name, textColor, highlightColor }` in the select.

---

## TaskTypeManager UI

The creation form gains two new color pickers below the existing background color picker:

| Label | Field | Default shown |
|---|---|---|
| Background Color | `color` | `#6366f1` |
| Text Color | `textColor` | `#ffffff` (picker only, no DB default) |
| Highlight Color | `highlightColor` | `#fef08a` (picker only, no DB default) |

The task type list also shows all three color swatches as small circles per row.

**Default task types** can have their styling edited (only deletion remains blocked).

The form uses HTML5 `<input type="color">` for all three pickers, consistent with the existing background color picker. A "None" / clear button sits beside the text color and highlight color pickers so users can remove the override (submit null).

---

## Data Flow Summary

```
User creates/edits TaskType
  → POST/PATCH /api/task-types (name, color, textColor?, highlightColor?)
  → Stored in task_types table

User views Calendar
  → GET /api/calendar/events
  → Task event: title = "TypeName - Title", textColor from type, highlightColor in extendedProps
  → FullCalendar renders: backgroundColor, borderColor, textColor natively; highlight via eventContent

User views Task List
  → Tasks fetched with taskType relation
  → Row title = "TypeName - Title", inline color/highlight styles applied
```

---

## Files to Modify

| File | Change |
|---|---|
| `prisma/schema.prisma` | Add `textColor String?` and `highlightColor String?` to TaskType |
| `prisma/migrations/…` | New migration for the two columns |
| `app/api/task-types/route.ts` | POST: add validation + persistence for new fields |
| `app/api/task-types/[id]/route.ts` | PATCH: add validation + persistence for new fields |
| `app/api/calendar/events/route.ts` | Prefix title with type name; pass textColor + highlightColor |
| `app/admin/tasks/page.tsx` | Include `taskType { name, textColor, highlightColor }` in query |
| `app/admin/tasks/TasksManager.tsx` | Update Task type + TaskRow to show prefixed title and apply styles |
| `components/calendar/TaskTypeManager.tsx` | Add two color pickers + clear buttons; update TypeScript interface |
| `components/calendar/CalendarView.tsx` | Add/update `eventContent` prop for highlight rendering |

---

## Out of Scope

- Font weight / size / other typographic styling (can be added later).
- Per-task style overrides (styling is per type, not per individual task).
- Changing styles of the 10 default task types via migration (they remain with only their existing color; users can edit via the UI).
