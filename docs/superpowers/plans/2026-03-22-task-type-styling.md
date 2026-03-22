# Task Type Styling Enhancement Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `textColor` and `highlightColor` fields to task types, expose them in the creation UI, and display tasks everywhere as `"TypeName - Task Title"` with the styling applied.

**Architecture:** Schema first (Prisma migration), then API validation, then display surfaces (calendar events route, task list page/component, TaskTypeManager UI, CalendarView eventContent renderer). Each task is independently committable.

**Tech Stack:** Next.js 14 App Router, Prisma ORM, FullCalendar, React, Zod, TypeScript, Tailwind CSS

**Spec:** `docs/superpowers/specs/2026-03-22-task-type-styling-design.md`

---

## Chunk 1: Schema + Migration + API

### Task 1: Add textColor and highlightColor to Prisma schema

**Files:**
- Modify: `prisma/schema.prisma` (lines 413–423)

- [ ] **Step 1: Edit the TaskType model**

  Open `prisma/schema.prisma` and update the TaskType model from:

  ```prisma
  model TaskType {
    id        String   @id @default(cuid())
    name      String   @unique
    color     String   @default("#6366f1")
    isDefault Boolean  @default(false)
    createdAt DateTime @default(now())

    tasks Task[]

    @@map("task_types")
  }
  ```

  To:

  ```prisma
  model TaskType {
    id             String   @id @default(cuid())
    name           String   @unique
    color          String   @default("#6366f1")
    textColor      String?
    highlightColor String?
    isDefault      Boolean  @default(false)
    createdAt      DateTime @default(now())

    tasks Task[]

    @@map("task_types")
  }
  ```

- [ ] **Step 2: Run the migration**

  ```bash
  npx prisma migrate dev --name add_task_type_styling
  ```

  Expected: migration file created in `prisma/migrations/`, Prisma client regenerated. No errors.

- [ ] **Step 3: Verify Prisma client**

  ```bash
  npx prisma generate
  ```

  Expected: "Generated Prisma Client" with no errors.

- [ ] **Step 4: Commit**

  ```bash
  git add prisma/schema.prisma prisma/migrations/
  git commit -m "feat: add textColor and highlightColor fields to TaskType schema"
  ```

---

### Task 2: Update POST /api/task-types to accept new styling fields

**Files:**
- Modify: `app/api/task-types/route.ts`

- [ ] **Step 1: Update the Zod schema and create handler**

  Replace the `schema` constant and `POST` handler in `app/api/task-types/route.ts`:

  ```ts
  const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/)

  const schema = z.object({
    name:           z.string().min(1).max(50),
    color:          hexColor.optional(),
    textColor:      hexColor.nullable().optional(),
    highlightColor: hexColor.nullable().optional(),
  })
  ```

  The `POST` handler body remains unchanged — `schema.parse(body)` will now include the new fields automatically, and `prisma.taskType.create({ data })` passes them through.

- [ ] **Step 2: Verify the file looks correct**

  Full file should be:

  ```ts
  import { NextResponse } from 'next/server'
  import { z } from 'zod'
  import { getSession } from '@/lib/auth'
  import { prisma } from '@/lib/prisma'

  const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/)

  const schema = z.object({
    name:           z.string().min(1).max(50),
    color:          hexColor.optional(),
    textColor:      hexColor.nullable().optional(),
    highlightColor: hexColor.nullable().optional(),
  })

  export async function GET() {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const types = await prisma.taskType.findMany({ orderBy: [{ isDefault: 'desc' }, { name: 'asc' }] })
    return NextResponse.json({ data: types })
  }

  export async function POST(request: Request) {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    try {
      const body = await request.json()
      const data = schema.parse(body)
      const type = await prisma.taskType.create({ data })
      return NextResponse.json({ data: type }, { status: 201 })
    } catch (error) {
      if (error instanceof z.ZodError) return NextResponse.json({ error: error.errors }, { status: 400 })
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
  }
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add app/api/task-types/route.ts
  git commit -m "feat: accept textColor and highlightColor in POST /api/task-types"
  ```

