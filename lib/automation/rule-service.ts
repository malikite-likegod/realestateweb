/**
 * Rule Service
 *
 * Event-triggered automation rules (AutomationRule). Unlike drip sequences
 * which run over days/weeks, rules fire immediately when an event occurs.
 *
 * Supported triggers (matches webhook events and internal signals):
 *   new_lead            → fired on POST /api/contacts
 *   deal_stage_changed  → fired on PATCH /api/deals/[id]
 *   lead_inactive       → fired by a scheduled job (contact not updated in N days)
 *   listing_viewed      → fired by behavior tracking
 *   manual              → fired explicitly via the API
 *
 * Condition JSON shape:
 *   { field: 'leadScore' | 'status' | 'source', op: 'gte' | 'lte' | 'eq' | 'neq', value: any }
 *
 * Action JSON shape:
 *   { type: 'send_email' | 'send_sms' | 'assign_task' | 'change_stage' | 'enroll_campaign' | 'update_score', ...params }
 */

import { prisma } from '@/lib/prisma'
import { enqueueJob } from './job-queue'

// ─── Types ───────────────────────────────────────────────────────────────────

export type Condition = {
  field: string
  op:    'gte' | 'lte' | 'eq' | 'neq' | 'contains'
  value: unknown
}

export type Action =
  | { type: 'send_email';       templateId: string; subject?: string; body?: string }
  | { type: 'send_sms';         body: string }
  | { type: 'assign_task';      title: string; description?: string; priority?: string; assigneeId?: string }
  | { type: 'change_stage';     stageId: string }
  | { type: 'enroll_campaign';  sequenceId: string }
  | { type: 'update_score';     delta: number; reason?: string }

// ─── CRUD ────────────────────────────────────────────────────────────────────

export async function createRule(data: {
  name:        string
  description?: string
  trigger:     string
  conditions?: Condition[]
  actions:     Action[]
}) {
  return prisma.automationRule.create({
    data: {
      name:        data.name,
      description: data.description ?? null,
      trigger:     data.trigger,
      conditions:  data.conditions ? JSON.stringify(data.conditions) : null,
      actions:     JSON.stringify(data.actions),
    },
  })
}

export async function getRules(trigger?: string) {
  return prisma.automationRule.findMany({
    where:   { isActive: true, ...(trigger ? { trigger } : {}) },
    orderBy: { createdAt: 'desc' },
  })
}

export async function updateRule(
  id:   string,
  data: Partial<{ name: string; description: string; trigger: string; conditions: Condition[]; actions: Action[]; isActive: boolean }>,
) {
  return prisma.automationRule.update({
    where: { id },
    data:  {
      ...data,
      conditions: data.conditions !== undefined ? JSON.stringify(data.conditions) : undefined,
      actions:    data.actions    !== undefined ? JSON.stringify(data.actions)    : undefined,
    },
  })
}

export async function deleteRule(id: string) {
  return prisma.automationRule.delete({ where: { id } })
}

// ─── Evaluation ──────────────────────────────────────────────────────────────

/**
 * Evaluate all active rules for a given trigger and optionally a contact/deal.
 * Conditions are checked against the contact record; matching rules have their
 * actions executed immediately (fast actions) or queued (slow actions).
 */
export async function evaluateRulesForTrigger(
  trigger:   string,
  contactId?: string,
  dealId?:    string,
  meta?:      Record<string, unknown>,
): Promise<void> {
  const rules = await prisma.automationRule.findMany({
    where: { trigger, isActive: true },
  })
  if (rules.length === 0) return

  const contact = contactId
    ? await prisma.contact.findUnique({ where: { id: contactId } })
    : null

  for (const rule of rules) {
    // Check conditions
    const conditions: Condition[] = rule.conditions ? JSON.parse(rule.conditions) : []
    if (!checkConditions(conditions, contact, meta)) continue

    // Execute actions
    const actions: Action[] = JSON.parse(rule.actions)
    await executeActions(actions, { contactId, dealId, contact })

    // Update run stats
    await prisma.automationRule.update({
      where: { id: rule.id },
      data:  { runCount: { increment: 1 }, lastRunAt: new Date() },
    })
  }
}

// ─── Condition evaluation ────────────────────────────────────────────────────

function checkConditions(
  conditions: Condition[],
  contact:    { leadScore: number; status: string; source: string | null } | null,
  meta?:      Record<string, unknown>,
): boolean {
  if (conditions.length === 0) return true // no conditions = always match
  return conditions.every(c => evaluateCondition(c, contact, meta))
}

function evaluateCondition(
  c:       Condition,
  contact: { leadScore: number; status: string; source: string | null } | null,
  meta?:   Record<string, unknown>,
): boolean {
  // Resolve field value from contact or meta
  const fieldMap: Record<string, unknown> = {
    leadScore: contact?.leadScore,
    status:    contact?.status,
    source:    contact?.source,
    ...meta,
  }
  const actual = fieldMap[c.field]
  if (actual === undefined) return false

  switch (c.op) {
    case 'gte':      return Number(actual) >= Number(c.value)
    case 'lte':      return Number(actual) <= Number(c.value)
    case 'eq':       return actual === c.value
    case 'neq':      return actual !== c.value
    case 'contains': return String(actual).includes(String(c.value))
    default:         return false
  }
}

// ─── Action execution ────────────────────────────────────────────────────────

async function executeActions(
  actions:   Action[],
  ctx:       { contactId?: string; dealId?: string; contact: { email?: string | null; phone?: string | null } | null },
): Promise<void> {
  for (const action of actions) {
    switch (action.type) {
      case 'send_email':
        if (ctx.contactId && ctx.contact?.email) {
          await enqueueJob('send_email_job', {
            contactId:  ctx.contactId,
            toEmail:    ctx.contact.email,
            subject:    action.subject ?? 'Message from your agent',
            body:       action.body    ?? '',
            templateId: action.templateId,
          })
        }
        break

      case 'send_sms':
        if (ctx.contactId && ctx.contact?.phone) {
          await enqueueJob('send_sms_job', {
            contactId: ctx.contactId,
            toNumber:  ctx.contact.phone,
            body:      action.body,
          })
        }
        break

      case 'assign_task':
        if (ctx.contactId) {
          await prisma.task.create({
            data: {
              title:       action.title,
              description: action.description ?? null,
              priority:    action.priority    ?? 'normal',
              contactId:   ctx.contactId,
              dealId:      ctx.dealId ?? null,
              assigneeId:  action.assigneeId  ?? null,
            },
          })
        }
        break

      case 'change_stage':
        if (ctx.dealId) {
          await prisma.deal.update({
            where: { id: ctx.dealId },
            data:  { stageId: action.stageId },
          })
        }
        break

      case 'enroll_campaign':
        if (ctx.contactId) {
          const { enrollContact } = await import('./campaign-service')
          await enrollContact(action.sequenceId, ctx.contactId)
        }
        break

      case 'update_score':
        if (ctx.contactId) {
          const contact = await prisma.contact.findUnique({ where: { id: ctx.contactId } })
          if (contact) {
            const newScore = Math.min(100, Math.max(0, contact.leadScore + action.delta))
            await prisma.contact.update({ where: { id: ctx.contactId }, data: { leadScore: newScore } })
            await prisma.leadScore.create({
              data: {
                contactId: ctx.contactId,
                score:     newScore,
                delta:     action.delta,
                reason:    action.reason ?? 'Automation rule',
              },
            })
          }
        }
        break
    }
  }
}
