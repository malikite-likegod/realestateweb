import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logAuditEvent, extractIp } from '@/lib/audit'

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const record = await prisma.blockedIp.findUnique({ where: { id } })
  if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.blockedIp.delete({ where: { id } })

  await logAuditEvent({
    event:  'ip_blocklist_remove',
    userId: session.id,
    ip:     extractIp(request),
    meta:   { ip: record.ip },
  })

  return NextResponse.json({ success: true })
}
