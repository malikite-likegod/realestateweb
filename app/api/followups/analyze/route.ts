/**
 * GET|POST /api/followups/analyze
 *
 * Runs the follow-up cadence analyzer: flags overdue contacts per segment,
 * creates a "Follow-Up" Task for each (skipping contacts that already have
 * one open), and flags home-anniversary reminders. Intended to run once daily
 * via cron (see vercel.json), or on-demand from the admin "Run now" button.
 *
 * Both GET and POST are supported and run the same logic — Vercel Cron issues
 * GET requests, while the existing /api/automation/process convention in this
 * repo assumes POST+Bearer, so this route accepts either.
 *
 * Authentication: x-cron-secret header, Authorization: Bearer <secret>
 * (FOLLOWUP_ANALYZE_SECRET env var), or an authenticated admin session.
 */

import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { verifySecret } from '@/lib/cron-auth'
import { analyzeFollowUps } from '@/lib/followups/analyzer-service'

async function isAuthorized(request: Request): Promise<boolean> {
  const xCronSecret  = request.headers.get('x-cron-secret')
  const authHeader   = request.headers.get('authorization') ?? ''
  const bearerSecret = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null

  const hasValidSecret =
    verifySecret(xCronSecret,  process.env.FOLLOWUP_ANALYZE_SECRET) ||
    verifySecret(bearerSecret, process.env.FOLLOWUP_ANALYZE_SECRET)

  if (hasValidSecret) return true
  const session = await getSession()
  return !!session
}

async function run(request: Request) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await analyzeFollowUps()
    return NextResponse.json({ data: result })
  } catch (error) {
    console.error('[/api/followups/analyze]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: Request)  { return run(request) }
export async function POST(request: Request) { return run(request) }
