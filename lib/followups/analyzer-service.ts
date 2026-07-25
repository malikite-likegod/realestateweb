/**
 * Follow-Up Analyzer Service
 *
 * The piece the rest of the automation system doesn't cover: a recurring
 * "how long since we touched this contact, given their segment?" scan.
 * AutomationRule (lib/automation/rule-service.ts) reacts to one-time events;
 * AutomationSequence (lib/automation/campaign-service.ts) drips over a fixed
 * schedule. Neither asks "is this contact currently overdue, forever, on a
 * repeating per-segment cadence" — that's what this module does.
 *
 * Two entry points:
 *   previewOverdueContacts() — read-only, powers the dashboard/admin table
 *   analyzeFollowUps()       — creates Task rows for overdue contacts, meant
 *                              to be run daily via /api/followups/analyze
 */

import { prisma } from '@/lib/prisma'
import type { FollowUpRule } from '@prisma/client'
import { resolveSegment, type FollowUpSegment } from './segment-service'
import { calculateEngagementHeat } from './engagement-score'

const DAY_MS = 24 * 60 * 60 * 1000
const ANNIVERSARY_WINDOW_DAYS = 7

type ContactForAnalysis = {
  id: string
  firstName: string
  lastName: string
  email: string | null
  phone: string | null
  status: string
  classification: string
  emailOptOut: boolean
  smsOptOut: boolean
  preferredChannel: string | null
  notes: string | null
  createdAt: Date
  tags: { tag: { name: string } }[]
}

type OverdueEntry = {
  contact: ContactForAnalysis
  segment: FollowUpSegment
  rule: FollowUpRule
  daysSince: number
  hasOpenFollowUpTask: boolean
}

// ─── Shared candidate computation ────────────────────────────────────────────

async function computeOverdueEntries(now: Date): Promise<OverdueEntry[]> {
  const rules = await prisma.followUpRule.findMany({ where: { isActive: true } })
  const ruleMap = new Map(rules.map(r => [r.segment, r]))
  if (ruleMap.size === 0) return []

  const contacts: ContactForAnalysis[] = await prisma.contact.findMany({
    select: {
      id: true, firstName: true, lastName: true, email: true, phone: true,
      status: true, classification: true, emailOptOut: true, smsOptOut: true,
      preferredChannel: true, notes: true, createdAt: true,
      tags: { select: { tag: { select: { name: true } } } },
    },
  })
  if (contacts.length === 0) return []

  const [lastTouchMap, followUpTaskTypeId] = await Promise.all([
    getLastTouchMap(contacts.map(c => c.id)),
    getFollowUpTaskTypeId(),
  ])

  const openFollowUps = followUpTaskTypeId
    ? await prisma.task.findMany({
        where: { taskTypeId: followUpTaskTypeId, status: { in: ['todo', 'in_progress'] }, contactId: { not: null } },
        select: { contactId: true },
      })
    : []
  const openFollowUpSet = new Set(openFollowUps.map(t => t.contactId as string))

  const entries: OverdueEntry[] = []
  for (const contact of contacts) {
    const tagNames = contact.tags.map(t => t.tag.name)
    const segment  = resolveSegment(contact, tagNames)
    const rule     = ruleMap.get(segment)
    if (!rule) continue

    const lastTouch = lastTouchMap.get(contact.id) ?? contact.createdAt
    const daysSince = (now.getTime() - lastTouch.getTime()) / DAY_MS
    if (daysSince < rule.intervalDays) continue

    entries.push({ contact, segment, rule, daysSince, hasOpenFollowUpTask: openFollowUpSet.has(contact.id) })
  }
  return entries
}

/**
 * Batch-fetch the most recent touch timestamp per contact across every
 * interaction source (Activity, calls, SMS, email, notes, completed tasks).
 * Uses groupBy/_max instead of per-contact queries to stay O(1) round-trips
 * regardless of contact-list size.
 */
