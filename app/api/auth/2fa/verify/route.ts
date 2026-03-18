import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { verifyPendingJwt, signJwt } from '@/lib/jwt'

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const { code } = body ?? {}

  // Validate format: must be exactly 6 numeric digits
  if (!code || !/^\d{6}$/.test(String(code))) {
    return NextResponse.json({ error: 'Invalid code format' }, { status: 400 })
  }

  // Read pending_token cookie
  const cookieStore = await cookies()
  const pendingToken = cookieStore.get('pending_token')?.value
  if (!pendingToken) {
    return NextResponse.json({ error: 'Session expired, please log in again' }, { status: 401 })
  }

  // Verify pending JWT — verifyPendingJwt uses a try/catch that returns null for ALL
  // jose errors including JWTExpired, JWSSignatureVerificationFailed, and JWTMalformed.
  // This means expired tokens, bad signatures, and malformed tokens all return null here,
  // covering spec steps 2 and 3 (lines 54-55) with the same 401 response.
  const payload = await verifyPendingJwt(pendingToken)
  if (!payload) {
    return NextResponse.json({ error: 'Session expired, please log in again' }, { status: 401 })
  }

  // Load user
  const user = await prisma.user.findUnique({
    where: { id: payload.sub as string },
    select: { id: true, pendingOtpHash: true, pendingOtpExpiry: true, pendingOtpAttempts: true },
  })
  if (!user) {
    return NextResponse.json({ error: 'Session expired, please log in again' }, { status: 401 })
  }

  // Check OTP expiry
  if (!user.pendingOtpExpiry || user.pendingOtpExpiry < new Date()) {
    await prisma.user.update({
      where: { id: user.id },
      data: { pendingOtpHash: null, pendingOtpExpiry: null, pendingOtpAttempts: 0 },
    })
    const res = NextResponse.json({ error: 'Code expired, please log in again' }, { status: 401 })
    res.cookies.set('pending_token', '', { maxAge: 0, path: '/' })
    return res
  }

  // Check attempt limit (pre-check: already locked out from prior attempts)
  if (user.pendingOtpAttempts >= 5) {
    await prisma.user.update({
      where: { id: user.id },
      data: { pendingOtpHash: null, pendingOtpExpiry: null, pendingOtpAttempts: 0 },
    })
    const res = NextResponse.json({ error: 'Too many attempts, please log in again' }, { status: 401 })
    res.cookies.set('pending_token', '', { maxAge: 0, path: '/' })
    return res
  }

  // Verify OTP
  const valid = user.pendingOtpHash ? await bcrypt.compare(String(code), user.pendingOtpHash) : false

  if (!valid) {
    const newAttempts = user.pendingOtpAttempts + 1
    if (newAttempts >= 5) {
      // 5th failure: lock out immediately
      await prisma.user.update({
        where: { id: user.id },
        data: { pendingOtpHash: null, pendingOtpExpiry: null, pendingOtpAttempts: 0 },
      })
      const res = NextResponse.json({ error: 'Too many attempts, please log in again' }, { status: 401 })
      res.cookies.set('pending_token', '', { maxAge: 0, path: '/' })
      return res
    }
    await prisma.user.update({ where: { id: user.id }, data: { pendingOtpAttempts: newAttempts } })
    return NextResponse.json({ error: 'Invalid code' }, { status: 401 })
  }

  // Success: clear pending fields, issue full session
  await prisma.user.update({
    where: { id: user.id },
    data: { pendingOtpHash: null, pendingOtpExpiry: null, pendingOtpAttempts: 0 },
  })

  const token = await signJwt({ sub: user.id })
  const response = NextResponse.json({ ok: true })
  response.cookies.set('auth_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  })
  response.cookies.set('pending_token', '', { maxAge: 0, path: '/' })
  return response
}
