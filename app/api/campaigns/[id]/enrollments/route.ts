// GET /api/campaigns/[id]/enrollments — list enrollments for a campaign

import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getEnrollments } from '@/lib/automation/campaign-service'

interface Props { params: Promise<{ id: string }> }

export async function GET(request: Request, { params }: Props) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { searchParams } = new URL(request.url)
  const page     = parseInt(searchParams.get('page')     ?? '1')
  const pageSize = parseInt(searchParams.get('pageSize') ?? '25')

  const result = await getEnrollments(id, { page, pageSize })
  return NextResponse.json(result)
}
