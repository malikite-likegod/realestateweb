// GET  /api/automation/rules — list automation rules
// POST /api/automation/rules — create a new rule

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { createRule, getRules } from '@/lib/automation/rule-service'

const conditionSchema = z.object({
  field: z.string(),
  op:    z.enum(['gte', 'lte', 'eq', 'neq', 'contains']),
  value: z.unknown(),
})

const actionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('send_email'),      templateId: z.string(), subject: z.string().optional(), body: z.string().optional() }),
  z.object({ type: z.literal('send_sms'),        body: z.string() }),
  z.object({ type: z.literal('assign_task'),     title: z.string(), description: z.string().optional(), priority: z.string().optional(), assigneeId: z.string().optional() }),
  z.object({ type: z.literal('change_stage'),    stageId: z.string() }),
  z.object({ type: z.literal('enroll_campaign'), sequenceId: z.string() }),
  z.object({ type: z.literal('update_score'),    delta: z.number(), reason: z.string().optional() }),
])

const createSchema = z.object({
  name:        z.string().min(1),
  description: z.string().optional(),
  trigger:     z.enum(['new_lead', 'deal_stage_changed', 'lead_inactive', 'listing_viewed', 'manual']),
  conditions:  z.array(conditionSchema).optional(),
  actions:     z.array(actionSchema).min(1),
})

export async function GET(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const trigger = searchParams.get('trigger') ?? undefined
  const rules   = await getRules(trigger)
  return NextResponse.json({ data: rules })
}

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body   = await request.json()
    const parsed = createSchema.parse(body)
    const rule   = await createRule(parsed as Parameters<typeof createRule>[0])
    return NextResponse.json({ data: rule }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.errors }, { status: 400 })
    console.error('[POST /api/automation/rules]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
