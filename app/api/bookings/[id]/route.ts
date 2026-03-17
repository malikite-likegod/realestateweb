// PATCH /api/bookings/[id] — update booking status or admin notes

import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body   = await request.json()
  const { status, adminNotes } = body

  const booking = await prisma.bookingEvent.update({
    where: { id },
    data: {
      ...(status     !== undefined && { status }),
      ...(adminNotes !== undefined && { adminNotes }),
    },
  })

  return NextResponse.json({ data: booking })
}
