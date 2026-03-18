import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'

export async function POST(request: Request) {
  let body: { token?: string; email?: string; newPassword?: string; confirmPassword?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { token, email, newPassword, confirmPassword } = body

  if (!token || !email || !newPassword || !confirmPassword) {
    return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
  }
  if (newPassword.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
  }
  if (newPassword !== confirmPassword) {
    return NextResponse.json({ error: 'Passwords do not match' }, { status: 400 })
  }

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    return NextResponse.json({ error: 'Invalid or expired reset link' }, { status: 400 })
  }

  if (!user.resetTokenExpiry || user.resetTokenExpiry < new Date()) {
    await prisma.user.update({
      where: { id: user.id },
      data: { resetTokenHash: null, resetTokenExpiry: null },
    })
    return NextResponse.json({ error: 'Invalid or expired reset link' }, { status: 400 })
  }

  const match = await bcrypt.compare(token, user.resetTokenHash!)
  if (!match) {
    // Deliberately do NOT clear token on mismatch — prevents DoS of valid reset links
    return NextResponse.json({ error: 'Invalid or expired reset link' }, { status: 400 })
  }

  const newHash = await bcrypt.hash(newPassword, 12)
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: newHash,
      passwordChangedAt: new Date(),
      resetTokenHash: null,
      resetTokenExpiry: null,
    },
  })

  return NextResponse.json({ ok: true })
}
