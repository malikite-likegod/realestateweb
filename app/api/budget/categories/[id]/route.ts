import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const VALID_GOAL_TYPES = new Set(['monthly_limit', 'savings_target'])
const HEX_RE = /^#[0-9A-Fa-f]{6}$/

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { name, color, order, goalType, goalAmount, goalTargetDate } = await request.json()

  if (color !== undefined && !HEX_RE.test(color)) {
    return NextResponse.json({ error: 'color must be a valid hex color (#RRGGBB)' }, { status: 400 })
  }
  if (goalType !== undefined && goalType !== null && !VALID_GOAL_TYPES.has(goalType)) {
    return NextResponse.json({ error: 'goalType must be monthly_limit, savings_target, or null' }, { status: 400 })
  }

  const category = await prisma.budgetCategory.update({
    where: { id },
    data: {
      ...(name !== undefined && { name: name.trim() }),
      ...(color !== undefined && { color }),
      ...(order !== undefined && { order }),
      ...(goalType !== undefined && { goalType }),
      ...(goalAmount !== undefined && { goalAmount }),
      ...(goalTargetDate !== undefined && {
        goalTargetDate: goalTargetDate ? new Date(goalTargetDate) : null,
      }),
    },
  })
  return NextResponse.json({ data: category })
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  await prisma.budgetCategory.delete({ where: { id } })
  return NextResponse.json({ data: { deleted: true } })
}
