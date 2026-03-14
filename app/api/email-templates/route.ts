// GET  /api/email-templates — list all active templates
// POST /api/email-templates — create a new template

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const createSchema = z.object({
  name:     z.string().min(1),
  subject:  z.string().min(1),
  body:     z.string().min(1),
  category: z.string().optional(),
})

export async function GET(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const category = searchParams.get('category') ?? undefined

  const templates = await prisma.emailTemplate.findMany({
    where:   { isActive: true, ...(category ? { category } : {}) },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({ data: templates })
}

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body     = await request.json()
    const parsed   = createSchema.parse(body)
    const template = await prisma.emailTemplate.create({ data: parsed })
    return NextResponse.json({ data: template }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.errors }, { status: 400 })
    console.error('[POST /api/email-templates]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
