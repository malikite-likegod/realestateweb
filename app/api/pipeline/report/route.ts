// GET /api/pipeline/report — return full pipeline analytics report

import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getPipelineReport } from '@/lib/pipeline/pipeline-service'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const report = await getPipelineReport()
  return NextResponse.json({ data: report })
}