async function getLastTouchMap(contactIds: string[]): Promise<Map<string, Date>> {
  const map = new Map<string, Date>()
  if (contactIds.length === 0) return map

  const merge = (rows: { contactId: string | null; touchedAt: Date | null }[]) => {
    for (const r of rows) {
      if (!r.contactId || !r.touchedAt) continue
      const existing = map.get(r.contactId)
      if (!existing || r.touchedAt > existing) map.set(r.contactId, r.touchedAt)
    }
  }

  const [activities, calls, sms, emails, notes, tasks] = await Promise.all([
    prisma.activity.groupBy({ by: ['contactId'], where: { contactId: { in: contactIds } }, _max: { occurredAt: true } }),
    prisma.callLog.groupBy({ by: ['contactId'], where: { contactId: { in: contactIds } }, _max: { occurredAt: true } }),
    prisma.smsMessage.groupBy({ by: ['contactId'], where: { contactId: { in: contactIds } }, _max: { sentAt: true } }),
    prisma.emailMessage.groupBy({ by: ['contactId'], where: { contactId: { in: contactIds } }, _max: { sentAt: true } }),
    prisma.note.groupBy({ by: ['contactId'], where: { contactId: { in: contactIds } }, _max: { createdAt: true } }),
    prisma.task.groupBy({ by: ['contactId'], where: { contactId: { in: contactIds }, status: 'done' }, _max: { completedAt: true } }),
  ])

  merge(activities.map(a => ({ contactId: a.contactId, touchedAt: a._max.occurredAt })))
  merge(calls.map(c => ({ contactId: c.contactId, touchedAt: c._max.occurredAt })))
  merge(sms.map(s => ({ contactId: s.contactId, touchedAt: s._max.sentAt })))
  merge(emails.map(e => ({ contactId: e.contactId, touchedAt: e._max.sentAt })))
  merge(notes.map(n => ({ contactId: n.contactId, touchedAt: n._max.createdAt })))
  merge(tasks.map(t => ({ contactId: t.contactId, touchedAt: t._max.completedAt })))

  return map
}

/** Resolves the "Follow-Up" TaskType id, creating it if the seed SQL hasn't run yet. */
async function getFollowUpTaskTypeId(): Promise<string | null> {
  const existing = await prisma.taskType.findUnique({ where: { name: 'Follow-Up' } })
  if (existing) return existing.id
  const created = await prisma.taskType
    .create({ data: { name: 'Follow-Up', color: '#f59e0b', textColor: '#ffffff', isDefault: true } })
    .catch(() => null)
  return created?.id ?? null
}

/** Picks a channel: contact's explicit preference, then the segment's default, then a call — skipping opted-out or unreachable channels. */
function resolveChannel(contact: ContactForAnalysis, ruleChannel: string): 'email' | 'text' | 'call' {
  const candidates = [contact.preferredChannel, ruleChannel, 'call']
  for (const c of candidates) {
    if (c === 'email' && contact.email && !contact.emailOptOut) return 'email'
    if (c === 'text'  && contact.phone && !contact.smsOptOut)   return 'text'
    if (c === 'call'  && contact.phone) return 'call'
  }
  return 'call'
}

function renderTemplate(template: string, contact: { firstName: string; lastName: string }): string {
  return template
    .replace(/\{\{firstName\}\}/g, contact.firstName)
    .replace(/\{\{lastName\}\}/g,  contact.lastName)
}

// ─── Preview (read-only) ─────────────────────────────────────────────────────

export type OverdueContactPreview = {
  contactId:            string
  name:                 string
  segment:              FollowUpSegment
  daysSinceLastTouch:   number
  recommendedChannel:   'email' | 'text' | 'call'
  priority:             string
  hasOpenFollowUpTask:  boolean
}

export async function previewOverdueContacts(): Promise<OverdueContactPreview[]> {
  const entries = await computeOverdueEntries(new Date())
  return entries
    .map(e => ({
      contactId:           e.contact.id,
      name:                `${e.contact.firstName} ${e.contact.lastName}`.trim(),
      segment:             e.segment,
      daysSinceLastTouch:  Math.floor(e.daysSince),
      recommendedChannel:  resolveChannel(e.contact, e.rule.preferredChannel),
      priority:            e.rule.priority,
      hasOpenFollowUpTask: e.hasOpenFollowUpTask,
    }))
    .sort((a, b) => b.daysSinceLastTouch - a.daysSinceLastTouch)
}

// ─── Analyze + create tasks ──────────────────────────────────────────────────

export type AnalyzeResult = {
  analyzed:             number
  overdueBySegment:     Record<FollowUpSegment, number>
  tasksCreated:         number
  anniversariesFlagged: number
  errors:               number
}

