import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { verifyCsrfOrigin } from '@/lib/csrf'

const leadSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName:  z.string().max(100).optional(),
  email:     z.string().email().max(254),
  phone:     z.string().max(30).optional(),
  message:   z.string().max(2000).optional(),
})
import { sendWebhook } from '@/services/ai/webhooks'
import { enqueueJob } from '@/lib/automation/job-queue'
import { validateEmail } from '@/lib/services/zerobounce'
import { sendEmailVerification } from '@/lib/communications/verification-service'

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  if (!verifyCsrfOrigin(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { slug } = await params

  const page = await prisma.landingPage.findUnique({ where: { slug } })
  if (!page || page.status !== 'published') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  let firstName: string, lastName: string | undefined, email: string, phone: string | undefined, message: string | undefined
  try {
    ;({ firstName, lastName, email, phone, message } = leadSchema.parse(await req.json()))
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.errors }, { status: 400 })
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  // ZeroBounce email validation (skipped if ZEROBOUNCE_API_KEY not set)
  const emailStatus = await validateEmail(email)
  if (emailStatus === 'invalid') {
    return NextResponse.json(
      { error: 'Please enter a valid email address.' },
      { status: 400 }
    )
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

  // Send email verification (fire-and-forget; errors are logged inside the service)
  sendEmailVerification(contact.id).catch(() => {})

  return NextResponse.json({ ok: true }, { status: 201 })
}
