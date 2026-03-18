import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const { code, action } = body ?? {}

  if (!code || !/^\d{6}$/.test(String(code))) {
    return NextResponse.json({ error: 'Invalid code format' }, { status: 400 })
  }
  if (action !== 'enable' && action !== 'disable') {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { totpEnabled: true, pendingOtpHash: true, pendingOtpExpiry: true, pendingOtpAttempts: true },
  })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  // Re-validate action against current state (could have changed since enable was called)
  if (action === 'enable' && user.totpEnabled) {
    return NextResponse.json({ error: '2FA is already enabled' }, { status: 400 })
  }
  if (action === 'disable' && !user.totpEnabled) {
    return NextResponse.json({ error: '2FA is already disabled' }, { status: 400 })
  }

  // Check OTP expiry
  if (!user.pendingOtpExpiry || user.pendingOtpExpiry < new Date()) {
    await prisma.user.update({
      where: { id: session.id },
      data: { pendingOtpHash: null, pendingOtpExpiry: null, pendingOtpAttempts: 0 },
    })
    return NextResponse.json({ error: 'Code expired, please try again' }, { status: 401 })
  }

  // Pre-check: already locked out from prior attempts
  if (user.pendingOtpAttempts >= 5) {
    await prisma.user.update({
      where: { id: session.id },
      data: { pendingOtpHash: null, pendingOtpExpiry: null, pendingOtpAttempts: 0 },
    })
    return NextResponse.json({ error: 'Too many attempts, please try again' }, { status: 401 })
  }

  const valid = user.pendingOtpHash ? await bcrypt.compare(String(code), user.pendingOtpHash) : false

  if (!valid) {
    const newAttempts = user.pendingOtpAttempts + 1
    if (newAttempts >= 5) {
      await prisma.user.update({
        where: { id: session.id },
        data: { pendingOtpHash: null, pendingOtpExpiry: null, pendingOtpAttempts: 0 },
      })
      return NextResponse.json({ error: 'Too many attempts, please try again' }, { status: 401 })
    }
    await prisma.user.update({ where: { id: session.id }, data: { pendingOtpAttempts: newAttempts } })
    return NextResponse.json({ error: 'Invalid code' }, { status: 401 })
  }

  // Success: toggle totpEnabled and clear pending fields
  const newTotpEnabled = action === 'enable'
  await prisma.user.update({
    where: { id: session.id },
    data: {
      totpEnabled: newTotpEnabled,
      pendingOtpHash: null,
      pendingOtpExpiry: null,
      pendingOtpAttempts: 0,
    },
  })

  return NextResponse.json({ ok: true, totpEnabled: newTotpEnabled })
}
