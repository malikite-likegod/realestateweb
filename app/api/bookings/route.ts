// GET /api/bookings — list all booking events (admin)

import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status') // optional filter

  const bookings = await prisma.bookingEvent.findMany({
    where:   status ? { status } : undefined,
    include: { schedule: { select: { agentName: true, meetingTitle: true } } },
    orderBy: { startAt: 'desc' },
    take: 200,
  })

  return NextResponse.json({ data: bookings })
}
