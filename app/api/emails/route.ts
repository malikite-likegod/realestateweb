// GET  /api/emails — list emails for a contact
// POST /api/emails — send an outbound email (multipart/form-data or JSON)

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { sendEmail, getEmailThread } from '@/lib/communications/email-service'

const sendSchema = z.object({
  contactId:  z.string(),
  subject:    z.string().min(1),
  body:       z.string().min(1), // HTML
  toEmail:    z.string().email(),
  fromEmail:  z.string().email().optional(),
  ccEmails:   z.array(z.string().email()).optional(),
  templateId: z.string().optional(),
})

export async function GET(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const contactId = searchParams.get('contactId')
  if (!contactId) return NextResponse.json({ error: 'contactId is required' }, { status: 400 })

  const page     = parseInt(searchParams.get('page')     ?? '1')
  const pageSize = parseInt(searchParams.get('pageSize') ?? '20')
  const result   = await getEmailThread(contactId, { page, pageSize })
  return NextResponse.json(result)
}

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const contentType = request.headers.get('content-type') ?? ''

    let fields: Record<string, string> = {}
    const attachments: Array<{ filename: string; content: Buffer }> = []

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      for (const [key, value] of formData.entries()) {
        if (value instanceof File) {
          const buffer = Buffer.from(await value.arrayBuffer())
          attachments.push({ filename: value.name, content: buffer })
        } else {
          fields[key] = value
        }
      }
    } else {
      fields = await request.json()
    }

    // ccEmails may arrive as a JSON string when sent via FormData
    if (typeof fields.ccEmails === 'string') {
      try { (fields as Record<string, unknown>).ccEmails = JSON.parse(fields.ccEmails) } catch { /* leave as-is */ }
    }

    const parsed = sendSchema.parse(fields)
    const email  = await sendEmail({
      ...parsed,
      sentById:    session.id,
      attachments: attachments.length > 0 ? attachments : undefined,
    })
    return NextResponse.json({ data: email }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.errors }, { status: 400 })
    console.error('[POST /api/emails]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
