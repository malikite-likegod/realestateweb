import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function eachMonthInRange(from: string, to: string): string[] {
  const months: string[] = []
  const [fy, fm] = from.split('-').map(Number)
  const [ty, tm] = to.split('-').map(Number)
  let y = fy, m = fm
  while (y < ty || (y === ty && m <= tm)) {
    months.push(`${y}-${String(m).padStart(2, '0')}`)
    m++; if (m > 12) { m = 1; y++ }
  }
  return months
}

export async function GET(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const from = searchParams.get('from')
  const to   = searchParams.get('to')

  if (!from || !to || !/^\d{4}-\d{2}$/.test(from) || !/^\d{4}-\d{2}$/.test(to)) {
    return NextResponse.json({ error: 'from and to params required (YYYY-MM)' }, { status: 400 })
  }

  const months = eachMonthInRange(from, to)

  const [fy, fm] = from.split('-').map(Number)
  const [ty, tm] = to.split('-').map(Number)
  const startDate = new Date(fy, fm - 1, 1)
  const endDate   = new Date(ty, tm, 0, 23, 59, 59, 999)

  const transactions = await prisma.transaction.findMany({
    where: { date: { gte: startDate, lte: endDate } },
    select: { type: true, amount: true, date: true },
  })

  const incomeMap  = new Map<string, number>()
  const expenseMap = new Map<string, number>()
  for (const t of transactions) {
    const key = `${t.date.getFullYear()}-${String(t.date.getMonth() + 1).padStart(2, '0')}`
    if (t.type === 'income') incomeMap.set(key, (incomeMap.get(key) ?? 0) + t.amount)
    else expenseMap.set(key, (expenseMap.get(key) ?? 0) + t.amount)
  }

  const data = months.map(m => {
    const income   = incomeMap.get(m) ?? 0
    const expenses = expenseMap.get(m) ?? 0
    return { month: m, income, expenses, net: income - expenses }
  })

  return NextResponse.json({ data })
}
