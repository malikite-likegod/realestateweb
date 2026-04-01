/**
 * POST /api/automation/process
 *
 * Background job processor. Picks up pending jobs from the JobQueue table
 * and executes them. Intended to be called by an external cron service
 * (e.g. Vercel Cron, GitHub Actions, or any HTTP cron) every 1–5 minutes.
 *
 * Authentication: x-cron-secret header must match AUTOMATION_PROCESS_SECRET
 * env var. Falls back to checking admin session for manual trigger from the UI.
 *
 * Returns a summary of what was processed.
 */

import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { verifySecret } from '@/lib/cron-auth'
import { processPendingJobs } from '@/lib/automation/job-queue'

export async function POST(request: Request) {
  // Accept three auth methods:
  //   1. x-cron-secret header (generic external cron services)
  //   2. Authorization: Bearer <secret> (Vercel Cron — uses CRON_SECRET env var)
  //   3. Authenticated admin session (manual trigger from the UI)
  const xCronSecret       = request.headers.get('x-cron-secret')
  const authHeader        = request.headers.get('authorization') ?? ''
  const bearerSecret      = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null

  const hasValidSecret = verifySecret(xCronSecret, process.env.AUTOMATION_PROCESS_SECRET) ||
                         verifySecret(bearerSecret, process.env.AUTOMATION_PROCESS_SECRET)

  if (!hasValidSecret) {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const limit = parseInt(searchParams.get('limit') ?? '20')

  try {
    const result = await processPendingJobs(Math.min(limit, 100))
    return NextResponse.json({ data: result })
  } catch (error) {
    console.error('[POST /api/automation/process]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Also support GET for simple health/status check
export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { prisma } = await import('@/lib/prisma')
  const [pending, running, failed] = await Promise.all([
    prisma.jobQueue.count({ where: { status: 'pending' } }),
    prisma.jobQueue.count({ where: { status: 'running' } }),
    prisma.jobQueue.count({ where: { status: 'failed'  } }),
  ])

  return NextResponse.json({ data: { pending, running, failed } })
}
