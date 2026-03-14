// GET /api/deals/[id]/stage-history — fetch the full stage history for a deal

import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

interface Props { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Props) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const history = await prisma.dealStageHistory.findMany({
    where:   { dealId: id },
    orderBy: { enteredAt: 'asc' },
    include: {
      stage:   { select: { id: true, name: true, color: true } },
      movedBy: { select: { name: true } },
    },
  })
  return NextResponse.json({ data: history })
}