---

### Task 3: Update PATCH /api/task-types/[id] to accept new styling fields

**Files:**
- Modify: `app/api/task-types/[id]/route.ts`

- [ ] **Step 1: Update the patchSchema**

  Replace the `patchSchema` constant in `app/api/task-types/[id]/route.ts`:

  ```ts
  const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/)

  const patchSchema = z.object({
    name:           z.string().min(1).max(50).optional(),
    color:          hexColor.optional(),
    textColor:      hexColor.nullable().optional(),
    highlightColor: hexColor.nullable().optional(),
  })
  ```

  The `PATCH` and `DELETE` handlers remain unchanged.

- [ ] **Step 2: Verify the full file**

  ```ts
  import { NextResponse } from 'next/server'
  import { z } from 'zod'
  import { getSession } from '@/lib/auth'
  import { prisma } from '@/lib/prisma'

  const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/)

  const patchSchema = z.object({
    name:           z.string().min(1).max(50).optional(),
    color:          hexColor.optional(),
    textColor:      hexColor.nullable().optional(),
    highlightColor: hexColor.nullable().optional(),
  })

  export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    try {
      const { id } = await params
      const body   = await request.json()
      const data   = patchSchema.parse(body)
      const type   = await prisma.taskType.update({ where: { id }, data })
      return NextResponse.json({ data: type })
    } catch (error) {
      if (error instanceof z.ZodError) return NextResponse.json({ error: error.errors }, { status: 400 })
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
  }

  export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const type = await prisma.taskType.findUnique({ where: { id } })
    if (type?.isDefault) return NextResponse.json({ error: 'Cannot delete a default task type' }, { status: 400 })
    await prisma.taskType.delete({ where: { id } })
    return NextResponse.json({ message: 'Deleted' })
  }
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add app/api/task-types/[id]/route.ts
  git commit -m "feat: accept textColor and highlightColor in PATCH /api/task-types/[id]"
  ```

---

## Chunk 2: Calendar Events Route

### Task 4: Update calendar events API — prefixed title + new style fields

**Files:**
- Modify: `app/api/calendar/events/route.ts` (lines 41–79)

- [ ] **Step 1: Update the taskEvents map function**

  In `app/api/calendar/events/route.ts`, replace the `taskEvents` map block (lines 41–79):

  ```ts
  const taskEvents = tasks.map(task => {
    const start = task.startDatetime ?? task.dueAt
    const end   = task.endDatetime   ?? task.dueAt

    const toFC = (d: Date | null) => {
      if (!d) return null
      if (task.allDay) return d.toISOString().split('T')[0]
      return d.toISOString()
    }

    const taskTypeName = task.taskType?.name ?? null
    const title = taskTypeName ? `${taskTypeName} - ${task.title}` : task.title

    return {
      id:              `task_${task.id}`,
      title,
      start:           toFC(start),
      end:             toFC(end),
      allDay:          task.allDay,
      backgroundColor: task.taskType?.color ?? '#6366f1',
      borderColor:     task.taskType?.color ?? '#6366f1',
      textColor:       task.taskType?.textColor ?? undefined,
      classNames:      task.status === 'done' ? ['fc-event-done'] : [],
      extendedProps: {
        recordType:     'task',
        taskId:         task.id,
        status:         task.status,
        priority:       task.priority,
        description:    task.description,
        taskType:       task.taskType?.name        ?? null,
        taskTypeId:     task.taskTypeId            ?? null,
        highlightColor: task.taskType?.highlightColor ?? null,
        contactId:      task.contact?.id           ?? null,
        contactName:    task.contact ? `${task.contact.firstName} ${task.contact.lastName}` : null,
        dealId:         task.deal?.id              ?? null,
        dealTitle:      task.deal?.title           ?? null,
        assignee:       task.assignee?.name        ?? null,
      },
    }
  })
  ```

- [ ] **Step 2: Verify TypeScript compiles**

  ```bash
  npx tsc --noEmit
  ```

  Expected: no errors related to `textColor` or `highlightColor`. (Prisma client now has these fields after Task 1.)

