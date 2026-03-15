// GET /api/contacts/[id]/campaigns — list all campaign enrollments for a contact

import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

interface Props { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Props) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const enrollments = await prisma.campaignEnrollment.findMany({
    where:   { contactId: id },
    orderBy: { enrolledAt: 'desc' },
    include: {
      sequence: {
        select: {
          id:      true,
          name:    true,
          trigger: true,
          steps:   { select: { id: true } },
        },
      },
    },
  })

  const data = enrollments.map(e => ({
    ...e,
    sequence: {
      ...e.sequence,
      totalSteps: e.sequence.steps.length,
      steps:      undefined,
    },
  }))

  return NextResponse.json({ data })
}
