import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { syncIdxProperty, syncIdxMedia, syncDlaProperty, syncVoxMember, syncVoxOffice } from '@/services/reso/sync'
import { prisma } from '@/lib/prisma'
import { getMlsSyncInterval } from '@/lib/site-settings'

type SyncType = 'idx_property' | 'dla_property' | 'vox_member' | 'vox_office'

// Run sync in background — returns immediately so Nginx doesn't time out on
// the initial full-sync which can take several minutes.
function runInBackground(fn: () => Promise<unknown>) {
  setImmediate(() => fn().catch(err => console.error('[reso/sync] background error:', err)))
}

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url)
  const cronSecret = request.headers.get('x-cron-secret')
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

  if (type === 'media') {
    runInBackground(syncIdxMedia)
    return NextResponse.json({ success: true, message: 'Media sync started in background' })
  }

  if (type === 'dla') {
    runInBackground(syncDlaProperty)
    return NextResponse.json({ success: true, message: 'DLA sync started in background' })
  }

  if (type === 'vox') {
    runInBackground(() => Promise.all([syncVoxMember(), syncVoxOffice()]))
    return NextResponse.json({ success: true, message: 'VOX sync started in background' })
  }

  if (type === 'all') {
    runInBackground(async () => {
      // IDX properties, VOX members, and VOX offices write to different tables — run in parallel
      await Promise.all([syncIdxProperty(), syncVoxMember(), syncVoxOffice()])
      // DLA enriches property rows — run after IDX to avoid row conflicts
      // Media fetches photos for listings that don't have them yet
      await Promise.all([syncDlaProperty(), syncIdxMedia()])
    })
    return NextResponse.json({ success: true, message: 'Full sync started in background' })
  }

  // Default: idx
  runInBackground(syncIdxProperty)
  return NextResponse.json({ success: true, message: 'IDX sync started in background' })
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
