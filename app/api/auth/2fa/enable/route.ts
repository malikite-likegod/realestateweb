import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { randomInt } from 'crypto'
import { sendTransactionalEmail } from '@/lib/communications/email-service'

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const { action } = body ?? {}

  if (action !== 'enable' && action !== 'disable') {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { totpEnabled: true, email: true },
  })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  if (action === 'enable' && user.totpEnabled) {
    return NextResponse.json({ error: '2FA is already enabled' }, { status: 400 })
  }
  if (action === 'disable' && !user.totpEnabled) {
    return NextResponse.json({ error: '2FA is already disabled' }, { status: 400 })
  }

  const otp = String(randomInt(100000, 1000000))
  const otpHash = await bcrypt.hash(otp, 10)
  const expiry = new Date(Date.now() + 10 * 60 * 1000)

  // Send email BEFORE writing to DB — spec says "returns 500 without updating DB" on SMTP failure
  try {
    await sendTransactionalEmail({
      to: user.email,
      subject: `Confirm ${action === 'enable' ? 'enabling' : 'disabling'} two-factor authentication`,
      html: `<p>Your verification code is: <strong style="font-size:1.5em;letter-spacing:0.15em">${otp}</strong></p><p>This code expires in 10 minutes.</p><p>If you did not request this, you can safely ignore this email.</p>`,
    })
  } catch (err) {
    console.error('[2fa/enable] SMTP error:', err)
    return NextResponse.json({ error: 'Could not send verification email' }, { status: 500 })
  }

  // Email succeeded — now persist the OTP
  await prisma.user.update({
    where: { id: session.id },
    data: { pendingOtpHash: otpHash, pendingOtpExpiry: expiry, pendingOtpAttempts: 0 },
  })

  return NextResponse.json({ sent: true })
}
