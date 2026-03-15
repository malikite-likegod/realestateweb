import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const tags = await prisma.tag.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { contacts: true } } },
  })
  return NextResponse.json({ data: tags })
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, color } = z.object({
      name:  z.string().min(1).max(50),
      color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#6366f1'),
    }).parse(body)

    const tag = await prisma.tag.create({ data: { name: name.trim(), color } })
    return NextResponse.json({ data: tag }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.errors }, { status: 400 })
    if ((error as { code?: string }).code === 'P2002') {
      return NextResponse.json({ error: 'A tag with that name already exists' }, { status: 409 })
    }
    console.error('[POST /api/tags]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
