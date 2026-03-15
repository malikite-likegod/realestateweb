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
  // Only run in the Node.js runtime (not Edge), and only when the job runner is enabled
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  if (process.env.DISABLE_AUTOMATION_RUNNER === 'true') return

  const intervalMs = Math.max(10_000, parseInt(process.env.AUTOMATION_INTERVAL_MS ?? '') || 60_000) // default: 1 minute, minimum: 10s

  const { processPendingJobs } = await import('./lib/automation/job-queue')

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
    } catch (err) {
      console.error('[automation] Job processing error:', err)
    }
  }, intervalMs)
}