- [ ] **Step 3: Commit**

  ```bash
  git add app/api/calendar/events/route.ts
  git commit -m "feat: prefix task event titles with type name, pass textColor and highlightColor to calendar"
  ```

---

## Chunk 3: Calendar UI — Highlight Rendering

### Task 5: Add eventContent renderer to CalendarView for highlight color

**Files:**
- Modify: `components/calendar/CalendarView.tsx`

- [ ] **Step 1: Update the CalendarEvent interface to include highlightColor**

  In `components/calendar/CalendarView.tsx`, update the `CalendarEvent` interface (lines 30–47):

  ```ts
  interface CalendarEvent {
    id: string
    title: string
    start: string | null
    end: string | null
    allDay: boolean
    extendedProps: {
      recordType: 'task' | 'birthday'
      taskId?: string
      status?: string
      priority?: string
      description?: string
      taskType?: string
      highlightColor?: string | null
      contactName?: string
      dealTitle?: string
      assignee?: string
    }
  }
  ```

- [ ] **Step 2: Add the eventContent prop to FullCalendar**

  In the `<FullCalendar>` component (around line 182), add the `eventContent` prop after `eventTimeFormat`:

  ```tsx
  eventContent={(arg) => {
    const highlight = arg.event.extendedProps.highlightColor as string | null | undefined
    return (
      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '0 2px' }}>
        {highlight ? (
          <mark style={{ background: highlight, color: 'inherit', borderRadius: '2px', padding: '0 2px' }}>
            {arg.event.title}
          </mark>
        ) : (
          <span>{arg.event.title}</span>
        )}
      </div>
    )
  }}
  ```

  Place it after the existing `eventTimeFormat` prop:

  ```tsx
  eventTimeFormat={{ hour: 'numeric', minute: '2-digit', meridiem: 'short' }}
  eventContent={(arg) => {
    const highlight = arg.event.extendedProps.highlightColor as string | null | undefined
    return (
      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '0 2px' }}>
        {highlight ? (
          <mark style={{ background: highlight, color: 'inherit', borderRadius: '2px', padding: '0 2px' }}>
            {arg.event.title}
          </mark>
        ) : (
          <span>{arg.event.title}</span>
        )}
      </div>
    )
  }}
  ```

- [ ] **Step 3: Verify TypeScript compiles**

  ```bash
  npx tsc --noEmit
  ```

  Expected: no errors.

- [ ] **Step 4: Commit**

  ```bash
  git add components/calendar/CalendarView.tsx
  git commit -m "feat: render highlight color on calendar events via eventContent"
  ```

---

## Chunk 4: Task List Display

### Task 6: Include taskType in task list query

**Files:**
- Modify: `app/admin/tasks/page.tsx` (lines 18–21)

- [ ] **Step 1: Update the include object**

  Replace the `include` constant in `app/admin/tasks/page.tsx`:

  ```ts
  const include = {
    assignee: { select: { name: true } },
    contact:  { select: { firstName: true, lastName: true } },
    taskType: { select: { name: true, textColor: true, highlightColor: true } },
  } as const
  ```

- [ ] **Step 2: Verify TypeScript compiles**

  ```bash
  npx tsc --noEmit
  ```

  Expected: no errors. Prisma will now include `taskType` on each returned task.

- [ ] **Step 3: Commit**

  ```bash
  git add app/admin/tasks/page.tsx
  git commit -m "feat: include taskType in tasks page query"
  ```

---

### Task 7: Update TasksManager to show prefixed title and apply styling

**Files:**
- Modify: `app/admin/tasks/TasksManager.tsx`

- [ ] **Step 1: Update the Task type definition**

  Replace the `Task` type (lines 23–34) in `app/admin/tasks/TasksManager.tsx`:

  ```ts
  type Task = {
    id:          string
    title:       string
    description: string | null
    status:      string
    priority:    string
    dueAt:       Date | string | null
    completedAt: Date | string | null
    taskTypeId:  string | null
    taskType:    { name: string; textColor: string | null; highlightColor: string | null } | null
    assignee:    { name: string } | null
    contact:     { firstName: string; lastName: string } | null
  }
  ```

