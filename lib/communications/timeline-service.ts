/**
 * Timeline Service
 *
 * Aggregates all communication and CRM activity for a contact into a single
 * chronological feed. Each item is normalised to a TimelineEntry so the UI
 * can render every channel (calls, SMS, email, notes, tasks, activities)
 * from one unified array.
 */

import { prisma } from '@/lib/prisma'

export type TimelineEntryType =
  | 'call'
  | 'sms'
  | 'email'
  | 'note'
  | 'task'
  | 'activity'

export type TimelineEntry = {
  id:          string
  type:        TimelineEntryType
  direction?:  'inbound' | 'outbound'
  subject?:    string | null
  body?:       string | null
  status?:     string | null
  durationSec?: number | null
  userName?:   string | null
  occurredAt:  Date
  meta?:       Record<string, unknown>
}

/**
 * Fetch the unified timeline for a contact.
 * Results are sorted newest-first and optionally paginated.
 */
export async function getContactTimeline(
  contactId: string,
  opts: { limit?: number; before?: Date } = {},
): Promise<TimelineEntry[]> {
  const limit = opts.limit ?? 50

  const [activities, calls, sms, emails, notes, tasks] = await Promise.all([
    // Existing activity log
    prisma.activity.findMany({
      where:   { contactId, ...(opts.before ? { occurredAt: { lt: opts.before } } : {}) },
      orderBy: { occurredAt: 'desc' },
      take:    limit,
      include: { user: { select: { name: true } } },
    }),

    // Call logs
    prisma.callLog.findMany({
      where:   { contactId, ...(opts.before ? { occurredAt: { lt: opts.before } } : {}) },
      orderBy: { occurredAt: 'desc' },
      take:    limit,
      include: { loggedBy: { select: { name: true } } },
    }),

    // SMS messages
    prisma.smsMessage.findMany({
      where:   { contactId, ...(opts.before ? { sentAt: { lt: opts.before } } : {}) },
      orderBy: { sentAt: 'desc' },
      take:    limit,
      include: { sentBy: { select: { name: true } } },
    }),

    // Emails
    prisma.emailMessage.findMany({
      where:   { contactId, ...(opts.before ? { sentAt: { lt: opts.before } } : {}) },
      orderBy: { sentAt: 'desc' },
      take:    limit,
      include: { sentBy: { select: { name: true } }, template: { select: { name: true } } },
    }),

    // Notes
    prisma.note.findMany({
      where:   { contactId, ...(opts.before ? { createdAt: { lt: opts.before } } : {}) },
      orderBy: { createdAt: 'desc' },
      take:    limit,
      include: { user: { select: { name: true } } },
    }),

    // Tasks
    prisma.task.findMany({
      where:   { contactId, ...(opts.before ? { createdAt: { lt: opts.before } } : {}) },
      orderBy: { createdAt: 'desc' },
      take:    limit,
      include: { assignee: { select: { name: true } } },
    }),
  ])

  const entries: TimelineEntry[] = [
    ...activities.map(a => ({
      id:          a.id,
      type:        'activity' as TimelineEntryType,
      subject:     a.subject,
      body:        a.body,
      status:      a.outcome,
      userName:    a.user?.name ?? null,
      occurredAt:  a.occurredAt,
      meta:        { activityType: a.type, durationMin: a.durationMin },
    })),

    ...calls.map(c => ({
      id:          c.id,
      type:        'call' as TimelineEntryType,
      direction:   c.direction as 'inbound' | 'outbound',
      body:        c.notes,
      status:      c.status,
      durationSec: c.durationSec,
      userName:    c.loggedBy?.name ?? null,
      occurredAt:  c.occurredAt,
      meta:        { recordingUrl: c.recordingUrl, transcription: c.transcription },
    })),

    ...sms.map(s => ({
      id:         s.id,
      type:       'sms' as TimelineEntryType,
      direction:  s.direction as 'inbound' | 'outbound',
      body:       s.body,
      status:     s.status,
      userName:   s.sentBy?.name ?? null,
      occurredAt: s.sentAt,
      meta:       { fromNumber: s.fromNumber, toNumber: s.toNumber },
    })),

    ...emails.map(e => ({
      id:         e.id,
      type:       'email' as TimelineEntryType,
      direction:  e.direction as 'inbound' | 'outbound',
      subject:    e.subject,
      body:       e.body,
      status:     e.status,
      userName:   e.sentBy?.name ?? null,
      occurredAt: e.sentAt,
      meta:       {
        openCount:    e.openCount,
        clickCount:   e.clickCount,
        openedAt:     e.openedAt,
        templateName: e.template?.name ?? null,
      },
    })),

    ...notes.map(n => ({
      id:         n.id,
      type:       'note' as TimelineEntryType,
      body:       n.body,
      userName:   n.user?.name ?? null,
      occurredAt: n.createdAt,
    })),

    ...tasks.map(t => ({
      id:         t.id,
      type:       'task' as TimelineEntryType,
      subject:    t.title,
      body:       t.description,
      status:     t.status,
      userName:   t.assignee?.name ?? null,
      occurredAt: t.createdAt,
      meta:       { priority: t.priority, dueAt: t.dueAt, completedAt: t.completedAt },
    })),
  ]

  // Sort newest-first, trim to requested limit
  entries.sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())
  return entries.slice(0, limit)
}
