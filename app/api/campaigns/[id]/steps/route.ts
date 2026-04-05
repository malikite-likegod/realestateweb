// GET /api/campaigns/[id]/steps — return ordered steps for a campaign

import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

interface Props { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: Props) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const sequence = await prisma.automationSequence.findUnique({
    where:   { id },
    select: {
      steps: {
        orderBy: { order: 'asc' },
        select:  { id: true, order: true, type: true, delayMinutes: true },
      },
    },
  })

  if (!sequence) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ data: sequence.steps })
}
