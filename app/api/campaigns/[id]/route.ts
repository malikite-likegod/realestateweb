// GET    /api/campaigns/[id] — fetch campaign with steps + enrollment stats
// PATCH  /api/campaigns/[id] — update name, description, isActive
// DELETE /api/campaigns/[id] — delete campaign (cancels active enrollments)

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const patchSchema = z.object({
  name:        z.string().min(1).optional(),
  description: z.string().optional(),
  isActive:    z.boolean().optional(),
})

interface Props { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Props) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const campaign = await prisma.automationSequence.findUnique({
    where:   { id },
    include: {
      steps:       { orderBy: { order: 'asc' } },
      enrollments: {
        include: { contact: { select: { id: true, firstName: true, lastName: true } } },
        orderBy: { enrolledAt: 'desc' },
        take:    50,
      },
    },
  })
  if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ data: campaign })
}

export async function PATCH(request: Request, { params }: Props) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    const body   = await request.json()
    const parsed = patchSchema.parse(body)
    const campaign = await prisma.automationSequence.update({
      where: { id },
      data:  parsed,
      include: { steps: { orderBy: { order: 'asc' } } },
    })
    return NextResponse.json({ data: campaign })
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.errors }, { status: 400 })
    console.error('[PATCH /api/campaigns/[id]]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: Props) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  // Cancel all active enrollments before deleting
  await prisma.campaignEnrollment.updateMany({
    where: { sequenceId: id, status: 'active' },
    data:  { status: 'cancelled', completedAt: new Date() },
  })
  await prisma.automationSequence.delete({ where: { id } })
  return NextResponse.json({ message: 'Deleted' })
}
