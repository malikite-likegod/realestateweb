import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const patchSchema = z.object({
  name:  z.string().min(1).max(50).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
})

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    const body   = await request.json()
    const data   = patchSchema.parse(body)
    const type   = await prisma.taskType.update({ where: { id }, data })
    return NextResponse.json({ data: type })
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.errors }, { status: 400 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const type = await prisma.taskType.findUnique({ where: { id } })
  if (type?.isDefault) return NextResponse.json({ error: 'Cannot delete a default task type' }, { status: 400 })
  await prisma.taskType.delete({ where: { id } })
  return NextResponse.json({ message: 'Deleted' })
}
