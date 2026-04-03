import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { sendWebhook } from '@/services/ai/webhooks'
import { enqueueJob } from '@/lib/automation/job-queue'
import { createNotification } from '@/lib/notifications'
import { notifyNewContact } from '@/lib/notifications/admin-notify'
import { enrollContact } from '@/lib/automation/campaign-service'

const phoneSchema = z.object({
  label:     z.string().default('mobile'),
  number:    z.string(),
  isPrimary: z.boolean().default(false),
})

const addressSchema = z.object({
  label:      z.string().default('home'),
  street:     z.string().optional().nullable(),
  city:       z.string().optional().nullable(),
  province:   z.string().optional().nullable(),
  postalCode: z.string().optional().nullable(),
  country:    z.string().default('CA'),
  isPrimary:  z.boolean().default(false),
})

const createContactSchema = z.object({
  firstName:  z.string().optional(),
  lastName:   z.string().optional(),
  name:       z.string().optional(),
  email:      z.string().email().optional().nullable(),
  phone:      z.string().optional(),
  company:    z.string().optional(),
  jobTitle:   z.string().optional().nullable(),
  source:     z.string().optional(),
  status:     z.enum(['lead', 'prospect', 'client', 'past_client']).optional(),
  birthday:   z.string().optional().nullable(),
  notes:      z.string().optional().nullable(),
  interest:   z.string().optional(),
  message:    z.string().optional(),
  metadata:   z.record(z.unknown()).optional(),
  phones:     z.array(phoneSchema).optional(),
  addresses:  z.array(addressSchema).optional(),
  // Campaign controls
  skipAutoTriggers: z.boolean().optional(),
  campaignIds:      z.array(z.string()).optional(),
})

export async function GET(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const page     = parseInt(searchParams.get('page') ?? '1')
  const pageSize = parseInt(searchParams.get('pageSize') ?? '25')
  const search   = searchParams.get('search') ?? ''
  const status   = searchParams.get('status') ?? ''

  const where: Record<string, unknown> = {}
  if (status) where.status = status
  if (search) {
    (where as { OR?: unknown[] }).OR = [
      { firstName: { contains: search } },
      { lastName:  { contains: search } },
      { email:     { contains: search } },
      { phone:     { contains: search } },
      { company:   { contains: search } },
    ]
  }

  const [total, contacts] = await Promise.all([
    prisma.contact.count({ where }),
    prisma.contact.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { tags: { include: { tag: true } } },
    }),
  ])

  return NextResponse.json({ data: contacts, total, page, pageSize, totalPages: Math.ceil(total / pageSize) })
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const parsed = createContactSchema.parse(body)

    // Split name if firstName not provided
    let firstName = parsed.firstName ?? ''
    let lastName  = parsed.lastName  ?? ''
    if (!firstName && parsed.name) {
      const parts = parsed.name.trim().split(' ')
      firstName = parts[0] ?? ''
      lastName  = parts.slice(1).join(' ')
    }

    // Upsert by email
    let contact
    let isNew = true
    if (parsed.email) {
      const existing = await prisma.contact.findUnique({ where: { email: parsed.email } })
      isNew = !existing
      contact = await prisma.contact.upsert({
        where:  { email: parsed.email },
        update: { phone: parsed.phone ?? undefined, source: parsed.source ?? undefined },
        create: {
          firstName,
          lastName,
          email:    parsed.email,
          phone:    parsed.phone    ?? null,
          company:  parsed.company  ?? null,
          jobTitle: parsed.jobTitle ?? null,
          source:   parsed.source   ?? 'website',
          status:   parsed.status   ?? 'lead',
          notes:    parsed.notes    ?? null,
          ...(parsed.birthday ? { birthday: new Date(parsed.birthday) } : {}),
        },
      })
    } else {
      contact = await prisma.contact.create({
        data: {
          firstName,
          lastName,
          email:    null,
          phone:    parsed.phone    ?? null,
          company:  parsed.company  ?? null,
          jobTitle: parsed.jobTitle ?? null,
          source:   parsed.source   ?? 'website',
          status:   parsed.status   ?? 'lead',
          notes:    parsed.notes    ?? null,
          ...(parsed.birthday ? { birthday: new Date(parsed.birthday) } : {}),
        },
      })
    }

    // Create phone records
    if (parsed.phones && parsed.phones.length > 0) {
      await prisma.contactPhone.createMany({
        data: parsed.phones.map(p => ({
          contactId: contact.id,
          label:     p.label,
          number:    p.number,
          isPrimary: p.isPrimary,
        })),
      })
    }

    // Create address records
    if (parsed.addresses && parsed.addresses.length > 0) {
      await prisma.contactAddress.createMany({
        data: parsed.addresses.map(a => ({
          contactId:  contact.id,
          label:      a.label,
          street:     a.street     ?? null,
          city:       a.city       ?? null,
          province:   a.province   ?? null,
          postalCode: a.postalCode ?? null,
          country:    a.country,
          isPrimary:  a.isPrimary,
        })),
      })
    }

    // Save message as a note on the contact
    if (parsed.message?.trim()) {
      await prisma.note.create({
        data: { contactId: contact.id, body: `Contact form message: ${parsed.message.trim()}` },
      })
    }

    // Webhook + automation rules (skip if caller requested bypass)
    if (!parsed.skipAutoTriggers) {
      await sendWebhook('new_lead', { contactId: contact.id, source: parsed.source })
      await enqueueJob('evaluate_rules', { trigger: 'new_lead', contactId: contact.id })
    }

    // Manually enroll in any specified campaigns
    if (parsed.campaignIds && parsed.campaignIds.length > 0) {
      await Promise.allSettled(
        parsed.campaignIds.map(campaignId => enrollContact(campaignId, contact.id))
      )
    }

    const name = [firstName, lastName].filter(Boolean).join(' ') || parsed.email || 'Unknown'
    await createNotification({
      type:      'new_contact',
      title:     isNew ? `New contact: ${name}` : `Returning contact: ${name}`,
      body:      isNew
        ? (parsed.source ? `Source: ${parsed.source}` : undefined)
        : `Already in the database — submitted the contact form again${parsed.source ? ` (${parsed.source})` : ''}`,
      contactId: contact.id,
    })

    if (isNew) await notifyNewContact(contact)

    return NextResponse.json({ data: contact }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.errors }, { status: 400 })
    console.error('[POST /api/contacts]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
