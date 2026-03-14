// GET  /api/sms — list SMS messages for a contact
// POST /api/sms — send an outbound SMS (or group SMS)

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { sendSms, sendGroupSms, getSmsThread } from '@/lib/communications/sms-service'

const sendSchema = z.object({
  contactId:  z.string(),
  body:       z.string().min(1).max(1600),
  toNumber:   z.string(),
  mediaUrls:  z.array(z.string().url()).optional(),
})

const groupSchema = z.object({
  contactIds: z.array(z.string()).min(2),
  body:       z.string().min(1).max(1600),
})

export async function GET(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const contactId = searchParams.get('contactId')
  if (!contactId) return NextResponse.json({ error: 'contactId is required' }, { status: 400 })

  const page     = parseInt(searchParams.get('page')     ?? '1')
  const pageSize = parseInt(searchParams.get('pageSize') ?? '50')
  const result   = await getSmsThread(contactId, { page, pageSize })
  return NextResponse.json(result)
}

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json()

    // Group SMS branch
    if (Array.isArray(body.contactIds)) {
      const parsed = groupSchema.parse(body)
      const result = await sendGroupSms({ ...parsed, sentById: session.id })
      return NextResponse.json({ data: result }, { status: 201 })
    }

    // Single SMS
    const parsed = sendSchema.parse(body)
    const msg    = await sendSms({ ...parsed, sentById: session.id })
    return NextResponse.json({ data: msg }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.errors }, { status: 400 })
    console.error('[POST /api/sms]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
