// GET /api/followups/preview — read-only list of currently overdue contacts,
// powers the dashboard widget and admin table without creating any tasks.

import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { previewOverdueContacts } from '@/lib/followups/analyzer-service'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const data = await previewOverdueContacts()
    return NextResponse.json({ data })
  } catch (error) {
    console.error('[GET /api/followups/preview]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
