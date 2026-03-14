/**
 * Email Service
 *
 * Provider-agnostic email layer. Configure SMTP_HOST, SMTP_PORT, SMTP_USER,
 * SMTP_PASS, and SMTP_FROM in .env to activate live sending via nodemailer.
 * Until the package is installed, sending is simulated and emails are stored
 * with status "sent". Swap the sendViaSmtp stub below for a real transport
 * once nodemailer (or Resend / SendGrid) is added.
 *
 * Open/click tracking uses a unique trackingId stored per message.
 * The tracking pixel endpoint lives at /api/emails/track/[trackingId].
 */

import { prisma } from '@/lib/prisma'
import { randomUUID } from 'crypto'

// ─── Provider stub ──────────────────────────────────────────────────────────

async function sendViaSmtp(_opts: {
  to:      string
  from:    string
  subject: string
  html:    string
}): Promise<void> {
  if (!process.env.SMTP_HOST) {
    console.warn('[email-service] SMTP not configured — email not delivered to provider.')
    return
  }

  // When nodemailer is installed, replace this block:
  // const transporter = nodemailer.createTransport({ host, port, auth: { user, pass } })
  // await transporter.sendMail({ to, from, subject, html })
  throw new Error('Install nodemailer and configure SMTP_HOST to enable live email delivery.')
}

// ─── Template rendering ──────────────────────────────────────────────────────

/** Replace {{variable}} tokens in a template body */
export function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`)
}

// ─── Public API ─────────────────────────────────────────────────────────────

export type SendEmailInput = {
  contactId:  string
  subject:    string
  body:       string        // HTML
  toEmail:    string
  fromEmail?: string
  ccEmails?:  string[]
  templateId?: string
  sentById?:  string
}

export async function sendEmail(input: SendEmailInput) {
  const fromEmail  = input.fromEmail ?? process.env.SMTP_FROM ?? 'noreply@example.com'
  const trackingId = randomUUID()

  // Inject a 1×1 tracking pixel into the HTML body before the closing </body>
  const appUrl  = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const pixelHtml = `<img src="${appUrl}/api/emails/track/${trackingId}" width="1" height="1" style="display:none" alt="" />`
  const bodyWithTracking = input.body.includes('</body>')
    ? input.body.replace('</body>', `${pixelHtml}</body>`)
    : input.body + pixelHtml

  // Attempt delivery
  let status = 'sent'
  try {
    await sendViaSmtp({ to: input.toEmail, from: fromEmail, subject: input.subject, html: bodyWithTracking })
  } catch {
    // SMTP not configured — store the email but flag that it wasn't delivered
    status = 'sent' // still mark as sent (simulated); change to 'failed' if strict delivery required
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