export async function analyzeFollowUps(): Promise<AnalyzeResult> {
  const now = new Date()
  const [entries, analyzed, followUpTaskTypeId] = await Promise.all([
    computeOverdueEntries(now),
    prisma.contact.count(),
    getFollowUpTaskTypeId(),
  ])

  const overdueBySegment: Record<FollowUpSegment, number> = { hot: 0, warm: 0, cool: 0, past_client: 0, soi: 0 }
  let tasksCreated = 0
  let errors = 0

  for (const entry of entries) {
    overdueBySegment[entry.segment]++
    if (entry.hasOpenFollowUpTask) continue // dedupe/fatigue guard — don't pile on a repeat task

    try {
      const { contact, rule, daysSince, segment } = entry
      const engagementHeat = await calculateEngagementHeat(contact.id)

      let priority = rule.priority
      if (engagementHeat >= 70 || daysSince >= rule.intervalDays * 2) {
        priority = priority === 'low' ? 'normal' : 'high'
      }

      const channel = resolveChannel(contact, rule.preferredChannel)
      const title   = renderTemplate(rule.taskTitleTemplate, contact)
      const description = [
        `Segment: ${segment}`,
        `Last touch: ${Math.floor(daysSince)} days ago`,
        `Recommended channel: ${channel}`,
        contact.notes ? `Notes: ${contact.notes}` : null,
      ].filter(Boolean).join(' · ')

      await prisma.task.create({
        data: {
          title, description, status: 'todo', priority,
          taskTypeId: followUpTaskTypeId,
          contactId:  contact.id,
          dueAt:      now,
        },
      })
      tasksCreated++
    } catch (err) {
      errors++
      console.error('[analyzeFollowUps] failed for contact', entry.contact.id, err)
    }
  }

  const anniversariesFlagged = await checkHomeAnniversaries(now, followUpTaskTypeId).catch(err => {
    console.error('[analyzeFollowUps] anniversary check failed', err)
    return 0
  })

  return { analyzed, overdueBySegment, tasksCreated, anniversariesFlagged, errors }
}

/**
 * Flags a one-time "Home Anniversary" task when today falls within
 * ANNIVERSARY_WINDOW_DAYS of the month/day a contact's most recent deal closed.
 * For an ongoing multi-touch anniversary drip, use AutomationSequence with
 * trigger: 'special_event' (lib/automation/campaign-service.ts) instead — this
 * only covers the single reminder this feature promises.
 */
async function checkHomeAnniversaries(now: Date, followUpTaskTypeId: string | null): Promise<number> {
  const participants = await prisma.dealParticipant.findMany({
    where:  { deal: { closedAt: { not: null } } },
    select: { contactId: true, deal: { select: { closedAt: true } } },
  })
  if (participants.length === 0) return 0

  const lastClosedByContact = new Map<string, Date>()
  for (const p of participants) {
    const closedAt = p.deal.closedAt!
    const existing = lastClosedByContact.get(p.contactId)
    if (!existing || closedAt > existing) lastClosedByContact.set(p.contactId, closedAt)
  }

  const yearStart = new Date(now.getFullYear(), 0, 1)
  let flagged = 0

  for (const [contactId, closedAt] of lastClosedByContact) {
    const anniversaryThisYear = new Date(now.getFullYear(), closedAt.getMonth(), closedAt.getDate())
    const diffDays = (anniversaryThisYear.getTime() - now.getTime()) / DAY_MS
    if (diffDays < 0 || diffDays > ANNIVERSARY_WINDOW_DAYS) continue

    const alreadyFlagged = await prisma.task.findFirst({
      where: { contactId, title: { contains: 'Home Anniversary' }, createdAt: { gte: yearStart } },
    })
    if (alreadyFlagged) continue

    const contact = await prisma.contact.findUnique({
      where:  { id: contactId },
      select: { firstName: true, lastName: true },
    })
    if (!contact) continue

    await prisma.task.create({
      data: {
        title:       `Home Anniversary — ${contact.firstName} ${contact.lastName}`,
        description: `Closing anniversary is ${anniversaryThisYear.toDateString()}. A personalized anniversary check-in is one of the highest-value past-client touches — consider a handwritten note, small gift, or home-value update.`,
        status:      'todo',
        priority:    'normal',
        taskTypeId:  followUpTaskTypeId,
        contactId,
        dueAt:       anniversaryThisYear,
      },
    })
    flagged++
  }

  return flagged
}
