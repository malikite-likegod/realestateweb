import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const groups = await prisma.budgetGroup.findMany({
    orderBy: { order: 'asc' },
    include: { categories: { orderBy: { order: 'asc' } } },
  })
  return NextResponse.json({ data: groups })
}

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { name } = body
  if (!name?.trim()) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  }

  const maxOrder = await prisma.budgetGroup.aggregate({ _max: { order: true } })
  const order = (maxOrder._max.order ?? -1) + 1

  const group = await prisma.budgetGroup.create({
    data: { name: name.trim(), order },
    include: { categories: true },
  })
  return NextResponse.json({ data: group }, { status: 201 })
}
