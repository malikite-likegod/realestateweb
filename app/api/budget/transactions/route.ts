import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function monthBounds(month: string) {
  const [y, m] = month.split('-').map(Number)
  return { start: new Date(y, m - 1, 1), end: new Date(y, m, 0, 23, 59, 59, 999) }
}

const SORT_MAP: Record<string, object> = {
  date_desc:   { date: 'desc' },
  date_asc:    { date: 'asc' },
  amount_desc: { amount: 'desc' },
  amount_asc:  { amount: 'asc' },
}

export async function GET(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const month      = searchParams.get('month')
  const type       = searchParams.get('type')
  const categoryId = searchParams.get('categoryId')
  const payee      = searchParams.get('payee')
  const page       = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const limit      = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') ?? '50')))
  const sort       = searchParams.get('sort') ?? 'date_desc'

  const where: Record<string, unknown> = {}
  if (month) {
    const { start, end } = monthBounds(month)
    where.date = { gte: start, lte: end }
  }
  if (type === 'income' || type === 'expense') where.type = type
  if (categoryId) where.categoryId = categoryId
  if (payee) where.payee = { contains: payee, mode: 'insensitive' }

  const [items, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      orderBy: SORT_MAP[sort] ?? SORT_MAP.date_desc,
      skip: (page - 1) * limit,
      take: limit,
      include: { category: { select: { name: true } } },
    }),
    prisma.transaction.count({ where }),
  ])

  return NextResponse.json({
    data: {
      items: items.map(t => ({
        id:           t.id,
        type:         t.type,
        categoryId:   t.categoryId,
        categoryName: t.category?.name ?? null,
        amount:       t.amount,
        date:         t.date,
        payee:        t.payee,
        notes:        t.notes,
        receiptUrl:   t.receiptUrl,
        createdAt:    t.createdAt,
      })),
      total,
      page,
      limit,
    },
  })
}

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { type, categoryId, amount, date, payee, notes, receiptUrl } = await request.json()

  if (!['income', 'expense'].includes(type)) {
    return NextResponse.json({ error: 'type must be income or expense' }, { status: 400 })
  }
  if (typeof amount !== 'number' || amount <= 0) {
    return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 })
  }
  if (!date) {
    return NextResponse.json({ error: 'date is required' }, { status: 400 })
  }
  if (type === 'expense' && !categoryId) {
    return NextResponse.json({ error: 'categoryId is required for expense transactions' }, { status: 400 })
  }

  const transaction = await prisma.transaction.create({
    data: {
      type,
      categoryId: type === 'income' ? null : categoryId,
      amount,
      date: new Date(date),
      payee:      payee ?? null,
      notes:      notes ?? null,
      receiptUrl: receiptUrl ?? null,
    },
    include: { category: { select: { name: true } } },
  })

  return NextResponse.json({
    data: { ...transaction, categoryName: transaction.category?.name ?? null },
  }, { status: 201 })
}
