import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getPendingContactId } from '@/lib/auth'
import { signContactJwt } from '@/lib/jwt'
import { prisma } from '@/lib/prisma'

const schema = z.object({ code: z.string().length(6) })

export async function POST(request: Request) {
  // Identify contact via short-lived pending cookie (not URL param — avoids IDOR)
  const contactId = await getPendingContactId()
  if (!contactId) {
    return NextResponse.json({ error: 'Session expired — please restart account setup' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { code } = schema.parse(body)

    // Load contact's OTP fields directly (contactId comes from the secure pending cookie)
    const contact = await prisma.contact.findUnique({
      where:  { id: contactId },
      select: { phoneOtpCode: true, phoneOtpExpiresAt: true, phoneOtpAttempts: true },
    })
    if (!contact) return NextResponse.json({ error: 'Contact not found' }, { status: 404 })

    // Manual OTP check (bypasses verifyPhoneOtp to use contactId from pending cookie instead of phone_session token)
    const sha256 = (v: string) => {
      const crypto = require('crypto')
      return crypto.createHash('sha256').update(v).digest('hex')
    }

    if ((contact.phoneOtpAttempts ?? 0) >= 5) {
      return NextResponse.json({ error: 'Too many attempts — please contact your agent' }, { status: 429 })
    }

    if (!contact.phoneOtpExpiresAt || contact.phoneOtpExpiresAt < new Date()) {
      return NextResponse.json({ error: 'OTP expired — please resend' }, { status: 400 })
    }

    const codeHash = sha256(code)
    if (codeHash !== (contact.phoneOtpCode ?? '')) {
      await prisma.contact.update({
        where: { id: contactId },
        data:  { phoneOtpAttempts: { increment: 1 } },
      })
      return NextResponse.json({ error: 'Invalid code' }, { status: 400 })
    }

    // Correct code — activate account
    await prisma.contact.update({
      where: { id: contactId },
      data: {
        phoneVerified:         true,
        accountStatus:         'active',
        phoneOtpCode:          null,
        phoneOtpExpiresAt:     null,
        phoneOtpAttempts:      0,
        phoneSessionTokenHash: null,
      },
    })

    // Load contact email for JWT
    const { email, firstName } = await prisma.contact.findUniqueOrThrow({
      where:  { id: contactId },
      select: { email: true, firstName: true },
    })

    const token = await signContactJwt(contactId, email ?? '')
    const response = NextResponse.json({ message: 'Account activated', firstName })

    // Clear pending cookie, issue full session cookie
    response.cookies.set('contact_pending_token', '', { maxAge: 0, path: '/' })
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

export async function DELETE() {
  // Resend OTP
  const contactId = await getPendingContactId()
  if (!contactId) return NextResponse.json({ error: 'Session expired' }, { status: 401 })

  const { sendPhoneOtp } = await import('@/lib/communications/verification-service')
  const result = await sendPhoneOtp(contactId)
  if (!result.sent) return NextResponse.json({ error: 'Could not resend OTP' }, { status: 500 })
  return NextResponse.json({ message: 'OTP resent' })
}
