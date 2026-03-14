// GET /api/calls  — list call logs (filter by contactId)
// POST /api/calls — create (log) a new call

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { createCallLog, getCallLogs } from '@/lib/communications/call-service'

const createSchema = z.object({
  contactId:    z.string().optional(),
  direction:    z.enum(['inbound', 'outbound']).optional(),
  status:       z.enum(['completed', 'missed', 'voicemail', 'failed']).optional(),
  durationSec:  z.number().int().min(0).optional(),
  notes:        z.string().optional(),
  recordingUrl: z.string().url().optional(),
  transcription: z.string().optional(),
  fromNumber:   z.string().optional(),
  toNumber:     z.string().optional(),
  occurredAt:   z.string().datetime().optional(),
})

export async function GET(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const contactId = searchParams.get('contactId') ?? undefined
  const page      = parseInt(searchParams.get('page')     ?? '1')
  const pageSize  = parseInt(searchParams.get('pageSize') ?? '20')

  const result = await getCallLogs({ contactId, page, pageSize })
  return NextResponse.json(result)
}

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body   = await request.json()
    const parsed = createSchema.parse(body)

    const call = await createCallLog({
      ...parsed,
      occurredAt: parsed.occurredAt ? new Date(parsed.occurredAt) : undefined,
      loggedById: session.id,
    })
    return NextResponse.json({ data: call }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.errors }, { status: 400 })
    console.error('[POST /api/calls]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
