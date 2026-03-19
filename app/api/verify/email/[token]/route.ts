// app/api/verify/email/[token]/route.ts

import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { sendPhoneOtp } from '@/lib/communications/verification-service'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')

  const contact = await prisma.contact.findFirst({
    where:  { emailVerificationTokenHash: tokenHash },
    select: { id: true },
  })

  if (!contact) {
    return NextResponse.redirect(`${appUrl}/verify/email/invalid`)
  }

  // Mark email as verified and clear the token
  await prisma.contact.update({
    where: { id: contact.id },
    data: {
      emailVerified:              true,
      emailVerifiedAt:            new Date(),
      emailVerificationTokenHash: null,
    },
  })

  // Trigger SMS OTP (auto, if phone + Twilio available)
  const { sent, sessionToken } = await sendPhoneOtp(contact.id)

  const successUrl = new URL(`${appUrl}/verify/email/success`)
  successUrl.searchParams.set('phone', String(sent))
  // NOTE: sessionToken is NOT put in the URL (avoids leaking it in browser history / server logs).
  // It is passed as an HttpOnly cookie instead.

  const response = NextResponse.redirect(successUrl.toString())

  if (sent && sessionToken) {
    // 1-hour HttpOnly cookie — the /api/verify/phone route reads it from here
    response.cookies.set('phone_session', sessionToken, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge:   60 * 60, // 1 hour, matches OTP expiry
      path:     '/',
    })
  }

  return response
}
