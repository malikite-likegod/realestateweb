import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function monthBounds(month: string) {
  const [y, m] = month.split('-').map(Number)
  const start = new Date(y, m - 1, 1)
  const end = new Date(y, m, 0, 23, 59, 59, 999)
  return { start, end }
}

export async function GET(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const month = searchParams.get('month')
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: 'month param required (YYYY-MM)' }, { status: 400 })
  }

  const { start, end } = monthBounds(month)

  const [
    allAllocations,
    allExpenses,
    monthlyExpenses,
    monthlyIncome,
    monthlyAssigned,
    thisMonthAllocations,
    categories,
  ] = await Promise.all([
    // Cumulative assigned per category up to this month (roll-forward numerator)
    prisma.budgetAllocation.groupBy({
      by: ['categoryId'],
      where: { month: { lte: month } },
      _sum: { assigned: true },
    }),
    // Cumulative expenses per category up to end of this month (roll-forward denominator)
    prisma.transaction.groupBy({
      by: ['categoryId'],
      where: { type: 'expense', categoryId: { not: null }, date: { lte: end } },
      _sum: { amount: true },
    }),
    // This month's expenses per category (Activity column)
    prisma.transaction.groupBy({
      by: ['categoryId'],
      where: { type: 'expense', categoryId: { not: null }, date: { gte: start, lte: end } },
      _sum: { amount: true },
    }),
    // Total income logged this month (feeds Ready to Assign)
    prisma.transaction.aggregate({
      where: { type: 'income', date: { gte: start, lte: end } },
      _sum: { amount: true },
    }),
    // Total assigned across all categories this month
    prisma.budgetAllocation.aggregate({
      where: { month },
      _sum: { assigned: true },
    }),
    // This month's allocation records (for assigned value + note per category)
    prisma.budgetAllocation.findMany({ where: { month } }),
    // All categories
    prisma.budgetCategory.findMany({ orderBy: { order: 'asc' } }),
  ])

  const totalIncome = monthlyIncome._sum.amount ?? 0
  const totalAssigned = monthlyAssigned._sum.assigned ?? 0

  const cumAssigned = new Map(allAllocations.map(a => [a.categoryId, a._sum.assigned ?? 0]))
  const cumExpenses = new Map(allExpenses.map(e => [e.categoryId!, e._sum.amount ?? 0]))
  const monthActivity = new Map(monthlyExpenses.map(e => [e.categoryId!, e._sum.amount ?? 0]))
  const thisMonthMap = new Map(thisMonthAllocations.map(a => [a.categoryId, a]))

  const categoryData = categories.map(cat => {
    const alloc = thisMonthMap.get(cat.id)
    return {
      categoryId: cat.id,
      month,
      assigned: alloc?.assigned ?? 0,
      activity: monthActivity.get(cat.id) ?? 0,
      available: (cumAssigned.get(cat.id) ?? 0) - (cumExpenses.get(cat.id) ?? 0),
      note: alloc?.note ?? null,
    }
  })

  return NextResponse.json({
    data: {
      readyToAssign: totalIncome - totalAssigned,
      categories: categoryData,
    },
  })
}

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { categoryId, month, assigned, note } = await request.json()

  if (!categoryId || !month) {
    return NextResponse.json({ error: 'categoryId and month are required' }, { status: 400 })
  }
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: 'month must be YYYY-MM' }, { status: 400 })
  }
  if (typeof assigned !== 'number' || assigned < 0) {
    return NextResponse.json({ error: 'assigned must be a non-negative number' }, { status: 400 })
  }

  const allocation = await prisma.budgetAllocation.upsert({
    where: { categoryId_month: { categoryId, month } },
    create: { categoryId, month, assigned, note: note ?? null },
    update: { assigned, note: note ?? null },
  })

  const { start, end } = monthBounds(month)
  const [cumA, cumE, monthE] = await Promise.all([
    prisma.budgetAllocation.aggregate({
      where: { categoryId, month: { lte: month } },
      _sum: { assigned: true },
    }),
    prisma.transaction.aggregate({
      where: { type: 'expense', categoryId, date: { lte: end } },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { type: 'expense', categoryId, date: { gte: start, lte: end } },
      _sum: { amount: true },
    }),
  ])

  return NextResponse.json({
    data: {
      ...allocation,
      activity: monthE._sum.amount ?? 0,
      available: (cumA._sum.assigned ?? 0) - (cumE._sum.amount ?? 0),
    },
  })
}
