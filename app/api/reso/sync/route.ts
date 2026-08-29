import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { verifySecret } from '@/lib/cron-auth'
import { syncIdxProperty, syncIdxMedia, syncDlaProperty, syncClosedProperty, syncOffMarketProperty, syncVoxMember, syncVoxOffice } from '@/services/reso/sync'
import { prisma } from '@/lib/prisma'
import { getMlsSyncInterval } from '@/lib/site-settings'

type SyncType = 'idx_property' | 'idx_media' | 'dla_property' | 'offmarket_property' | 'vox_member' | 'vox_office'

// Run sync in background — returns immediately so Nginx doesn't time out on
// the initial full-sync which can take several minutes.
function runInBackground(fn: () => Promise<unknown>) {
  setImmediate(() => fn().catch(err => console.error('[reso/sync] background error:', err)))
}

// Clears the saved cursor for the given sync type(s) so the next run rescans
// from scratch (PropTx epoch) instead of only records changed since the last
// cursor position. Needed to backfill fields that were missed on a listing's
// last visit — e.g. ClosePrice dropped by a since-resolved PropTx tier
// restriction — since a normal incremental run never revisits an
// already-passed listing unless PropTx changes it again.
async function resetCheckpoints(...syncTypes: string[]) {
  if (syncTypes.length > 0) {
    await prisma.ampreSyncCheckpoint.deleteMany({ where: { syncType: { in: syncTypes } } })
  }
}

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url)
  const cronSecret = request.headers.get('x-cron-secret')
  const isCron = verifySecret(cronSecret, process.env.RESO_SYNC_SECRET)

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

  const type  = searchParams.get('type') ?? 'idx'
  const reset = searchParams.get('reset') === 'true'
  const resetSuffix = reset ? ' (full re-sync)' : ''

  if (type === 'media') {
    runInBackground(syncIdxMedia)
    return NextResponse.json({ success: true, message: 'Media sync started in background' })
  }

  if (type === 'dla') {
    if (reset) await resetCheckpoints('dla_property')
    runInBackground(syncDlaProperty)
    return NextResponse.json({ success: true, message: `DLA sync started in background${resetSuffix}` })
  }

  if (type === 'closed') {
    if (reset) await resetCheckpoints('closed_property')
    runInBackground(syncClosedProperty)
    return NextResponse.json({ success: true, message: `Closed listings sync started in background${resetSuffix}` })
  }

  if (type === 'offmarket') {
    if (reset) await resetCheckpoints('offmarket_property')
    runInBackground(syncOffMarketProperty)
    return NextResponse.json({ success: true, message: `Off-market listings sync started in background${resetSuffix}` })
  }

  if (type === 'vox') {
    runInBackground(() => Promise.all([syncVoxMember(), syncVoxOffice()]))
    return NextResponse.json({ success: true, message: 'VOX sync started in background' })
  }

  if (type === 'all') {
    if (reset) await resetCheckpoints('idx_property', 'dla_property', 'offmarket_property')
    runInBackground(async () => {
      // IDX properties, VOX members, and VOX offices write to different tables — run in parallel
      await Promise.all([syncIdxProperty(), syncVoxMember(), syncVoxOffice()])
      // DLA enriches property rows — run after IDX to avoid row conflicts
      // Media fetches photos for listings that don't have them yet
      // Off-market sync writes its own rows and doesn't touch IDX-owned fields — safe alongside DLA/media
      // syncClosedProperty is intentionally excluded — see services/reso/sync.ts
      await Promise.all([syncDlaProperty(), syncIdxMedia(), syncOffMarketProperty()])
    })
    return NextResponse.json({ success: true, message: `Full sync started in background${resetSuffix}` })
  }

  // Default: idx
  if (reset) await resetCheckpoints('idx_property')
  runInBackground(syncIdxProperty)
  return NextResponse.json({ success: true, message: `IDX sync started in background${resetSuffix}` })
}

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const syncTypes: SyncType[] = ['idx_property', 'idx_media', 'dla_property', 'offmarket_property', 'vox_member', 'vox_office']

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
