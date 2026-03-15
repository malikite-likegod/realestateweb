import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Returns events for FullCalendar: tasks + contact birthdays
// Query params: start, end (ISO strings for the visible date range)
export async function GET(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const start = searchParams.get('start')
  const end   = searchParams.get('end')

  const rangeFilter = start && end
    ? { gte: new Date(start), lte: new Date(end) }
    : undefined

  // ── Tasks ──────────────────────────────────────────────────────────────────
  const tasks = await prisma.task.findMany({
    where: {
      status: { not: 'cancelled' },
      ...(rangeFilter && {
        OR: [
          { startDatetime: rangeFilter },
          { dueAt:         rangeFilter },
          // include tasks with no datetime so they still show up
          { startDatetime: null, dueAt: null },
        ],
      }),
    },
    include: {
      taskType: true,
      contact:  { select: { id: true, firstName: true, lastName: true } },
      deal:     { select: { id: true, title: true } },
      assignee: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  const taskEvents = tasks.map(task => {
    const start = task.startDatetime ?? task.dueAt
    const end   = task.endDatetime   ?? task.dueAt
    return {
      id:              `task_${task.id}`,
      title:           task.title,
      start:           start?.toISOString() ?? null,
      end:             end?.toISOString()   ?? null,
      allDay:          task.allDay,
      backgroundColor: task.taskType?.color ?? '#6366f1',
      borderColor:     task.taskType?.color ?? '#6366f1',
      classNames:      task.status === 'done' ? ['fc-event-done'] : [],
      extendedProps: {
        recordType:   'task',
        taskId:       task.id,
        status:       task.status,
        priority:     task.priority,
        description:  task.description,
        taskType:     task.taskType?.name ?? null,
        taskTypeId:   task.taskTypeId     ?? null,
        contactId:    task.contact?.id    ?? null,
        contactName:  task.contact ? `${task.contact.firstName} ${task.contact.lastName}` : null,
        dealId:       task.deal?.id       ?? null,
        dealTitle:    task.deal?.title    ?? null,
        assignee:     task.assignee?.name ?? null,
      },
    }
  })

  // ── Birthdays ──────────────────────────────────────────────────────────────
  // Contacts with a birthday set — displayed as annual recurring all-day events
  const contacts = await prisma.contact.findMany({
    where: { birthday: { not: null } },
    select: { id: true, firstName: true, lastName: true, birthday: true },
  })

  const birthdayEvents = contacts.flatMap(c => {
    if (!c.birthday) return []
    const bday = new Date(c.birthday)

    // Generate birthday events for every year that overlaps the requested range
    const startYear = start ? new Date(start).getFullYear() : bday.getFullYear()
    const endYear   = end   ? new Date(end).getFullYear()   : startYear

    const events = []
    for (let year = startYear; year <= endYear; year++) {
      const date = new Date(year, bday.getMonth(), bday.getDate())
      events.push({
        id:              `birthday_${c.id}_${year}`,
        title:           `🎂 Birthday: ${c.firstName} ${c.lastName}`,
        start:           date.toISOString().split('T')[0], // date-only = all-day in FC
        allDay:          true,
        backgroundColor: '#ec4899',
        borderColor:     '#ec4899',
        extendedProps: {
          recordType: 'birthday',
          contactId:  c.id,
          contactName: `${c.firstName} ${c.lastName}`,
        },
      })
    }
    return events
  })

  return NextResponse.json({ data: [...taskEvents, ...birthdayEvents] })
}
