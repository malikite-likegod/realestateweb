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
import { processPendingJobs } from '@/lib/automation/job-queue'

export async function POST(request: Request) {
  // Allow cron secret header OR authenticated admin session
  const cronSecret = request.headers.get('x-cron-secret')
  const validSecret = process.env.AUTOMATION_PROCESS_SECRET

  if (cronSecret && validSecret && cronSecret === validSecret) {
    // Cron access — proceed
  } else {
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
