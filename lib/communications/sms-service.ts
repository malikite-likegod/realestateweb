/**
 * SMS Service
 *
 * Uses the official Twilio Node.js SDK. Supports two auth methods:
 *   - API Key (preferred): set TWILIO_ACCOUNT_SID + TWILIO_API_KEY + TWILIO_API_SECRET
 *   - Auth Token (fallback): set TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN
 *
 * Also set TWILIO_FROM_NUMBER to activate live sending.
 *
 * Incoming messages are handled by parseTwilioWebhook() called from
 * app/api/sms/webhook/route.ts.
 */

import twilio from 'twilio'
import { prisma } from '@/lib/prisma'
import { createNotification } from '@/lib/notifications'
import { renderTemplate } from '@/lib/communications/email-service'

// ─── Twilio client ───────────────────────────────────────────────────────────

function getTwilioClient() {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_API_KEY, TWILIO_API_SECRET } = process.env
  if (!TWILIO_ACCOUNT_SID) return null

  // API Key auth: twilio(apiKeySid, apiKeySecret, { accountSid })
  if (TWILIO_API_KEY && TWILIO_API_SECRET) {
    return twilio(TWILIO_API_KEY, TWILIO_API_SECRET, { accountSid: TWILIO_ACCOUNT_SID })
  }

  // Auth Token fallback: twilio(accountSid, authToken)
  if (TWILIO_AUTH_TOKEN) {
    return twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
  }

  return null
}

async function sendViaTwilio(to: string, from: string, body: string): Promise<string | null> {
  const client = getTwilioClient()
  if (!client) {
    console.warn('[sms-service] Twilio not configured — message not sent to carrier.')
    return null
  }

  const message = await client.messages.create({ to, from, body })
  return message.sid
}

// ─── Public API ─────────────────────────────────────────────────────────────

export type SendSmsInput = {
  contactId: string
  body: string
  toNumber: string
  sentById?: string
  groupId?: string     // optional: link into a group-text broadcast
  mediaUrls?: string[] // optional MMS attachments
}

export async function sendSms(input: SendSmsInput) {
  // Fetch contact for opt-out check and merge-tag resolution
  const contact = await prisma.contact.findUnique({
    where:  { id: input.contactId },
    select: { firstName: true, lastName: true, email: true, phone: true, smsOptOut: true },
  })

  // Resolve {{merge tags}} in the body using contact and agent data
  const mergeVars: Record<string, string> = {
    firstName:  contact?.firstName ?? '',
    lastName:   contact?.lastName  ?? '',
    fullName:   [contact?.firstName, contact?.lastName].filter(Boolean).join(' '),
    email:      contact?.email     ?? '',
    phone:      contact?.phone     ?? '',
    agentName:  process.env.AGENT_NAME  ?? '',
    agentEmail: process.env.AGENT_EMAIL ?? '',
    agentPhone: process.env.AGENT_PHONE ?? '',
  }
  const resolvedBody = renderTemplate(input.body, mergeVars)

  // Block delivery for opted-out contacts — record the attempt without sending
  if (contact?.smsOptOut) {
    return prisma.smsMessage.create({
      data: {
        contactId:  input.contactId,
        direction:  'outbound',
        status:     'opted_out',
        body:       resolvedBody,
        fromNumber: process.env.TWILIO_FROM_NUMBER ?? null,
        toNumber:   input.toNumber,
        sentById:   input.sentById ?? null,
        groupId:    input.groupId  ?? null,
      },
      include: {
        contact: { select: { firstName: true, lastName: true } },
        sentBy:  { select: { name: true } },
      },
    })
  }

  const fromNumber = process.env.TWILIO_FROM_NUMBER ?? null

  let twilioSid: string | null = null
  if (fromNumber && input.toNumber) {
    twilioSid = await sendViaTwilio(input.toNumber, fromNumber, resolvedBody)
  }

  return prisma.smsMessage.create({
    data: {
      contactId:  input.contactId,
      direction:  'outbound',
      status:     'sent', // updated to 'delivered' via Twilio status-callback webhook
      body:       resolvedBody,
      fromNumber: fromNumber,
      toNumber:   input.toNumber,
      mediaUrls:  input.mediaUrls ? JSON.stringify(input.mediaUrls) : null,
      groupId:    input.groupId ?? null,
      twilioSid:  twilioSid,
      sentById:   input.sentById ?? null,
    },
    include: { contact: { select: { firstName: true, lastName: true } }, sentBy: { select: { name: true } } },
  })
}

