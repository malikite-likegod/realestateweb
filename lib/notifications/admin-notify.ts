/**
 * Admin notification emails.
 *
 * Sends a plain HTML email to the agent/admin address stored in SiteSettings
 * (key = 'agentEmail'). Falls back to SMTP_FROM if not set.
 * Silently no-ops when SMTP is not configured — never throws.
 */

import { prisma } from '@/lib/prisma'

async function getAdminEmail(): Promise<string | null> {
  const row = await prisma.siteSettings.findUnique({ where: { key: 'agentEmail' } })
  return row?.value || process.env.SMTP_FROM || null
}

async function send(subject: string, html: string): Promise<void> {
  if (!process.env.SMTP_HOST) return

  const to = await getAdminEmail()
  if (!to) return

  try {
    const { default: nodemailer } = await import('nodemailer')
    const transporter = nodemailer.createTransport({
      host:   process.env.SMTP_HOST,
      port:   Number(process.env.SMTP_PORT ?? 587),
      secure: Number(process.env.SMTP_PORT ?? 587) === 465,
      auth:   { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    })
    await transporter.sendMail({
      from:    process.env.SMTP_FROM ?? to,
      to,
      subject,
      html,
    })
  } catch (e) {
    // Notification failure must never break the triggering operation
    console.error('[admin-notify] Failed to send notification:', e)
  }
}

function adminUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? ''
  return `${base}${path}`
}

// ─── Event helpers ───────────────────────────────────────────────────────────

export async function notifyNewContact(contact: {
  id: string; firstName: string | null; lastName: string | null; email: string | null; phone: string | null; source: string | null
}) {
  const name = [contact.firstName, contact.lastName].filter(Boolean).join(' ') || 'Unknown'
  await send(
    `New contact: ${name}`,
    `<p>A new contact has been added to your CRM.</p>
     <table style="border-collapse:collapse;font-size:14px">
       <tr><td style="padding:4px 12px 4px 0;color:#666">Name</td><td><strong>${name}</strong></td></tr>
       ${contact.email ? `<tr><td style="padding:4px 12px 4px 0;color:#666">Email</td><td>${contact.email}</td></tr>` : ''}
       ${contact.phone ? `<tr><td style="padding:4px 12px 4px 0;color:#666">Phone</td><td>${contact.phone}</td></tr>` : ''}
       ${contact.source ? `<tr><td style="padding:4px 12px 4px 0;color:#666">Source</td><td>${contact.source}</td></tr>` : ''}
     </table>
     <p><a href="${adminUrl(`/admin/contacts/${contact.id}`)}">View contact →</a></p>`,
  )
}

export async function notifyInboundSms(contact: {
  id: string; firstName: string | null; lastName: string | null
} | null, from: string, body: string) {
  const name = contact
    ? [contact.firstName, contact.lastName].filter(Boolean).join(' ') || from
    : from
  await send(
    `New SMS from ${name}`,
    `<p><strong>${name}</strong> sent you a message:</p>
     <blockquote style="border-left:3px solid #d97706;padding:8px 16px;color:#444;margin:12px 0">${body}</blockquote>
     ${contact ? `<p><a href="${adminUrl(`/admin/contacts/${contact.id}`)}">View conversation →</a></p>` : ''}`,
  )
}

export async function notifyInboundEmail(contact: {
  id: string; firstName: string | null; lastName: string | null
} | null, from: string, subject: string) {
  const name = contact
    ? [contact.firstName, contact.lastName].filter(Boolean).join(' ') || from
    : from
  await send(
    `New email from ${name}`,
    `<p><strong>${name}</strong> (${from}) replied to you.</p>
     <p>Subject: <strong>${subject}</strong></p>
     ${contact ? `<p><a href="${adminUrl(`/admin/contacts/${contact.id}`)}">View email →</a></p>` : ''}`,
  )
}

export async function notifyHotLead(contactId: string, name: string, newScore: number) {
  await send(
    `🔥 Hot lead: ${name} (score ${newScore})`,
    `<p><strong>${name}</strong> is now a hot lead with a score of <strong>${newScore}/100</strong>.</p>
     <p>They may be ready to act — reach out now.</p>
     <p><a href="${adminUrl(`/admin/contacts/${contactId}`)}">View contact →</a></p>`,
  )
}
