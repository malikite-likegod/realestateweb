import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { sendWebhook } from '@/services/ai/webhooks'
import { enqueueJob } from '@/lib/automation/job-queue'
import { verifyCsrfOrigin } from '@/lib/csrf'

const leadSchema = z.object({
  firstName:      z.string().min(1).max(100),
  lastName:       z.string().max(100).optional(),
  email:          z.string().email().max(254),
  phone:          z.string().max(30).optional(),
  areaOfInterest: z.string().max(200).optional(),
})

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  if (!verifyCsrfOrigin(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { slug } = await params

  const report = await prisma.marketReport.findUnique({ where: { slug } })
  if (!report || report.status !== 'published') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  let data: z.infer<typeof leadSchema>
  try {
    data = leadSchema.parse(await req.json())
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.errors }, { status: 400 })
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const { firstName, lastName, email, phone, areaOfInterest } = data

  const noteEntry = `Requested market report: "${report.title}" (${report.reportMonth ?? slug})${areaOfInterest ? ` — Area: ${areaOfInterest}` : ''}`

  const existing = await prisma.contact.findUnique({ where: { email } })
  const notes = existing?.notes
    ? `${existing.notes}\n${noteEntry}`
    : noteEntry

  const contact = await prisma.contact.upsert({
    where:  { email },
    update: { phone: phone || undefined, notes },
    create: { firstName, lastName: lastName ?? '', email, phone: phone ?? null, source: 'market_report', notes },
  })

  await prisma.marketReport.update({ where: { slug }, data: { leads: { increment: 1 } } })

  await sendWebhook('new_lead', { contactId: contact.id, source: 'market_report' })
  await enqueueJob('evaluate_rules', { trigger: 'new_lead', contactId: contact.id })

  return NextResponse.json({ ok: true }, { status: 201 })
}
