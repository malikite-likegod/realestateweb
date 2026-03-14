import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { syncIdxListings } from '@/services/idx/sync'

export async function POST(request: Request) {
  // Allow internal cron calls with a secret header, or authenticated admin
  const cronSecret = request.headers.get('x-cron-secret')
  if (cronSecret !== process.env.IDX_SYNC_SECRET) {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await syncIdxListings()
    return NextResponse.json({ success: true, result })
  } catch (error) {
    return NextResponse.json({ error: 'Sync failed', details: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}

export async function GET() {
  const { prisma } = await import('@/lib/prisma')
  const lastSync = await prisma.idxUpdate.findFirst({ orderBy: { syncedAt: 'desc' } })
  const count = await prisma.idxProperty.count({ where: { status: 'active' } })
  return NextResponse.json({ lastSync, activeListings: count })
}
