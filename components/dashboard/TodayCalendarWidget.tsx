import { prisma } from '@/lib/prisma'
import { Card } from '@/components/layout'
import { Calendar } from 'lucide-react'
import Link from 'next/link'

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

function formatFullDate(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

export async function TodayCalendarWidget() {
  const now   = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0)
  const end   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)

  const tasks = await prisma.task.findMany({
    where: {
      status: { not: 'cancelled' },
      OR: [
        { startDatetime: { gte: start, lte: end } },
        { dueAt:         { gte: start, lte: end } },
      ],
    },
    include: {
      taskType: { select: { name: true, color: true } },
      contact:  { select: { id: true, firstName: true, lastName: true } },
      assignee: { select: { name: true } },
    },
    orderBy: [
      { allDay: 'desc' },
      { startDatetime: 'asc' },
      { dueAt: 'asc' },
    ],
  })

  // Contacts with birthday today
  const birthdays = await prisma.contact.findMany({
    where: {
      birthday: { not: null },
    },
    select: { id: true, firstName: true, lastName: true, birthday: true },
  })
  const todayBirthdays = birthdays.filter(c => {
    if (!c.birthday) return false
    const b = new Date(c.birthday)
    return b.getMonth() === now.getMonth() && b.getDate() === now.getDate()
  })

  const allDayItems = tasks.filter(t => t.allDay)
  const timedItems  = tasks.filter(t => !t.allDay)

  const isEmpty = tasks.length === 0 && todayBirthdays.length === 0

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-gold-500" />
          <h3 className="font-semibold text-charcoal-900 text-sm">Today</h3>
        </div>
        <Link
          href="/admin/calendar"
          className="text-xs text-charcoal-400 hover:text-gold-600 transition-colors"
        >
          Full calendar →
        </Link>
      </div>

      <p className="text-xs text-charcoal-400 mb-4">{formatFullDate(now)}</p>

      {isEmpty ? (
        <p className="text-sm text-charcoal-400 text-center py-6">Nothing scheduled for today</p>
      ) : (
        <div className="flex flex-col gap-2">
          {/* Birthdays */}
          {todayBirthdays.map(c => (
            <Link
              key={c.id}
              href={`/admin/contacts/${c.id}`}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm hover:bg-charcoal-50 transition-colors"
              style={{ borderLeft: '3px solid #ec4899' }}
            >
              <span>🎂</span>
              <span className="flex-1 text-charcoal-700 font-medium">
                Birthday: {c.firstName} {c.lastName}
              </span>
            </Link>
          ))}

          {/* All-day tasks */}
          {allDayItems.map(task => (
            <div
              key={task.id}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm"
              style={{ borderLeft: `3px solid ${task.taskType?.color ?? '#6366f1'}` }}
            >
              <span
                className="text-xs font-medium text-charcoal-400 shrink-0 w-14"
              >
                All day
              </span>
              <div className="flex-1 min-w-0">
                <p className={`text-charcoal-800 font-medium truncate ${task.status === 'done' ? 'line-through opacity-50' : ''}`}>
                  {task.title}
                </p>
                {task.contact && (
                  <p className="text-xs text-charcoal-400 truncate mt-0.5">
                    {task.contact.firstName} {task.contact.lastName}
                  </p>
                )}
              </div>
            </div>
          ))}

          {/* Timed tasks */}
          {timedItems.map(task => {
            const startTime = task.startDatetime ?? task.dueAt
            return (
              <div
                key={task.id}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm"
                style={{ borderLeft: `3px solid ${task.taskType?.color ?? '#6366f1'}` }}
              >
                <span className="text-xs text-charcoal-400 shrink-0 w-14">
                  {startTime ? formatTime(startTime) : '—'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className={`text-charcoal-800 font-medium truncate ${task.status === 'done' ? 'line-through opacity-50' : ''}`}>
                    {task.title}
                  </p>
                  {task.contact && (
                    <p className="text-xs text-charcoal-400 truncate mt-0.5">
                      {task.contact.firstName} {task.contact.lastName}
                    </p>
                  )}
                </div>
                {task.taskType && (
                  <span
                    className="text-xs rounded-full px-2 py-0.5 font-medium shrink-0"
                    style={{ backgroundColor: (task.taskType.color ?? '#6366f1') + '22', color: task.taskType.color ?? '#6366f1' }}
                  >
                    {task.taskType.name}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}
