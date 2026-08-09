import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'

// Dummy hash used to equalise timing when no contact is found (prevents timing oracle)
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

  const contact = await prisma.contact.findUnique({ where: { email } })

  if (!contact || !contact.resetTokenHash) {
    // Dummy compare to equalise response time — prevents user enumeration via timing
    await bcrypt.compare(token, DUMMY_HASH)
    return NextResponse.json({ valid: false })
  }

  if (!contact.resetTokenExpiry || contact.resetTokenExpiry < new Date()) {
    await prisma.contact.update({
      where: { id: contact.id },
      data: { resetTokenHash: null, resetTokenExpiry: null },
    })
    return NextResponse.json({ valid: false })
  }

  const match = await bcrypt.compare(token, contact.resetTokenHash)
  // Do NOT clear fields on mismatch — this endpoint is read-only
  return NextResponse.json({ valid: match })
}
