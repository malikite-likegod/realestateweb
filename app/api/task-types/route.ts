import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/)

const schema = z.object({
  name:           z.string().min(1).max(50),
  color:          hexColor.optional(),
  textColor:      hexColor.nullable().optional(),
  highlightColor: hexColor.nullable().optional(),
})

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const types = await prisma.taskType.findMany({ orderBy: [{ isDefault: 'desc' }, { name: 'asc' }] })
  return NextResponse.json({ data: types })
}

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json()
    const data = schema.parse(body)
    const type = await prisma.taskType.create({ data })
    return NextResponse.json({ data: type }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.errors }, { status: 400 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
