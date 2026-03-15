import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { sendWebhook } from '@/services/ai/webhooks'
import { enqueueJob } from '@/lib/automation/job-queue'

const createContactSchema = z.object({
  firstName:  z.string().optional(),
  lastName:   z.string().optional(),
  name:       z.string().optional(),
  email:      z.string().email().optional(),
  phone:      z.string().optional(),
  company:    z.string().optional(),
  source:     z.string().optional(),
  interest:   z.string().optional(),
  message:    z.string().optional(),
  metadata:   z.record(z.unknown()).optional(),
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
    if (parsed.email) {
      contact = await prisma.contact.upsert({
        where: { email: parsed.email },
        update: { phone: parsed.phone ?? undefined, source: parsed.source ?? undefined },
        create: { firstName, lastName, email: parsed.email, phone: parsed.phone ?? null, company: parsed.company ?? null, source: parsed.source ?? 'website' },
      })
    } else {
      contact = await prisma.contact.create({
        data: { firstName, lastName, email: null, phone: parsed.phone ?? null, source: parsed.source ?? 'website' },
      })
    }

    // Webhook + automation rules
    await sendWebhook('new_lead', { contactId: contact.id, source: parsed.source })
    await enqueueJob('evaluate_rules', { trigger: 'new_lead', contactId: contact.id })

    return NextResponse.json({ data: contact }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.errors }, { status: 400 })
    console.error('[POST /api/contacts]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
