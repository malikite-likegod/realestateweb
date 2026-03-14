// PATCH  /api/stages/[id] — rename, recolor, or reorder a stage
// DELETE /api/stages/[id] — delete a stage (only if no active deals)

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const patchSchema = z.object({
  name:  z.string().min(1).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  order: z.number().int().min(0).optional(),
})

interface Props { params: Promise<{ id: string }> }

export async function PATCH(request: Request, { params }: Props) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    const parsed = patchSchema.parse(await request.json())
    const stage  = await prisma.stage.update({ where: { id }, data: parsed })
    return NextResponse.json({ data: stage })
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.errors }, { status: 400 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: Props) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const dealCount = await prisma.deal.count({ where: { stageId: id } })
  if (dealCount > 0) {
    return NextResponse.json(
      { error: `Cannot delete stage with ${dealCount} active deal(s). Move or close them first.` },
      { status: 409 },
    )
  }
  await prisma.stage.delete({ where: { id } })
  return NextResponse.json({ message: 'Deleted' })
}
