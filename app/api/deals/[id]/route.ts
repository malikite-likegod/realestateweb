import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendWebhook } from '@/services/ai/webhooks'
import { enqueueJob } from '@/lib/automation/job-queue'

const patchSchema = z.object({
  title:         z.string().min(1).optional(),
  value:         z.number().optional().nullable(),
  stageId:       z.string().optional(),
  assigneeId:    z.string().optional().nullable(),
  probability:   z.number().int().min(0).max(100).optional(),
  expectedClose: z.string().optional().nullable(),
  notes:         z.string().optional().nullable(),
  closedAt:      z.string().optional().nullable(),
}).passthrough()

interface Props { params: Promise<{ id: string }> }

export async function GET(_: Request, { params }: Props) {
  const { id } = await params
  const deal = await prisma.deal.findUnique({
    where:   { id },
    include: {
      stage:        true,
      assignee:     { select: { id: true, name: true, avatarUrl: true } },
      participants: { include: { contact: true } },
      property:     true,
      tasks:        { orderBy: { createdAt: 'desc' }, include: { assignee: { select: { name: true } } } },
      activities:   { orderBy: { occurredAt: 'desc' }, include: { user: { select: { name: true } } } },
      stageHistory: { orderBy: { enteredAt: 'asc' }, include: { stage: true, movedBy: { select: { name: true } } } },
    },
  })
  if (!deal) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ data: deal })
}

export async function PATCH(request: Request, { params }: Props) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  try {
    const body   = await request.json()
    const parsed = patchSchema.parse(body)

    const previousDeal = await prisma.deal.findUnique({
      where:  { id },
      select: { stageId: true },
    })

    const deal = await prisma.deal.update({
      where: { id },
      data:  {
        ...parsed,
        expectedClose: parsed.expectedClose ? new Date(parsed.expectedClose) : parsed.expectedClose === null ? null : undefined,
        closedAt:      parsed.closedAt      ? new Date(parsed.closedAt)      : parsed.closedAt      === null ? null : undefined,
      },
      include: { stage: true, assignee: { select: { id: true, name: true } } },
    })

    // Stage change: write history record and fire events
    if (previousDeal && parsed.stageId && previousDeal.stageId !== parsed.stageId) {
      await Promise.all([
        prisma.dealStageHistory.updateMany({
          where: { dealId: id, stageId: previousDeal.stageId, exitedAt: null },
          data:  { exitedAt: new Date() },
        }),
        prisma.dealStageHistory.create({
          data: { dealId: id, stageId: parsed.stageId, movedById: session.id },
        }),
        sendWebhook('deal_stage_changed', { dealId: id, fromStage: previousDeal.stageId, toStage: parsed.stageId }),
      ])

      const firstParticipant = await prisma.dealParticipant.findFirst({ where: { dealId: id } })
      await enqueueJob('evaluate_rules', {
        trigger:   'deal_stage_changed',
        contactId: firstParticipant?.contactId,
        dealId:    id,
        meta:      { fromStage: previousDeal.stageId, toStage: parsed.stageId },
      })
    }

    return NextResponse.json({ data: deal })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 })
    }
    console.error('[PATCH /api/deals/:id]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(_: Request, { params }: Props) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  await prisma.deal.delete({ where: { id } })
  return NextResponse.json({ message: 'Deleted' })
}
