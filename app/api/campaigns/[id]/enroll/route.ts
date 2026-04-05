// POST /api/campaigns/[id]/enroll — enroll one or multiple contacts in a campaign

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { enrollContact, bulkEnroll } from '@/lib/automation/campaign-service'

const schema = z.object({
  contactId:   z.string().optional(),
  contactIds:  z.array(z.string()).optional(),
  startAtStep: z.number().int().min(0).optional(),
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
      const results   = await bulkEnroll(id, parsed.contactIds)
      const succeeded = results.filter(r => r.status === 'fulfilled').length
      const campaign  = await prisma.automationSequence.findUnique({ where: { id }, select: { name: true } })
      await prisma.activity.create({
        data: {
          type:    'enrollment',
          subject: `Bulk enrolled ${succeeded} contact${succeeded !== 1 ? 's' : ''} into "${campaign?.name ?? id}"`,
          userId:  session.id,
        },
      })
      return NextResponse.json({ data: { enrolled: succeeded, total: parsed.contactIds.length } }, { status: 201 })
    }

    if (parsed.contactId) {
      const enrollment = await enrollContact(id, parsed.contactId, parsed.startAtStep ?? 0)
      if (!enrollment) return NextResponse.json({ error: 'Campaign not found or inactive' }, { status: 400 })
      const [campaign, contact] = await Promise.all([
        prisma.automationSequence.findUnique({ where: { id }, select: { name: true } }),
        prisma.contact.findUnique({ where: { id: parsed.contactId }, select: { firstName: true, lastName: true } }),
      ])
      await prisma.activity.create({
        data: {
          type:      'enrollment',
          subject:   `Enrolled ${contact ? `${contact.firstName} ${contact.lastName}` : 'contact'} into "${campaign?.name ?? id}"`,
          userId:    session.id,
          contactId: parsed.contactId,
        },
      })
      return NextResponse.json({ data: enrollment }, { status: 201 })
    }

    return NextResponse.json({ error: 'contactId or contactIds required' }, { status: 400 })
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.errors }, { status: 400 })
    console.error('[POST /api/campaigns/[id]/enroll]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
