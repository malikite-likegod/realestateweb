// POST /api/campaigns/[id]/enroll — enroll one or multiple contacts in a campaign

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { enrollContact, bulkEnroll } from '@/lib/automation/campaign-service'

const schema = z.object({
  contactId:  z.string().optional(),
  contactIds: z.array(z.string()).optional(),
})

interface Props { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: Props) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id }  = await params
    const body    = await request.json()
    const parsed  = schema.parse(body)

    if (parsed.contactIds && parsed.contactIds.length > 0) {
      const results = await bulkEnroll(id, parsed.contactIds)
      const succeeded = results.filter(r => r.status === 'fulfilled').length
      return NextResponse.json({ data: { enrolled: succeeded, total: parsed.contactIds.length } }, { status: 201 })
    }

    if (parsed.contactId) {
      const enrollment = await enrollContact(id, parsed.contactId)
      if (!enrollment) return NextResponse.json({ error: 'Campaign not found or inactive' }, { status: 400 })
      return NextResponse.json({ data: enrollment }, { status: 201 })
    }

    return NextResponse.json({ error: 'contactId or contactIds required' }, { status: 400 })
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.errors }, { status: 400 })
    console.error('[POST /api/campaigns/[id]/enroll]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
