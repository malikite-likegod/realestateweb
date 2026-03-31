import crypto from 'crypto'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { getPendingContactId } from '@/lib/auth'
import { signContactJwt } from '@/lib/jwt'

const schema = z.object({
  code:     z.string().length(6),
  password: z.string().min(8),
})

const sha256 = (v: string) => crypto.createHash('sha256').update(v).digest('hex')

export async function POST(request: Request) {
  const contactId = await getPendingContactId()
  if (!contactId) {
    return NextResponse.json({ error: 'Session expired — please start again' }, { status: 401 })
  }

  try {
    const { code, password } = schema.parse(await request.json())

    const contact = await prisma.contact.findUnique({
      where:  { id: contactId },
      select: { email: true, firstName: true, phoneOtpCode: true, phoneOtpExpiresAt: true, phoneOtpAttempts: true },
    })
    if (!contact) return NextResponse.json({ error: 'Contact not found' }, { status: 404 })

    if ((contact.phoneOtpAttempts ?? 0) >= 5) {
      return NextResponse.json({ error: 'Too many attempts — please request a new code' }, { status: 429 })
    }

    if (!contact.phoneOtpExpiresAt || contact.phoneOtpExpiresAt < new Date()) {
      return NextResponse.json({ error: 'Code expired — please request a new one' }, { status: 400 })
    }

    if (sha256(code) !== (contact.phoneOtpCode ?? '')) {
      await prisma.contact.update({
        where: { id: contactId },
        data:  { phoneOtpAttempts: { increment: 1 } },
      })
      return NextResponse.json({ error: 'Invalid code' }, { status: 400 })
    }

    const passwordHash = await bcrypt.hash(password, 12)

    await prisma.contact.update({
      where: { id: contactId },
      data: {
        passwordHash,
        phoneVerified:         true,
        accountStatus:         'active',
        phoneOtpCode:          null,
        phoneOtpExpiresAt:     null,
        phoneOtpAttempts:      0,
        phoneSessionTokenHash: null,
      },
    })

    const token = await signContactJwt(contactId, contact.email ?? '')
    const response = NextResponse.json({ ok: true, firstName: contact.firstName })
    response.cookies.set('contact_pending_token', '', { maxAge: 0, path: '/' })
    response.cookies.set('contact_token', token, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge:   60 * 60 * 24 * 7,
      path:     '/',
    })
    return response
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.errors }, { status: 400 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
