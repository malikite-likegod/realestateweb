// GET  /api/campaigns — list all drip campaigns (AutomationSequences)
// POST /api/campaigns — create a new campaign with steps

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const stepSchema = z.object({
  order:        z.number().int().min(0),
  type:         z.enum(['send_email', 'send_sms', 'create_task', 'wait', 'update_lead_score', 'transfer_campaign', 'send_portal_invite']),
  config:       z.record(z.unknown()),    // { subject, body, templateId, title, delta, etc. }
  delayMinutes: z.number().int().min(0).default(0),
})

const createSchema = z.object({
  name:        z.string().min(1),
  description: z.string().optional(),
  trigger:     z.enum(['new_lead', 'deal_stage_change', 'showing_scheduled', 'manual', 'special_event']),
  isActive:    z.boolean().default(true),
  steps:       z.array(stepSchema).min(1),
})

export async function GET(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const trigger = searchParams.get('trigger') ?? undefined

  const campaigns = await prisma.automationSequence.findMany({
    where: trigger === 'drip'
      ? { trigger: { not: 'special_event' } }
      : trigger
        ? { trigger }
        : {},
    include: {
      steps:       { orderBy: { order: 'asc' } },
      enrollments: { where: { status: 'active' }, select: { id: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ data: campaigns })
}

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body   = await request.json()
    const parsed = createSchema.parse(body)

    const campaign = await prisma.automationSequence.create({
      data: {
        name:        parsed.name,
        description: parsed.description ?? null,
        trigger:     parsed.trigger,
        isActive:    parsed.isActive,
        steps: {
          create: parsed.steps.map(s => ({
            order:        s.order,
            type:         s.type,
            config:       JSON.stringify(s.config),
            delayMinutes: s.delayMinutes,
          })),
        },
      },
      include: { steps: { orderBy: { order: 'asc' } } },
    })

    await prisma.activity.create({
      data: {
        type:    'campaign',
        subject: `Created campaign: ${campaign.name}`,
        userId:  session.id,
      },
    })

    return NextResponse.json({ data: campaign }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.errors }, { status: 400 })
    console.error('[POST /api/campaigns]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
