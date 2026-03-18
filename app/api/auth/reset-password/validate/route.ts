import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'

// Dummy hash used to equalise timing when no user is found (prevents timing oracle)
const DUMMY_HASH = '$2b$10$dummyhashfortimingequalisation00'

export async function POST(request: Request) {
  let body: { token?: string; email?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { token, email } = body
  if (!token || !email) {
    return NextResponse.json({ error: 'token and email are required' }, { status: 400 })
  }

  const user = await prisma.user.findUnique({ where: { email } })

  if (!user) {
    // Dummy compare to equalise response time — prevents user enumeration via timing
    await bcrypt.compare(token, DUMMY_HASH)
    return NextResponse.json({ valid: false })
  }

  if (!user.resetTokenExpiry || user.resetTokenExpiry < new Date()) {
    await prisma.user.update({
      where: { id: user.id },
      data: { resetTokenHash: null, resetTokenExpiry: null },
    })
    return NextResponse.json({ valid: false })
  }

  const match = await bcrypt.compare(token, user.resetTokenHash!)
  // Do NOT clear fields on mismatch — this endpoint is read-only
  return NextResponse.json({ valid: match })
}
