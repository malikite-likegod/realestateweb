// GET /api/communications/timeline?contactId=xxx&limit=50&before=ISO_DATE
// Returns a unified, chronological communication timeline for a contact.

import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getContactTimeline } from '@/lib/communications/timeline-service'

export async function GET(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const contactId = searchParams.get('contactId')
  if (!contactId) return NextResponse.json({ error: 'contactId is required' }, { status: 400 })

  const limit  = parseInt(searchParams.get('limit') ?? '50')
  const before = searchParams.get('before') ? new Date(searchParams.get('before')!) : undefined

  const entries = await getContactTimeline(contactId, { limit, before })
  return NextResponse.json({ data: entries })
}
