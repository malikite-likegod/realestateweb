import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { syncResoListings } from '@/services/reso/sync'
import { prisma } from '@/lib/prisma'

export async function POST(request: Request) {
  const cronSecret = request.headers.get('x-cron-secret')
  if (cronSecret !== process.env.RESO_SYNC_SECRET) {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const result = await syncResoListings()
    return NextResponse.json({ success: true, result })
  } catch (error) {
    return NextResponse.json({ error: 'Sync failed', details: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const [lastSync, activeCount] = await Promise.all([
    prisma.resoSyncLog.findFirst({ orderBy: { syncedAt: 'desc' } }),
    prisma.resoProperty.count({ where: { standardStatus: 'Active' } }),
  ])
  return NextResponse.json({ lastSync, activeListings: activeCount })
}
