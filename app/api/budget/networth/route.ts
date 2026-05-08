import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type MoneyItem = { label: string; amount: number }

function computeTotals(entry: { assets: string; liabilities: string }) {
  const assets:      MoneyItem[] = JSON.parse(entry.assets)
  const liabilities: MoneyItem[] = JSON.parse(entry.liabilities)
  const totalAssets      = assets.reduce((s, a) => s + a.amount, 0)
  const totalLiabilities = liabilities.reduce((s, l) => s + l.amount, 0)
  return { totalAssets, totalLiabilities, netWorth: totalAssets - totalLiabilities }
}

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const entries = await prisma.netWorthEntry.findMany({ orderBy: { month: 'asc' } })
  return NextResponse.json({ data: entries.map(e => ({ ...e, ...computeTotals(e) })) })
}

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { month, assets, liabilities } = await request.json()

  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: 'month required (YYYY-MM)' }, { status: 400 })
  }
  if (!Array.isArray(assets) || !Array.isArray(liabilities)) {
    return NextResponse.json({ error: 'assets and liabilities must be arrays' }, { status: 400 })
  }

  const entry = await prisma.netWorthEntry.upsert({
    where: { month },
    create: {
      month,
      assets:      JSON.stringify(assets),
      liabilities: JSON.stringify(liabilities),
    },
    update: {
      assets:      JSON.stringify(assets),
      liabilities: JSON.stringify(liabilities),
    },
  })

  return NextResponse.json({ data: { ...entry, ...computeTotals(entry) } })
}
