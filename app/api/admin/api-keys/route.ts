import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import bcrypt from 'bcryptjs'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const keys = await prisma.apiKey.findMany({
    where: { userId: session.id },
    select: { id: true, name: true, prefix: true, lastUsedAt: true, expiresAt: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ keys })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

  const expiresAt = body.expiresAt ? new Date(body.expiresAt) : null
  if (expiresAt && isNaN(expiresAt.getTime())) {
    return NextResponse.json({ error: 'Invalid expiry date' }, { status: 400 })
  }

  // Generate key: "ok_" + 40 hex chars = 43 chars total
  const raw = 'ok_' + randomBytes(20).toString('hex')
  const prefix = raw.slice(0, 8) // "ok_XXXXX" — used for fast lookup
  const keyHash = await bcrypt.hash(raw, 10)

  const apiKey = await prisma.apiKey.create({
    data: { name, keyHash, prefix, userId: session.id, expiresAt },
    select: { id: true, name: true, prefix: true, createdAt: true, expiresAt: true },
  })

  // Return the raw key once — it cannot be recovered after this
  return NextResponse.json({ apiKey, key: raw }, { status: 201 })
}
