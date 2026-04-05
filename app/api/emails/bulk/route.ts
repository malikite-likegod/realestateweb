import { NextResponse }  from 'next/server'
import { z }             from 'zod'
import { prisma }        from '@/lib/prisma'
import { getSession }    from '@/lib/auth'

const MAX_RECIPIENTS = 2000

const schema = z.object({
  tagIds:      z.array(z.string()).optional().default([]),
  contactIds:  z.array(z.string()).optional().default([]),
  subject:     z.string().min(1, 'Subject is required'),
  body:        z.string().min(1, 'Body is required'),
  templateId:  z.string().optional(),
  scheduledAt: z.string().datetime().optional(),
}).refine(
  d => d.tagIds.length > 0 || d.contactIds.length > 0,
  { message: 'Provide at least one tagId or contactId' },
)

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let parsed: z.infer<typeof schema>
  try {
    const rawBody = await request.json()
    parsed = schema.parse(rawBody)
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0]?.message ?? 'Invalid request' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { tagIds, contactIds, subject, body: emailBody, templateId, scheduledAt } = parsed

  try {
    // Fetch contacts by tag(s)
    const tagContacts = tagIds.length > 0
      ? await prisma.contact.findMany({
          where:  { tags: { some: { tagId: { in: tagIds } } } },
          select: { id: true, email: true },
        })
      : []

    // Fetch individually-selected contacts
    const indivContacts = contactIds.length > 0
      ? await prisma.contact.findMany({
          where:  { id: { in: contactIds } },
          select: { id: true, email: true },
        })
      : []

    // Deduplicate by contact ID
    const contactMap = new Map<string, { id: string; email: string | null }>()
    for (const c of [...tagContacts, ...indivContacts]) contactMap.set(c.id, c)
    const allContacts = Array.from(contactMap.values())

    // Enforce recipient cap
    if (allContacts.length > MAX_RECIPIENTS) {
      return NextResponse.json(
        { error: `Recipient list exceeds maximum of ${MAX_RECIPIENTS}` },
        { status: 422 },
      )
    }

    // Separate contacts with and without email
    const recipients = allContacts.filter(c => c.email)
    const skipped    = allContacts.length - recipients.length

    const runAt      = scheduledAt ? new Date(scheduledAt) : new Date()
    const bulkSendId = crypto.randomUUID()

    // Create campaign record before enqueuing jobs.
    // If job enqueue fails, clean up the orphaned campaign record.
    const campaign = await prisma.emailCampaign.create({
      data: {
        name:           subject,
        subject,
        sentAt:         runAt,
        recipientCount: recipients.length,
      },
    })

    // Batch-enqueue all jobs in one DB write
    try {
      await prisma.jobQueue.createMany({
        data: recipients.map(contact => ({
          type:    'bulk_email_send',
          payload: JSON.stringify({
            contactId:  contact.id,
            toEmail:    contact.email,
            subject,
            body:       emailBody,
            templateId,
            bulkSendId,
            campaignId: campaign.id,
          }),
          runAt,
        })),
      })
    } catch (err) {
      await prisma.emailCampaign.delete({ where: { id: campaign.id } })
      throw err
    }

    return NextResponse.json({
      total:      allContacts.length,
      scheduled:  recipients.length,
      skipped,
      bulkSendId,
      campaignId: campaign.id,
    })
  } catch (err) {
    console.error('[POST /api/emails/bulk]', err)
    return NextResponse.json({ error: 'Failed to queue emails' }, { status: 500 })
  }
}
