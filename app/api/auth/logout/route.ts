import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { decodeJwt } from 'jose'
import { prisma } from '@/lib/prisma'
import { logAuditEvent, extractIp, extractUserAgent } from '@/lib/audit'

export async function POST(request: Request) {
  const ip = extractIp(request)
  const userAgent = extractUserAgent(request)

  let userId: string | undefined
  let actor: string | undefined

  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('auth_token')?.value
    if (token) {
      const payload = decodeJwt(token)
      const sub = payload.sub
      if (typeof sub === 'string' && sub.length > 0) {
        userId = sub
        const user = await prisma.user.findUnique({ where: { id: sub }, select: { email: true } })
        actor = user?.email ?? undefined
      }
    }
  } catch {
    // Best-effort — decoding failure must never block logout
  }

  void logAuditEvent({ event: 'logout', actor, userId, ip, userAgent })

  const response = NextResponse.json({ message: 'Logged out' })
  response.cookies.set('auth_token', '', { maxAge: 0, path: '/' })
  return response
}
