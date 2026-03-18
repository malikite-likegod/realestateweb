import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { verifyPassword, createSession } from '@/lib/auth'
import bcrypt from 'bcryptjs'
import { randomInt } from 'crypto'
import { signPendingJwt } from '@/lib/jwt'
import { sendTransactionalEmail } from '@/lib/communications/email-service'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email, password } = loginSchema.parse(body)

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })

    const valid = await verifyPassword(password, user.passwordHash)
    if (!valid) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })

    // 2FA path: if the user has TOTP enabled, send OTP instead of issuing full session
    if (user.totpEnabled) {
      const otp = String(randomInt(100000, 1000000))
      const otpHash = await bcrypt.hash(otp, 10)
      const expiry = new Date(Date.now() + 10 * 60 * 1000)

      await prisma.user.update({
        where: { id: user.id },
        data: { pendingOtpHash: otpHash, pendingOtpExpiry: expiry, pendingOtpAttempts: 0 },
      })

      try {
        await sendTransactionalEmail({
          to: user.email,
          subject: 'Your login verification code',
          html: `<p>Your verification code is: <strong style="font-size:1.5em;letter-spacing:0.15em">${otp}</strong></p><p>This code expires in 10 minutes.</p><p>If you did not attempt to log in, you can safely ignore this email.</p>`,
        })
      } catch (err) {
        console.error('[login/2fa] SMTP error:', err)
        return NextResponse.json({ error: 'Could not send verification email' }, { status: 500 })
      }

      const pendingToken = await signPendingJwt(user.id)
      const res = NextResponse.json({ requires2fa: true })
      res.cookies.set('pending_token', pendingToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 10,
        path: '/',
      })
      return res
    }

    const token = await createSession(user.id)

    const response = NextResponse.json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    })
    response.cookies.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    })
    return response
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