- [ ] **Step 2: Update TaskRow to display prefixed title with styling**

  In the `TaskRow` component, replace the title paragraph (line 124–126):

  ```tsx
  {/* Body */}
  <div className="flex-1 min-w-0">
    <p
      className={cn('text-sm font-medium text-charcoal-900', done && 'line-through text-charcoal-400')}
      style={
        !done && task.taskType
          ? {
              ...(task.taskType.highlightColor ? { background: task.taskType.highlightColor } : {}),
              ...(task.taskType.textColor      ? { color:      task.taskType.textColor }      : {}),
              ...(task.taskType.highlightColor ? { borderRadius: '3px', padding: '0 3px' }   : {}),
            }
          : undefined
      }
    >
      {task.taskType ? `${task.taskType.name} - ${task.title}` : task.title}
    </p>
  ```

  The rest of the `TaskRow` body (description, badges, etc.) is unchanged.

- [ ] **Step 3: Verify TypeScript compiles**

  ```bash
  npx tsc --noEmit
  ```

  Expected: no errors.

- [ ] **Step 4: Commit**

  ```bash
  git add app/admin/tasks/TasksManager.tsx
  git commit -m "feat: display tasks as 'TypeName - Title' with text color and highlight in task list"
  ```

---

## Chunk 5: TaskTypeManager UI

### Task 8: Add text color and highlight color pickers to TaskTypeManager

**Files:**
- Modify: `components/calendar/TaskTypeManager.tsx`

This is the largest UI change. The form gains two new optional color pickers with "None" clear buttons, and the list rows show three color swatches.

