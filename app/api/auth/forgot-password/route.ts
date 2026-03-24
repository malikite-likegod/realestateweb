import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { sendTransactionalEmail } from '@/lib/communications/email-service'
import { logAuditEvent, extractIp, extractUserAgent } from '@/lib/audit'

export async function POST(request: Request) {
  let body: { email?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { email } = body
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Valid email is required' }, { status: 400 })
  }

  const user = await prisma.user.findUnique({ where: { email } })

  // Always return ok — never reveal whether the email is registered
  if (!user) return NextResponse.json({ ok: true })

  const rawToken = randomBytes(32).toString('hex')
  const tokenHash = await bcrypt.hash(rawToken, 10)
  const expiry = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

  await prisma.user.update({
    where: { id: user.id },
    data: { resetTokenHash: tokenHash, resetTokenExpiry: expiry },
  })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const resetUrl = `${appUrl}/admin/login/reset-password?token=${rawToken}&email=${encodeURIComponent(email)}`

  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
      <h2>Password Reset Request</h2>
      <p>You requested a password reset for your admin account.</p>
      <p style="margin:24px 0">
        <a href="${resetUrl}" style="background:#b8860b;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block">
          Reset Password
        </a>
      </p>
      <p style="color:#666;font-size:14px">This link expires in 1 hour.</p>
      <p style="color:#666;font-size:14px">If you didn't request this, you can safely ignore this email.</p>
    </div>
  `

  try {
    await sendTransactionalEmail({ to: email, subject: 'Reset your password', html })
  } catch (err) {
    // Log but do not surface — would confirm email existence to caller
    console.error('[forgot-password] SMTP error:', err)
  }

  void logAuditEvent({
    event: 'password_reset_request',
    actor: email,
    userId: user.id,
    ip: extractIp(request),
    userAgent: extractUserAgent(request),
  })

  return NextResponse.json({ ok: true })
}
