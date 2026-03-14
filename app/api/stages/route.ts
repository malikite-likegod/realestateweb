import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const createSchema = z.object({
  name:  z.string().min(1),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
})

export async function GET() {
  const stages = await prisma.stage.findMany({ orderBy: { order: 'asc' } })
  return NextResponse.json({ data: stages })
}

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body  = await request.json()
    const parsed = createSchema.parse(body)
    const count  = await prisma.stage.count()
    const stage  = await prisma.stage.create({
      data: { name: parsed.name, order: count + 1, color: parsed.color ?? '#6366f1' },
    })
    return NextResponse.json({ data: stage }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.errors }, { status: 400 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
