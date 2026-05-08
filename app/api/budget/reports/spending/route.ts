import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const from = searchParams.get('from')
  const to   = searchParams.get('to')

  if (!from || !to || !/^\d{4}-\d{2}$/.test(from) || !/^\d{4}-\d{2}$/.test(to)) {
    return NextResponse.json({ error: 'from and to params required (YYYY-MM)' }, { status: 400 })
  }

  const [fy, fm] = from.split('-').map(Number)
  const [ty, tm] = to.split('-').map(Number)
  const startDate = new Date(fy, fm - 1, 1)
  const endDate   = new Date(ty, tm, 0, 23, 59, 59, 999)

  const [expenses, categories] = await Promise.all([
    prisma.transaction.groupBy({
      by: ['categoryId'],
      where: { type: 'expense', categoryId: { not: null }, date: { gte: startDate, lte: endDate } },
      _sum: { amount: true },
      orderBy: { _sum: { amount: 'desc' } },
    }),
    prisma.budgetCategory.findMany({ include: { group: { select: { name: true } } } }),
  ])

  const catMap = new Map(categories.map(c => [c.id, c]))

  const data = expenses.map(e => {
    const cat = catMap.get(e.categoryId!)
    return {
      categoryId:   e.categoryId,
      categoryName: cat?.name ?? 'Unknown',
      groupName:    cat?.group.name ?? 'Unknown',
      color:        cat?.color ?? '#6366f1',
      total:        e._sum.amount ?? 0,
    }
  })

  return NextResponse.json({ data })
}
