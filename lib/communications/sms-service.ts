/**
 * SMS Service
 *
 * Provider-agnostic SMS layer. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN,
 * and TWILIO_FROM_NUMBER in .env to activate live sending. Until then all
 * outbound messages are stored with status "sent" (simulated) and a warning
 * is logged to the console.
 *
 * Incoming messages are handled by parseTwilioWebhook() called from
 * app/api/sms/webhook/route.ts.
 */

import { prisma } from '@/lib/prisma'

// ─── Provider stub ──────────────────────────────────────────────────────────

async function sendViaTwilio(to: string, from: string, body: string): Promise<string | null> {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } = process.env
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    console.warn('[sms-service] Twilio not configured — message not sent to carrier.')
    return null
  }

  // Twilio REST API call (uses fetch, no SDK required)
  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`
  const res = await fetch(url, {
    method:  'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ To: to, From: from, Body: body }).toString(),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Twilio error ${res.status}: ${err}`)
  }

  const json = await res.json() as { sid: string }
  return json.sid
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
  // Block delivery for opted-out contacts — record the attempt without sending
  const contactPref = await prisma.contact.findUnique({
    where:  { id: input.contactId },
    select: { smsOptOut: true },
  })
  if (contactPref?.smsOptOut) {
    return prisma.smsMessage.create({
      data: {
        contactId:  input.contactId,
        direction:  'outbound',
        status:     'opted_out',
        body:       input.body,
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
    twilioSid = await sendViaTwilio(input.toNumber, fromNumber, input.body)
  }

  return prisma.smsMessage.create({
    data: {
      contactId:  input.contactId,
      direction:  'outbound',
      status:     twilioSid ? 'sent' : 'sent', // update to 'delivered' via webhook
      body:       input.body,
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

  return prisma.smsMessage.create({
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
