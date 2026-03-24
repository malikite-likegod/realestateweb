import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export const dynamic = 'force-dynamic'

const DEAL_STAGES = [
  { name: 'New Lead',        order: 1, color: '#6366f1' },
  { name: 'Contacted',       order: 2, color: '#8b5cf6' },
  { name: 'Showing',         order: 3, color: '#f59e0b' },
  { name: 'Offer Made',      order: 4, color: '#ef4444' },
  { name: 'Under Contract',  order: 5, color: '#10b981' },
  { name: 'Closed',          order: 6, color: '#059669' },
]

async function isAlreadySetup(): Promise<boolean> {
  try {
    const count = await prisma.user.count({ where: { role: 'admin' } })
    return count > 0
  } catch {
    return false
  }
}

export async function GET() {
  return NextResponse.json({ configured: await isAlreadySetup() })
}

export async function POST(req: Request) {
  if (await isAlreadySetup()) {
    return NextResponse.json({ error: 'Application is already configured.' }, { status: 403 })
  }

  let body: Record<string, string>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const { adminName, adminEmail, adminPassword } = body
  if (!adminName || !adminEmail || !adminPassword) {
    return NextResponse.json({ error: 'Name, email, and password are required.' }, { status: 400 })
  }
  if (adminPassword.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 })
  }

  try {
    const passwordHash = await bcrypt.hash(adminPassword, 12)
    await prisma.user.create({
      data: { name: adminName, email: adminEmail, passwordHash, role: 'admin' },
    })

    // Seed deal stages if not already present
    const stageCount = await prisma.stage.count()
    if (stageCount === 0) {
      await prisma.stage.createMany({ data: DEAL_STAGES })
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: 'Failed to create admin account.', details: msg }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
