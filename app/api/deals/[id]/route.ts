import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendWebhook } from '@/services/ai/webhooks'

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const deal = await prisma.deal.findUnique({
    where: { id },
    include: { stage: true, participants: { include: { contact: true } }, property: true, tasks: true, activities: { orderBy: { occurredAt: 'desc' } } },
  })
  if (!deal) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ data: deal })
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json()
  const previousDeal = await prisma.deal.findUnique({ where: { id }, select: { stageId: true } })

  const deal = await prisma.deal.update({
    where: { id },
    data: { ...body, expectedClose: body.expectedClose ? new Date(body.expectedClose) : undefined },
    include: { stage: true },
  })

  // Webhook on stage change
  if (previousDeal && body.stageId && previousDeal.stageId !== body.stageId) {
    await sendWebhook('deal_stage_changed', { dealId: id, fromStage: previousDeal.stageId, toStage: body.stageId })
  }

  return NextResponse.json({ data: deal })
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await prisma.deal.delete({ where: { id } })
  return NextResponse.json({ message: 'Deleted' })
}
