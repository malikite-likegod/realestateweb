import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { verifyPendingJwt, signJwt } from '@/lib/jwt'
import { isSecureContext } from '@/lib/auth'
import { logAuditEvent, extractIp, extractUserAgent } from '@/lib/audit'

export async function POST(request: Request) {
  const ip = extractIp(request)
  const userAgent = extractUserAgent(request)

  const body = await request.json().catch(() => ({}))
  const { code } = body ?? {}

  // Format check — no audit event for bad-format requests (Zod-style 400)
  if (!code || !/^\d{6}$/.test(String(code))) {
    return NextResponse.json({ error: 'Invalid code format' }, { status: 400 })
  }

  const cookieStore = await cookies()
  const pendingToken = cookieStore.get('pending_token')?.value
  if (!pendingToken) {
    return NextResponse.json({ error: 'Session expired, please log in again' }, { status: 401 })
  }

  const payload = await verifyPendingJwt(pendingToken)
  if (!payload) {
    return NextResponse.json({ error: 'Session expired, please log in again' }, { status: 401 })
  }

  // Include email so all branches can populate actor
  const user = await prisma.user.findUnique({
    where: { id: payload.sub as string },
    select: { id: true, email: true, pendingOtpHash: true, pendingOtpExpiry: true, pendingOtpAttempts: true },
  })
  if (!user) {
    return NextResponse.json({ error: 'Session expired, please log in again' }, { status: 401 })
  }

  // OTP expired
  if (!user.pendingOtpExpiry || user.pendingOtpExpiry < new Date()) {
    await prisma.user.update({
      where: { id: user.id },
      data: { pendingOtpHash: null, pendingOtpExpiry: null, pendingOtpAttempts: 0 },
    })
    void logAuditEvent({ event: '2fa_failure', actor: user.email, userId: user.id, ip, userAgent, meta: { reason: 'otp_expired' } })
    const res = NextResponse.json({ error: 'Code expired, please log in again' }, { status: 401 })
    res.cookies.set('pending_token', '', { maxAge: 0, path: '/' })
    return res
  }

  // Pre-check lockout (already at ≥5 attempts from prior requests)
  if (user.pendingOtpAttempts >= 5) {
    await prisma.user.update({
      where: { id: user.id },
      data: { pendingOtpHash: null, pendingOtpExpiry: null, pendingOtpAttempts: 0 },
    })
    void logAuditEvent({ event: '2fa_failure', actor: user.email, userId: user.id, ip, userAgent, meta: { reason: 'too_many_attempts' } })
    const res = NextResponse.json({ error: 'Too many attempts, please log in again' }, { status: 401 })
    res.cookies.set('pending_token', '', { maxAge: 0, path: '/' })
    return res
  }

  const valid = user.pendingOtpHash ? await bcrypt.compare(String(code), user.pendingOtpHash) : false

  if (!valid) {
    const newAttempts = user.pendingOtpAttempts + 1
    if (newAttempts >= 5) {
      // 5th failure — lock out immediately
      await prisma.user.update({
        where: { id: user.id },
        data: { pendingOtpHash: null, pendingOtpExpiry: null, pendingOtpAttempts: 0 },
      })
      void logAuditEvent({ event: '2fa_failure', actor: user.email, userId: user.id, ip, userAgent, meta: { reason: 'too_many_attempts' } })
      const res = NextResponse.json({ error: 'Too many attempts, please log in again' }, { status: 401 })
      res.cookies.set('pending_token', '', { maxAge: 0, path: '/' })
      return res
    }
    await prisma.user.update({ where: { id: user.id }, data: { pendingOtpAttempts: newAttempts } })
    void logAuditEvent({ event: '2fa_failure', actor: user.email, userId: user.id, ip, userAgent, meta: { reason: 'invalid_code' } })
    return NextResponse.json({ error: 'Invalid code' }, { status: 401 })
  }

  // Success — 2fa_success serves as the login-success signal for 2FA users
  await prisma.user.update({
    where: { id: user.id },
    data: { pendingOtpHash: null, pendingOtpExpiry: null, pendingOtpAttempts: 0 },
  })
  void logAuditEvent({ event: '2fa_success', actor: user.email, userId: user.id, ip, userAgent })

  const token = await signJwt({ sub: user.id })
  const response = NextResponse.json({ ok: true })
  response.cookies.set('auth_token', token, {
    httpOnly: true,
    secure: isSecureContext,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  })
  response.cookies.set('pending_token', '', { maxAge: 0, path: '/' })
  return response
}
