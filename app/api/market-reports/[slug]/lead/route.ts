import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendWebhook } from '@/services/ai/webhooks'
import { enqueueJob } from '@/lib/automation/job-queue'

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  const report = await prisma.marketReport.findUnique({ where: { slug } })
  if (!report || report.status !== 'published') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const body = await req.json()
  const { firstName, lastName, email, phone, areaOfInterest } = body

  if (!firstName || !email) {
    return NextResponse.json({ error: 'firstName and email are required' }, { status: 400 })
  }

  const noteEntry = `Requested market report: "${report.title}" (${report.reportMonth ?? slug})${areaOfInterest ? ` — Area: ${areaOfInterest}` : ''}`

  // Upsert contact — append to existing notes rather than overwriting
  const existing = await prisma.contact.findUnique({ where: { email } })
  const notes = existing?.notes
    ? `${existing.notes}\n${noteEntry}`
    : noteEntry

  const contact = await prisma.contact.upsert({
    where:  { email },
    update: { phone: phone || undefined, notes },
    create: { firstName, lastName: lastName ?? '', email, phone: phone ?? null, source: 'market_report', notes },
  })

  // Increment leads counter on the report
  await prisma.marketReport.update({ where: { slug }, data: { leads: { increment: 1 } } })

  // Trigger automation
  await sendWebhook('new_lead', { contactId: contact.id, source: 'market_report' })
  await enqueueJob('evaluate_rules', { trigger: 'new_lead', contactId: contact.id })

  return NextResponse.json({ ok: true }, { status: 201 })
}
