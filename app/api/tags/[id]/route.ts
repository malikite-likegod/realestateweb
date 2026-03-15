import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const body = await request.json()
    const data = z.object({
      name:  z.string().min(1).max(50).optional(),
      color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    }).parse(body)

    const tag = await prisma.tag.update({ where: { id }, data })
    return NextResponse.json({ data: tag })
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.errors }, { status: 400 })
    if ((error as { code?: string }).code === 'P2002') {
      return NextResponse.json({ error: 'A tag with that name already exists' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  // ContactTag rows cascade-delete via the schema relation
  await prisma.tag.delete({ where: { id } })
  return NextResponse.json({ message: 'Deleted' })
}
