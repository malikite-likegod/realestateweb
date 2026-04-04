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

import crypto from 'crypto'
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
  const port   = Number(process.env.SMTP_PORT ?? 587)
  const secure = port === 465

  let lastError: unknown
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise(r => setTimeout(r, attempt * 2000))
    try {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port,
        secure,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      })
      await transporter.sendMail({
        from:        opts.from,
        to:          opts.to,
        cc:          opts.cc?.join(', '),
        subject:     opts.subject,
        html:        opts.html,
        attachments: opts.attachments,
      })
      return
    } catch (err) {
      lastError = err
      const code = (err as { code?: string }).code
      // ETLS = transient STARTTLS refusal ("454 Try again later") — retry
      if (code !== 'ETLS') throw err
      console.warn(`[email-service] STARTTLS refused (attempt ${attempt + 1}/3), retrying…`)
    }
  }
  throw lastError
}

// ─── Template rendering ──────────────────────────────────────────────────────

/** Replace {{variable}} tokens in a template body */
export function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`)
}

/**
 * Resolve {{listing:MLSNUMBER:field}} tags in a template string.
 *
 * Supported fields: address | image | price | link
 *
 * Looks up each unique MLS# against both the internal Property table
 * (mlsNumber) and the RESO ResoProperty table (listingKey / listingId).
 * Internal listings take precedence when both share the same MLS#.
 */
export async function resolveListingTags(text: string): Promise<string> {
  const TAG_RE = /\{\{listing:([^:}]+):(\w+)\}\}/g
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''

  // Collect unique MLS numbers referenced in the template
  const mlsNumbers = new Set<string>()
  for (const [, mls] of text.matchAll(TAG_RE)) mlsNumbers.add(mls)
  if (mlsNumbers.size === 0) return text

  const mlsList = Array.from(mlsNumbers)

  // Load internal properties matching any of the MLS numbers
  const [internalProps, resoProps] = await Promise.all([
    prisma.property.findMany({
      where: { mlsNumber: { in: mlsList } },
      select: {
        id: true, mlsNumber: true,
        address: true, city: true, province: true, postalCode: true,
        price: true, images: true,
      },
    }),
    prisma.resoProperty.findMany({
      where: { OR: [{ listingKey: { in: mlsList } }, { listingId: { in: mlsList } }] },
      select: {
        id: true, listingKey: true, listingId: true,
        streetNumber: true, streetName: true, streetSuffix: true,
        unitNumber: true, city: true, stateOrProvince: true, postalCode: true,
        listPrice: true, media: true,
      },
    }),
  ])

  // Build a lookup map keyed by MLS# → resolved field values
  type ListingData = { address: string; image: string; price: string; link: string }
  const lookup = new Map<string, ListingData>()

  for (const p of resoProps) {
    const mls = mlsList.find(m => m === p.listingKey || m === p.listingId)
    if (!mls) continue

    const parts = [p.unitNumber, p.streetNumber, p.streetName, p.streetSuffix].filter(Boolean)
    const street = parts.join(' ')
    const address = [street, p.city, p.stateOrProvince, p.postalCode].filter(Boolean).join(', ')

    let image = ''
    try {
      const media = JSON.parse(p.media ?? '[]') as Array<{ url?: string; Order?: number }>
      const sorted = media.sort((a, b) => (a.Order ?? 0) - (b.Order ?? 0))
      image = sorted[0]?.url ?? ''
    } catch { /* leave empty */ }

    const price = p.listPrice != null
      ? `$${p.listPrice.toLocaleString('en-CA')}`
      : ''

    lookup.set(mls, {
      address,
      image,
      price,
      link: `${appUrl}/listings/${p.listingKey}`,
    })
  }

  // Internal properties overwrite RESO entries for the same MLS#
  for (const p of internalProps) {
    if (!p.mlsNumber) continue
    const address = [p.address, p.city, p.province, p.postalCode].filter(Boolean).join(', ')

    let image = ''
    try {
      const imgs = JSON.parse(p.images ?? '[]') as string[]
      image = imgs[0] ?? ''
    } catch { /* leave empty */ }

    lookup.set(p.mlsNumber, {
      address,
      image,
      price: `$${p.price.toLocaleString('en-CA')}`,
      link:  `${appUrl}/listings/${p.id}`,
    })
  }

  return text.replace(TAG_RE, (original, mls: string, field: string) => {
    const data = lookup.get(mls)
    if (!data) return original
    return (data as Record<string, string>)[field] ?? original
  })
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

  // Resolve merge-tag variables from the contact record
  const contact = await prisma.contact.findUnique({
    where:  { id: input.contactId },
    select: { firstName: true, lastName: true, email: true, phone: true, emailOptOut: true },
  })

  // Block delivery for opted-out contacts — record the attempt without sending
  if (contact?.emailOptOut) {
    return prisma.emailMessage.create({
      data: {
        contactId:  input.contactId,
        direction:  'outbound',
        status:     'opted_out',
        subject:    input.subject,
        body:       input.body,
        fromEmail,
        toEmail:    input.toEmail,
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

  // Load agent profile from siteSettings (falls back to env vars)
  const agentSettingKeys = ['agent_name','agent_designation','agent_bio','agent_phone','agent_brokerage','office_address','agent_email','agent_image','brand_logo']
  const agentRows = await prisma.siteSettings.findMany({ where: { key: { in: agentSettingKeys } } })
  const agentMap: Record<string, string> = {}
  for (const r of agentRows) agentMap[r.key] = r.value

  const mergeVars: Record<string, string> = {
    firstName:        contact?.firstName ?? '',
    lastName:         contact?.lastName  ?? '',
    fullName:         [contact?.firstName, contact?.lastName].filter(Boolean).join(' '),
    email:            contact?.email     ?? '',
    phone:            contact?.phone     ?? '',
    agentName:        agentMap['agent_name']        ?? process.env.AGENT_NAME  ?? '',
    agentEmail:       agentMap['agent_email']       ?? process.env.AGENT_EMAIL ?? process.env.SMTP_USER ?? '',
    agentPhone:       agentMap['agent_phone']       ?? process.env.AGENT_PHONE ?? '',
    agentDesignation: agentMap['agent_designation'] ?? '',
    agentBio:         agentMap['agent_bio']         ?? '',
    agentBrokerage:   agentMap['agent_brokerage']   ?? '',
    officeAddress:    agentMap['office_address']    ?? '',
    agentImage:       agentMap['agent_image']       ?? '',
    brandLogo:        agentMap['brand_logo']        ?? '',
    MONTH:            new Date().toLocaleString('en-CA', { month: 'long' }),
    YEAR:             String(new Date().getFullYear()),
  }
  const resolvedSubject = await resolveListingTags(renderTemplate(input.subject, mergeVars))
  const resolvedBody    = await resolveListingTags(renderTemplate(input.body,    mergeVars))

  // Inject a 1×1 tracking pixel into the HTML body before the closing </body>
  const appUrl  = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const pixelHtml = `<img src="${appUrl}/api/emails/track/${trackingId}" width="1" height="1" style="display:none" alt="" />`
  const bodyWithTracking = resolvedBody.includes('</body>')
    ? resolvedBody.replace('</body>', `${pixelHtml}</body>`)
    : resolvedBody + pixelHtml

  // Attempt delivery
  let status = 'sent'
  try {
    await sendViaSmtp({
      to:          input.toEmail,
      from:        fromEmail,
      subject:     resolvedSubject,
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
      subject:    resolvedSubject,
      body:       resolvedBody,
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

/**
 * Send a transactional system email (no contact record needed).
 * Used for password reset, 2FA codes, etc.
 * Throws on SMTP failure — callers that need silent failure (e.g. forgot-password)
 * must catch the error themselves. This keeps the helper generic.
 */
export async function sendTransactionalEmail(opts: {
  to: string
  subject: string
  html: string
}): Promise<void> {
  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER ?? 'noreply@example.com'
  await sendViaSmtp({ to: opts.to, from, subject: opts.subject, html: opts.html })
}

/**
 * Send a portal registration invitation to a contact.
 * Skipped silently if the contact has no email or already has an active account.
 * If previously invited, re-sends with a fresh token.
 *
 * Returns { skipped: true } when no invite was sent.
 */
export async function sendPortalInvite(contactId: string): Promise<{ skipped?: boolean }> {
  const contact = await prisma.contact.findUnique({
    where:  { id: contactId },
    select: { id: true, firstName: true, email: true, accountStatus: true },
  })

  if (!contact?.email)                       return { skipped: true }
  if (contact.accountStatus === 'active')    return { skipped: true }

  // Generate a fresh single-use invitation token (72-hour window)
  const rawToken  = crypto.randomBytes(32).toString('hex')
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')
  const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000)

  await prisma.contact.update({
    where: { id: contactId },
    data: {
      invitationTokenHash: tokenHash,
      invitationExpiresAt: expiresAt,
      accountStatus:       'invited',
    },
  })

  const appUrl    = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const inviteUrl = `${appUrl}/portal/invite/${rawToken}?contactId=${contactId}`
  const agentName = process.env.AGENT_NAME ?? 'Your Agent'

  const html = `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px">
      <h2 style="margin:0 0 12px;font-size:22px;color:#1a1a2e">You're invited to the Client Portal</h2>
      <p style="margin:0 0 8px;color:#555;line-height:1.6">Hi ${contact.firstName},</p>
      <p style="margin:0 0 24px;color:#555;line-height:1.6">
        ${agentName} has invited you to access the client portal, where you can browse all property listings — active and historical — and save your favourites.
      </p>
      <a href="${inviteUrl}"
         style="display:inline-block;background:#b8952a;color:#fff;font-weight:600;padding:14px 28px;border-radius:10px;text-decoration:none;font-size:16px">
        Set Up Your Account
      </a>
      <p style="margin:24px 0 0;font-size:13px;color:#999">
        This invitation expires in 72 hours. If you did not expect this invitation, you can safely ignore this email.
      </p>
    </div>
  `

  await sendTransactionalEmail({
    to:      contact.email,
    subject: `You're invited to the Client Portal`,
    html,
  })

  return {}
}
