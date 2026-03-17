import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendWebhook } from '@/services/ai/webhooks'
import { enqueueJob } from '@/lib/automation/job-queue'

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  const page = await prisma.landingPage.findUnique({ where: { slug } })
  if (!page || page.status !== 'published') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { firstName, lastName, email, phone, message } = await req.json()

  if (!firstName || !email) {
    return NextResponse.json({ error: 'firstName and email are required' }, { status: 400 })
  }

  const noteEntry = `Landing page enquiry: "${page.title}"${message ? `\nMessage: ${message}` : ''}`

  const existing = await prisma.contact.findUnique({ where: { email } })
  const notes = existing?.notes ? `${existing.notes}\n${noteEntry}` : noteEntry

  const contact = await prisma.contact.upsert({
    where:  { email },
    update: { phone: phone || undefined, notes },
    create: { firstName, lastName: lastName ?? '', email, phone: phone ?? null, source: 'landing_page', notes },
  })

  // Apply auto-tags from the landing page
  if (page.autoTags) {
    let tagNames: string[] = []
    try { tagNames = JSON.parse(page.autoTags) } catch { /* ignore */ }

    for (const name of tagNames) {
      if (!name.trim()) continue
      const tag = await prisma.tag.upsert({
        where:  { name: name.trim() },
        update: {},
        create: { name: name.trim() },
      })
      await prisma.contactTag.upsert({
        where:  { contactId_tagId: { contactId: contact.id, tagId: tag.id } },
        update: {},
        create: { contactId: contact.id, tagId: tag.id },
      })
    }
  }

  await prisma.landingPage.update({ where: { slug }, data: { leads: { increment: 1 } } })

  await sendWebhook('new_lead', { contactId: contact.id, source: 'landing_page' })
  await enqueueJob('evaluate_rules', { trigger: 'new_lead', contactId: contact.id })

  return NextResponse.json({ ok: true }, { status: 201 })
}
