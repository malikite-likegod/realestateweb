import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  const secret   = request.headers.get('x-internal-secret') ?? ''
  const expected = process.env.INTERNAL_SECRET ?? ''

  let authorized = false
  try {
    authorized = secret.length > 0 &&
      expected.length > 0 &&
      secret.length === expected.length &&
      timingSafeEqual(Buffer.from(secret), Buffer.from(expected))
  } catch {
    authorized = false
  }

  if (!authorized) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const now = new Date()
  const rows = await prisma.blockedIp.findMany({
    where: { expiresAt: { gt: now } },
    select: { ip: true },
  })

  return NextResponse.json({ ips: rows.map(r => r.ip) })
}
