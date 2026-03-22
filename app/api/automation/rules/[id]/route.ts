// GET    /api/automation/rules/[id] — fetch single rule
// PATCH  /api/automation/rules/[id] — update rule (toggle active, edit conditions/actions)
// DELETE /api/automation/rules/[id] — delete rule

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { updateRule, deleteRule } from '@/lib/automation/rule-service'

const patchSchema = z.object({
  name:        z.string().min(1).optional(),
  description: z.string().optional(),
  isActive:    z.boolean().optional(),
  trigger:     z.string().optional(),
  conditions:  z.array(z.record(z.unknown())).optional(),
  actions:     z.array(z.record(z.unknown())).optional(),
})

interface Props { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Props) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const rule   = await prisma.automationRule.findUnique({ where: { id } })
  if (!rule) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ data: rule })
}

export async function PATCH(request: Request, { params }: Props) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    const body   = await request.json()
    const parsed = patchSchema.parse(body)
    const rule   = await updateRule(id, parsed as Parameters<typeof updateRule>[1])
    return NextResponse.json({ data: rule })
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.errors }, { status: 400 })
    console.error('[PATCH /api/automation/rules/[id]]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: Props) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  await deleteRule(id)
  return NextResponse.json({ message: 'Deleted' })
}
