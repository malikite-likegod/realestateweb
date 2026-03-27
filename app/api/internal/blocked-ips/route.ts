import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  const secret = request.headers.get('x-internal-secret')
  if (!secret || secret !== process.env.INTERNAL_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const now = new Date()
  const rows = await prisma.blockedIp.findMany({
    where: { expiresAt: { gt: now } },
    select: { ip: true },
  })

  return NextResponse.json({ ips: rows.map(r => r.ip) })
}