export async function getSmsThread(contactId: string, opts?: { page?: number; pageSize?: number }) {
  const page     = opts?.page     ?? 1
  const pageSize = opts?.pageSize ?? 50

  const [total, data] = await Promise.all([
    prisma.smsMessage.count({ where: { contactId } }),
    prisma.smsMessage.findMany({
      where:   { contactId },
      orderBy: { sentAt: 'asc' },
      skip:    (page - 1) * pageSize,
      take:    pageSize,
      include: { sentBy: { select: { name: true } } },
    }),
  ])

  return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) }
}

/**
 * Handle an inbound Twilio SMS webhook.
 * Twilio sends a URL-encoded POST with From, To, Body, MessageSid, etc.
 */
export async function parseTwilioWebhook(form: URLSearchParams) {
  const from      = form.get('From')  ?? ''
  const to        = form.get('To')    ?? ''
  const body      = form.get('Body')  ?? ''
  const sid       = form.get('MessageSid') ?? null
  const mediaUrls = collectMediaUrls(form)

  // Try to match the sender's number to an existing contact
  const contact = from
    ? await prisma.contact.findFirst({ where: { phone: from } })
    : null

  const message = await prisma.smsMessage.create({
    data: {
      contactId:  contact?.id ?? null,
      direction:  'inbound',
      status:     'received',
      body,
      fromNumber: from,
      toNumber:   to,
      mediaUrls:  mediaUrls.length ? JSON.stringify(mediaUrls) : null,
      twilioSid:  sid,
      groupId:    null,
    },
  })

  const contactName = contact
    ? `${contact.firstName} ${contact.lastName}`.trim()
    : from || 'Unknown'
  await createNotification({
    type:      'inbound_sms',
    title:     `New SMS from ${contactName}`,
    body:      body.length > 100 ? body.slice(0, 97) + '…' : body,
    contactId: contact?.id ?? null,
  })

  return message
}

/** Extract Twilio MMS media URLs from webhook form data */
function collectMediaUrls(form: URLSearchParams): string[] {
  const urls: string[] = []
  let i = 0
  while (form.has(`MediaUrl${i}`)) {
    urls.push(form.get(`MediaUrl${i}`)!)
    i++
  }
  return urls
}

/** Update delivery status from a Twilio status-callback webhook */
export async function updateSmsStatus(twilioSid: string, status: string) {
  const mapped =
    status === 'delivered' ? 'delivered' :
    status === 'failed'    ? 'failed'    :
    status === 'sent'      ? 'sent'      : 'sent'

  return prisma.smsMessage.updateMany({
    where: { twilioSid },
    data:  { status: mapped },
  })
}

/** Send a group-text to multiple contacts sharing the same broadcast ID */
export async function sendGroupSms(opts: {
  contactIds: string[]
  body:       string
  sentById?:  string
}) {
  const groupId = globalThis.crypto.randomUUID()
  const contacts = await prisma.contact.findMany({
    where: { id: { in: opts.contactIds }, phone: { not: null } },
    select: { id: true, phone: true },
  })

  const results = await Promise.allSettled(
    contacts.map(c =>
      sendSms({ contactId: c.id, body: opts.body, toNumber: c.phone!, sentById: opts.sentById, groupId }),
    ),
  )

  return { groupId, results }
}
