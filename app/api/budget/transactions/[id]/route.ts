import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { type, categoryId, amount, date, payee, notes, receiptUrl } = await request.json()

  if (type !== undefined && !['income', 'expense'].includes(type)) {
    return NextResponse.json({ error: 'type must be income or expense' }, { status: 400 })
  }
  if (amount !== undefined && (typeof amount !== 'number' || amount <= 0)) {
    return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 })
  }

  const existing = await prisma.transaction.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const effectiveType = type ?? existing.type
  const effectiveCategoryId = effectiveType === 'income'
    ? null
    : (categoryId !== undefined ? categoryId : existing.categoryId)

  if (effectiveType === 'expense' && !effectiveCategoryId) {
    return NextResponse.json({ error: 'categoryId is required for expense transactions' }, { status: 400 })
  }

  const transaction = await prisma.transaction.update({
    where: { id },
    data: {
      ...(type !== undefined && { type }),
      categoryId: effectiveCategoryId,
      ...(amount !== undefined && { amount }),
      ...(date !== undefined && { date: new Date(date) }),
      ...(payee !== undefined && { payee }),
      ...(notes !== undefined && { notes }),
      ...(receiptUrl !== undefined && { receiptUrl }),
    },
    include: { category: { select: { name: true } } },
  })

  return NextResponse.json({
    data: { ...transaction, categoryName: transaction.category?.name ?? null },
  })
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  await prisma.transaction.delete({ where: { id } })
  return NextResponse.json({ data: { deleted: true } })
}
