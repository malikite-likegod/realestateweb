import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

const activitySchema = z.object({
  type:        z.string(),
  subject:     z.string().optional(),
  body:        z.string().optional(),
  outcome:     z.string().optional(),
  durationMin: z.number().optional(),
  contactId:   z.string().optional(),
  dealId:      z.string().optional(),
  occurredAt:  z.string().optional(),
})

export async function GET(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const contactId = searchParams.get('contactId')
  const dealId    = searchParams.get('dealId')
  const page      = parseInt(searchParams.get('page') ?? '1')

  const activities = await prisma.activity.findMany({
    where: {
      ...(contactId && { contactId }),
      ...(dealId    && { dealId }),
    },
    orderBy: { occurredAt: 'desc' },
    skip: (page - 1) * 20,
    take: 20,
    include: {
      contact: { select: { firstName: true, lastName: true } },
      user:    { select: { name: true } },
    },
  })

  return NextResponse.json({ data: activities })
}

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json()
    const data = activitySchema.parse(body)
    const activity = await prisma.activity.create({
      data: {
        ...data,
        userId:     session.id,
        occurredAt: data.occurredAt ? new Date(data.occurredAt) : new Date(),
      },
    })
    return NextResponse.json({ data: activity }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.errors }, { status: 400 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
