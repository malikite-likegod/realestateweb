// GET /api/followups/rules — list the 5 per-segment cadence rules

import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getFollowUpRules } from '@/lib/followups/rule-service'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rules = await getFollowUpRules()
  return NextResponse.json({ data: rules })
}
