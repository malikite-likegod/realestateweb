/**
 * Next.js Instrumentation Hook
 *
 * Runs once when the server process starts. Sets up a background interval
 * that processes the automation job queue every minute.
 *
 * This is the self-hosted equivalent of a cron job — no external services needed.
 * For Vercel deployments, see vercel.json which handles scheduling via Vercel Cron.
 *
 * Docs: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  // Only run in the Node.js runtime (not Edge)
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  // Upgrade in-memory rate limiters to Redis-backed when REDIS_URL is set.
  // This runs unconditionally so Redis rate limiting works even when the
  // automation runner is disabled (the common production configuration).
  await import('./lib/rate-limit-redis')

  // On shared hosting, the automation runner consumes threads continuously.
  // It is disabled in production unless explicitly enabled.
  if (process.env.NODE_ENV === 'production' && process.env.ENABLE_AUTOMATION_RUNNER !== 'true') return
  if (process.env.DISABLE_AUTOMATION_RUNNER === 'true') return

  const intervalMs = Math.max(10_000, parseInt(process.env.AUTOMATION_INTERVAL_MS ?? '') || 60_000) // default: 1 minute, minimum: 10s

  const { processPendingJobs }       = await import('./lib/automation/job-queue')
  const { syncInbox }                = await import('./lib/communications/imap-service')
  const { geocodeMissingProperties } = await import('./services/reso/geocode')
  const { prisma }                   = await import('./lib/prisma')
  const { getMlsSyncInterval }       = await import('./lib/site-settings')

  // Guard against multiple registrations in dev (hot reload can call register() more than once)
  const key = Symbol.for('automation_runner_started')
  const g   = global as typeof globalThis & { [key]?: boolean }
  if (g[key]) return
  g[key] = true

  console.log(`[automation] Background runner started — processing jobs every ${intervalMs / 1000}s`)

  setInterval(async () => {
    try {
      const result = await processPendingJobs(50)
      if (result.processed > 0 || result.failed > 0) {
        console.log(`[automation] Processed ${result.processed} jobs, ${result.failed} failed, ${result.skipped} skipped`)
      }
    } catch (err: unknown) {
      console.error('[automation] Job processing error:', err)
      // PrismaClientRustPanicError is non-recoverable — reconnect the engine
      if (err instanceof Error && err.constructor.name === 'PrismaClientRustPanicError') {
        console.log('[automation] Prisma engine panicked — reconnecting...')
        try {
          await prisma.$disconnect()
          await prisma.$connect()
          console.log('[automation] Prisma reconnected successfully')
        } catch (reconnectErr) {
          console.error('[automation] Reconnect failed:', reconnectErr)
        }
      }
    }

    try {
      const sync = await syncInbox()
      if (sync.imported > 0) {
        console.log(`[imap] Imported ${sync.imported} inbound emails (${sync.unmatched} unmatched contacts)`)
      }
    } catch (err: unknown) {
      console.error('[imap] Sync error:', err)
    }

    try {
      await geocodeMissingProperties()
    } catch (err: unknown) {
      console.error('[geocode] Error geocoding properties:', err)
    }

    try {
      await runMlsSyncIfDue()
    } catch (err: unknown) {
      console.error('[mls-sync] Error running scheduled sync:', err)
    }
  }, intervalMs)

  async function runMlsSyncIfDue() {
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
      if (elapsedMs < intervalMs) return
    }

    console.log('[mls-sync] Interval elapsed — running scheduled sync')
    const { syncIdxProperty, syncDlaProperty, syncVoxMember, syncVoxOffice, syncIdxMedia } = await import('./services/reso/sync')
    await Promise.all([syncIdxProperty(), syncVoxMember(), syncVoxOffice()])
    await Promise.all([syncDlaProperty(), syncIdxMedia()])
    console.log('[mls-sync] Scheduled sync complete')
  }
}
