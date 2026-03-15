/**
 * Email Service
 *
 * Sends email via SMTP using nodemailer. Configure SMTP_HOST, SMTP_PORT,
 * SMTP_USER, SMTP_PASS, and SMTP_FROM in .env to enable live sending.
 * When SMTP_HOST is absent the send is skipped but the message is still
 * recorded in the database (useful for development / demo mode).
 *
 * Open/click tracking uses a unique trackingId stored per message.
 * The tracking pixel endpoint lives at /api/emails/track/[trackingId].
 */

import { prisma } from '@/lib/prisma'

// ─── Nodemailer transport ────────────────────────────────────────────────────

// nodemailer is imported dynamically inside sendViaSmtp so that webpack does not
// statically bundle it (and its Node.js built-in dependencies) during the build.

async function sendViaSmtp(opts: {
  to:           string
  from:         string
  subject:      string
  html:         string
  cc?:          string[]
  attachments?: Array<{ filename: string; content: Buffer }>
}): Promise<void> {
  if (!process.env.SMTP_HOST) {
    console.warn('[email-service] SMTP_HOST not set — skipping delivery (simulated mode).')
    return
  }
  const { default: nodemailer } = await import('nodemailer')
  const transporter = nodemailer.createTransport({
    host:   process.env.SMTP_HOST,
    port:   Number(process.env.SMTP_PORT ?? 587),
    secure: Number(process.env.SMTP_PORT ?? 587) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })
  await transporter.sendMail({
    from:        opts.from,
    to:          opts.to,
    cc:          opts.cc?.join(', '),
    subject:     opts.subject,
    html:        opts.html,
    attachments: opts.attachments,
  })
}

// ─── Template rendering ──────────────────────────────────────────────────────

/** Replace {{variable}} tokens in a template body */
export function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`)
}

// ─── Public API ─────────────────────────────────────────────────────────────

export type SendEmailInput = {
  contactId:    string
  subject:      string
  body:         string        // HTML
  toEmail:      string
  fromEmail?:   string
  ccEmails?:    string[]
  templateId?:  string
  sentById?:    string
  attachments?: Array<{ filename: string; content: Buffer }>
}

export async function sendEmail(input: SendEmailInput) {
  const fromEmail  = input.fromEmail ?? process.env.SMTP_FROM ?? 'noreply@example.com'
  const trackingId = globalThis.crypto.randomUUID()

  // Inject a 1×1 tracking pixel into the HTML body before the closing </body>
  const appUrl  = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const pixelHtml = `<img src="${appUrl}/api/emails/track/${trackingId}" width="1" height="1" style="display:none" alt="" />`
  const bodyWithTracking = input.body.includes('</body>')
    ? input.body.replace('</body>', `${pixelHtml}</body>`)
    : input.body + pixelHtml

  // Attempt delivery
  let status = 'sent'
  try {
    await sendViaSmtp({
      to:          input.toEmail,
      from:        fromEmail,
      subject:     input.subject,
      html:        bodyWithTracking,
      cc:          input.ccEmails,
      attachments: input.attachments,
    })
  } catch (err) {
    if (process.env.SMTP_HOST) {
      // SMTP is configured but delivery failed — flag it so it shows up as failed in the UI
      status = 'failed'
      console.error('[email-service] SMTP delivery failed:', err)
    }
    // else: simulated mode (no SMTP_HOST), keep status as 'sent'
  }

  return prisma.emailMessage.create({
    data: {
      contactId:  input.contactId,
      direction:  'outbound',
      status,
      subject:    input.subject,
      body:       input.body,
      fromEmail,
      toEmail:    input.toEmail,
      ccEmails:   input.ccEmails ? JSON.stringify(input.ccEmails) : null,
      templateId: input.templateId ?? null,
      trackingId,
      sentById:   input.sentById ?? null,
    },
    include: {
      contact:  { select: { firstName: true, lastName: true } },
      template: { select: { name: true } },
      sentBy:   { select: { name: true } },
    },
  })
}

export async function getEmailThread(contactId: string, opts?: { page?: number; pageSize?: number }) {
  const page     = opts?.page     ?? 1
  const pageSize = opts?.pageSize ?? 20

  const [total, data] = await Promise.all([
    prisma.emailMessage.count({ where: { contactId } }),
    prisma.emailMessage.findMany({
      where:   { contactId },
      orderBy: { sentAt: 'desc' },
      skip:    (page - 1) * pageSize,
      take:    pageSize,
      include: {
        template: { select: { name: true } },
        sentBy:   { select: { name: true } },
      },
    }),
  ])

  return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) }
}

/**
 * Record an email open event triggered by the tracking pixel.
 * Only updates openedAt on the first open; increments openCount every time.
 */
export async function recordEmailOpen(trackingId: string) {
  const msg = await prisma.emailMessage.findUnique({ where: { trackingId } })
  if (!msg) return null

  return prisma.emailMessage.update({
    where: { trackingId },
    data:  {
      openCount: { increment: 1 },
      openedAt:  msg.openedAt ?? new Date(),
    },
  })
}

/**
 * Record a tracked link click. Call this from a redirect endpoint that
 * intercepts clicks on links wrapped with the tracking URL scheme.
 */
export async function recordEmailClick(trackingId: string) {
  const msg = await prisma.emailMessage.findUnique({ where: { trackingId } })
  if (!msg) return null

  return prisma.emailMessage.update({
    where: { trackingId },
    data:  {
      clickCount: { increment: 1 },
      clickedAt:  msg.clickedAt ?? new Date(),
    },
  })
}
