// GET  /api/notifications        — list unread notifications
// POST /api/notifications        — mark notifications as read

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const notifications = await prisma.notification.findMany({
    where:   { isRead: false },
    orderBy: { createdAt: 'desc' },
    take:    50,
    include: {
      contact: { select: { firstName: true, lastName: true } },
    },
  })

  return NextResponse.json({ data: notifications })
}

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const ids: string[] | undefined = body.ids

  if (ids && ids.length > 0) {
    await prisma.notification.updateMany({
      where: { id: { in: ids } },
      data:  { isRead: true },
    })
  } else {
    // Mark all unread as read
    await prisma.notification.updateMany({
      where: { isRead: false },
      data:  { isRead: true },
    })
  }

  return NextResponse.json({ ok: true })
}
