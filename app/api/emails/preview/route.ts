// POST /api/emails/preview — resolve merge tags + signature for display only (no send, no DB write)

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { renderEmailPreview } from '@/lib/communications/email-service'

const previewSchema = z.object({
  subject:           z.string(),
  body:               z.string(),
  contactId:          z.string().optional(),
  signatureOverride:  z.string().optional(),
})

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const parsed = previewSchema.parse(await request.json())
    const preview = await renderEmailPreview({ ...parsed, sentById: session.id })
    return NextResponse.json({ data: preview })
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.errors }, { status: 400 })
    console.error('[POST /api/emails/preview]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