- [ ] **Step 1: Replace the entire file**

  Write `components/calendar/TaskTypeManager.tsx` with:

  ```tsx
  'use client'

  import { useState, useEffect } from 'react'
  import { Button, Input } from '@/components/ui'
  import { Plus, Trash2, X } from 'lucide-react'

  interface TaskType {
    id:             string
    name:           string
    color:          string
    textColor:      string | null
    highlightColor: string | null
    isDefault:      boolean
  }

  export function TaskTypeManager() {
    const [types,          setTypes]          = useState<TaskType[]>([])
    const [newName,        setNewName]        = useState('')
    const [newColor,       setNewColor]       = useState('#6366f1')
    const [newTextColor,   setNewTextColor]   = useState<string | null>(null)
    const [newHighlight,   setNewHighlight]   = useState<string | null>(null)
    const [saving,         setSaving]         = useState(false)

    async function load() {
      const r = await fetch('/api/task-types')
      const j = await r.json()
      setTypes(j.data ?? [])
    }

    useEffect(() => { load() }, [])

    async function handleAdd(e: React.FormEvent) {
      e.preventDefault()
      if (!newName.trim()) return
      setSaving(true)
      await fetch('/api/task-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:           newName.trim(),
          color:          newColor,
          textColor:      newTextColor,
          highlightColor: newHighlight,
        }),
      })
      setNewName('')
      setNewColor('#6366f1')
      setNewTextColor(null)
      setNewHighlight(null)
      await load()
      setSaving(false)
    }

    async function handleDelete(id: string) {
      if (!confirm('Delete this task type?')) return
      await fetch(`/api/task-types/${id}`, { method: 'DELETE' })
      await load()
    }

    return (
      <div className="space-y-4">
        {/* List of existing types */}
        <div className="space-y-2">
          {types.map(t => (
            <div key={t.id} className="flex items-center gap-3 rounded-lg border border-charcoal-100 bg-white px-3 py-2">
              {/* Background color swatch */}
              <span className="h-3 w-3 rounded-full shrink-0" style={{ background: t.color }} title="Background" />
              {/* Text color swatch (grey circle if not set) */}
              <span
                className="h-3 w-3 rounded-full shrink-0 border border-charcoal-200"
                style={{ background: t.textColor ?? '#e5e7eb' }}
                title={t.textColor ? 'Text color' : 'Text color: default'}
              />
              {/* Highlight color swatch */}
              <span
                className="h-3 w-3 rounded-full shrink-0 border border-charcoal-200"
                style={{ background: t.highlightColor ?? '#e5e7eb' }}
                title={t.highlightColor ? 'Highlight color' : 'Highlight: none'}
              />
              <span className="flex-1 text-sm font-medium text-charcoal-800">{t.name}</span>
              {t.isDefault ? (
                <span className="text-xs text-charcoal-400">default</span>
              ) : (
                <button
                  onClick={() => handleDelete(t.id)}
                  className="text-charcoal-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Create form */}
        <form onSubmit={handleAdd} className="space-y-3">
          <Input
            label="New Type Name"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="e.g. Site Visit"
          />

          {/* Color pickers row */}
          <div className="flex flex-wrap gap-4">
            {/* Background color */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-charcoal-600">Background</label>
              <input
                type="color"
                value={newColor}
                onChange={e => setNewColor(e.target.value)}
                className="h-9 w-12 cursor-pointer rounded border border-charcoal-200 p-0.5"
              />
            </div>

            {/* Text color */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-charcoal-600">Text Color</label>
              <div className="flex items-center gap-1">
                <input
                  type="color"
                  value={newTextColor ?? '#ffffff'}
                  onChange={e => setNewTextColor(e.target.value)}
                  className="h-9 w-12 cursor-pointer rounded border border-charcoal-200 p-0.5"
                />
                {newTextColor && (
                  <button
                    type="button"
                    onClick={() => setNewTextColor(null)}
                    className="text-charcoal-400 hover:text-charcoal-700"
                    title="Clear text color"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>

            {/* Highlight color */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-charcoal-600">Highlight</label>
              <div className="flex items-center gap-1">
                <input
                  type="color"
                  value={newHighlight ?? '#fef08a'}
                  onChange={e => setNewHighlight(e.target.value)}
                  className="h-9 w-12 cursor-pointer rounded border border-charcoal-200 p-0.5"
                />
                {newHighlight && (
                  <button
                    type="button"
                    onClick={() => setNewHighlight(null)}
                    className="text-charcoal-400 hover:text-charcoal-700"
                    title="Clear highlight"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>
          </div>

          <Button type="submit" variant="primary" leftIcon={<Plus size={15} />} disabled={saving}>
            Add
          </Button>
        </form>
      </div>
    )
  }
  ```

- [ ] **Step 2: Verify TypeScript compiles**

  ```bash
  npx tsc --noEmit
  ```

  Expected: no errors.

- [ ] **Step 3: Commit**

  ```bash
  git add components/calendar/TaskTypeManager.tsx
  git commit -m "feat: add text color and highlight color pickers to TaskTypeManager"
  ```

---

## Chunk 6: Final Verification

### Task 9: End-to-end smoke test

- [ ] **Step 1: Start the dev server**

  ```bash
  npm run dev
  ```

- [ ] **Step 2: Create a task type with all three colors**

  1. Navigate to `/admin/calendar`
  2. Click "Task Types" → "Add"
  3. Enter name "Test Type", pick a background, text color, and highlight color
  4. Submit — new type appears in the list with three color swatches

- [ ] **Step 3: Create a task of that type**

  1. Click "New Task" on the calendar
  2. Fill in a title, select "Test Type" as the task type, set a date
  3. Save

- [ ] **Step 4: Verify calendar display**

  - Event appears as "Test Type - [your title]"
  - Background color matches the background picker
  - Text color applied (FullCalendar text reflects textColor)
  - Highlight renders as a mark/highlighter behind the text (if highlightColor set)

- [ ] **Step 5: Verify task list display**

  1. Navigate to `/admin/tasks`
  2. Find the new task — title should read "Test Type - [your title]"
  3. If highlight color was set, the title text has that background
  4. If text color was set, the title text uses that color

- [ ] **Step 6: Final commit (if any last-minute fixes)**

  ```bash
  git add -A
  git commit -m "fix: task type styling smoke test fixes"
  ```
