import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const createDealSchema = z.object({
  title:         z.string().min(1),
  stageId:       z.string(),
  value:         z.number().optional(),
  probability:   z.number().min(0).max(100).optional(),
  expectedClose: z.string().optional(),
  propertyId:    z.string().optional(),
  assigneeId:    z.string().optional(),
  contactIds:    z.array(z.string()).optional(),
  notes:         z.string().optional(),
})

export async function GET(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const stageId = searchParams.get('stageId')

  const deals = await prisma.deal.findMany({
    where:   stageId ? { stageId } : {},
    orderBy: { createdAt: 'desc' },
    include: {
      stage:        true,
      assignee:     { select: { id: true, name: true, avatarUrl: true } },
      participants: { include: { contact: { select: { firstName: true, lastName: true } } } },
      property:     { select: { title: true, address: true } },
    },
  })

  const stages = await prisma.stage.findMany({ orderBy: { order: 'asc' } })
  const pipeline = stages.map(stage => ({
    stage,
    deals: deals.filter(d => d.stageId === stage.id),
    total: deals.filter(d => d.stageId === stage.id).reduce((sum, d) => sum + (d.value ?? 0), 0),
  }))

  return NextResponse.json({ data: deals, pipeline })
}

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json()
    const { contactIds, ...rest } = createDealSchema.parse(body)

    const deal = await prisma.deal.create({
      data: {
        ...rest,
        expectedClose: rest.expectedClose ? new Date(rest.expectedClose) : null,
        participants: contactIds ? {
          create: contactIds.map(id => ({ contactId: id, role: 'buyer' })),
        } : undefined,
        // Record initial stage entry in history
        stageHistory: {
          create: { stageId: rest.stageId, movedById: session.id },
        },
      },
      include: {
        stage:        true,
        assignee:     { select: { id: true, name: true } },
        participants: { include: { contact: true } },
      },
    })

    return NextResponse.json({ data: deal }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.errors }, { status: 400 })
    console.error('[POST /api/deals]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
