import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const VALID_GOAL_TYPES = new Set(['monthly_limit', 'savings_target'])
const HEX_RE = /^#[0-9A-Fa-f]{6}$/

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { groupId, name, color, goalType, goalAmount, goalTargetDate } = await request.json()

  if (!groupId || !name?.trim()) {
    return NextResponse.json({ error: 'groupId and name are required' }, { status: 400 })
  }
  if (color && !HEX_RE.test(color)) {
    return NextResponse.json({ error: 'color must be a valid hex color (#RRGGBB)' }, { status: 400 })
  }
  if (goalType != null && !VALID_GOAL_TYPES.has(goalType)) {
    return NextResponse.json({ error: 'goalType must be monthly_limit, savings_target, or null' }, { status: 400 })
  }

  const maxOrder = await prisma.budgetCategory.aggregate({
    where: { groupId },
    _max: { order: true },
  })
  const order = (maxOrder._max.order ?? -1) + 1

  const category = await prisma.budgetCategory.create({
    data: {
      groupId,
      name: name.trim(),
      color: color ?? '#6366f1',
      order,
      goalType: goalType ?? null,
      goalAmount: goalAmount ?? null,
      goalTargetDate: goalTargetDate ? new Date(goalTargetDate) : null,
    },
  })
  return NextResponse.json({ data: category }, { status: 201 })
}
