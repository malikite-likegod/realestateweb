import { NextResponse } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { signContactJwt } from '@/lib/jwt'
import { logAuditEvent, extractIp, extractUserAgent } from '@/lib/audit'

const schema = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
})

export async function POST(request: Request) {
  const ip = extractIp(request)
  const userAgent = extractUserAgent(request)

  try {
    const body = await request.json()
    const { email, password } = schema.parse(body)

    const contact = await prisma.contact.findUnique({
      where:  { email },
      select: { id: true, firstName: true, passwordHash: true, accountStatus: true, email: true },
    })

    // Generic client error prevents account enumeration — audit log records specifics
    const INVALID = NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })

    if (!contact) {
      void logAuditEvent({ event: 'portal_login_failure', actor: email, ip, userAgent, meta: { reason: 'unknown_email' } })
      return INVALID
    }

    if (!contact.passwordHash) {
      void logAuditEvent({ event: 'portal_login_failure', actor: email, contactId: contact.id, ip, userAgent, meta: { reason: 'no_password_set' } })
      return INVALID
    }

    if (contact.accountStatus !== 'active') {
      void logAuditEvent({ event: 'portal_login_failure', actor: email, contactId: contact.id, ip, userAgent, meta: { reason: 'account_inactive' } })
      return INVALID
    }

    const valid = await bcrypt.compare(password, contact.passwordHash)
    if (!valid) {
      void logAuditEvent({ event: 'portal_login_failure', actor: email, contactId: contact.id, ip, userAgent, meta: { reason: 'invalid_password' } })
      return INVALID
    }

    void logAuditEvent({ event: 'portal_login_success', actor: email, contactId: contact.id, ip, userAgent })

    const token = await signContactJwt(contact.id, contact.email ?? '')
    const response = NextResponse.json({ firstName: contact.firstName })
    response.cookies.set('contact_token', token, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge:   60 * 60 * 24 * 7,
      path:     '/',
    })
    return response
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
