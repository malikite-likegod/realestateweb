import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { syncIdxProperty, syncDlaProperty, syncVoxMember, syncVoxOffice } from '@/services/reso/sync'
import { prisma } from '@/lib/prisma'
import { getMlsSyncInterval } from '@/lib/site-settings'

type SyncType = 'idx_property' | 'dla_property' | 'vox_member' | 'vox_office'

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url)
  // Accept secret via header OR query param (header may be stripped by some proxies)
  const cronSecret = request.headers.get('x-cron-secret') ?? searchParams.get('secret')
  const isCron = !!cronSecret && cronSecret === process.env.RESO_SYNC_SECRET

  if (!isCron) {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Cron: skip if interval hasn't elapsed (unless ?force=true is passed)
  const force = searchParams.get('force') === 'true'

  if (isCron && !force) {
    const [lastSync, intervalMinutes] = await Promise.all([
      prisma.resoSyncLog.findFirst({
        where:   { syncType: 'idx_property' },
        orderBy: { syncedAt: 'desc' },
      }),
      getMlsSyncInterval(),
    ])
    if (lastSync) {
      const elapsedMs  = Date.now() - lastSync.syncedAt.getTime()
      const intervalMs = intervalMinutes * 60 * 1000
      if (elapsedMs < intervalMs) {
        return NextResponse.json({
          skipped: true,
          reason: 'Interval not elapsed',
          nextSyncInSeconds: Math.ceil((intervalMs - elapsedMs) / 1000),
        })
      }
    }
  }

  const type = searchParams.get('type') ?? 'idx'

  try {
    if (type === 'dla') {
      const result = await syncDlaProperty()
      return NextResponse.json({ success: true, result })
    }

    if (type === 'vox') {
      const [memberResult, officeResult] = await Promise.all([syncVoxMember(), syncVoxOffice()])
      return NextResponse.json({ success: true, result: { member: memberResult, office: officeResult } })
    }

    if (type === 'all') {
      const idxResult    = await syncIdxProperty()
      const dlaResult    = await syncDlaProperty()
      const memberResult = await syncVoxMember()
      const officeResult = await syncVoxOffice()
      return NextResponse.json({ success: true, result: { idx: idxResult, dla: dlaResult, member: memberResult, office: officeResult } })
    }

    // Default: idx
    const result = await syncIdxProperty()
    return NextResponse.json({ success: true, result })
  } catch (error) {
    return NextResponse.json(
      { error: 'Sync failed', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const syncTypes: SyncType[] = ['idx_property', 'dla_property', 'vox_member', 'vox_office']

  const [logs, activeCount] = await Promise.all([
    Promise.all(
      syncTypes.map(syncType =>
        prisma.resoSyncLog.findFirst({
          where:   { syncType },
          orderBy: { syncedAt: 'desc' },
        })
      )
    ),
    prisma.resoProperty.count({ where: { standardStatus: 'Active' } }),
  ])

  const lastSync: Record<string, unknown> = {}
  for (let i = 0; i < syncTypes.length; i++) {
    const log = logs[i]
    lastSync[syncTypes[i]] = log
      ? { syncedAt: log.syncedAt, added: log.added, updated: log.updated, deleted: log.deleted, errors: log.errors }
      : null
  }

  return NextResponse.json({ lastSync, activeListings: activeCount })
}
