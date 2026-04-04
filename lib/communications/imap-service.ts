/**
 * IMAP Inbox Sync
 *
 * Connects to the configured IMAP mailbox, fetches unseen messages,
 * matches each to a Contact by the sender's email address, and stores
 * them as direction:'inbound' EmailMessage records.
 *
 * Configure via env vars:
 *   IMAP_HOST   — e.g. imap.hostinger.com
 *   IMAP_PORT   — defaults to 993
 *   IMAP_USER   — full email address used to log in
 *   IMAP_PASS   — mailbox password
 *   IMAP_MAILBOX — folder to poll, defaults to INBOX
 *
 * The imapMessageId field on EmailMessage is used to deduplicate so
 * re-running sync never creates duplicate records.
 */

import { prisma } from '@/lib/prisma'
import { notifyInboundEmail } from '@/lib/notifications/admin-notify'

interface SyncResult {
  fetched:    number
  imported:   number
  skipped:    number
  unmatched:  number
}

export async function syncInbox(): Promise<SyncResult> {
  const host    = process.env.IMAP_HOST
  const port    = parseInt(process.env.IMAP_PORT ?? '993')
  const user    = process.env.IMAP_USER
  const pass    = process.env.IMAP_PASS
  const mailbox = process.env.IMAP_MAILBOX ?? 'INBOX'

  if (!host || !user || !pass) {
    throw new Error('IMAP not configured — set IMAP_HOST, IMAP_USER, and IMAP_PASS')
  }

  // Dynamic import so webpack doesn't bundle this for the browser
  const { ImapFlow } = await import('imapflow')

  const client = new ImapFlow({
    host,
    port,
    secure: port === 993,
    auth: { user, pass },
    logger: false,
  })

  let fetched   = 0
  let imported  = 0
  let skipped   = 0
  let unmatched = 0

  await client.connect()

  try {
    const lock = await client.getMailboxLock(mailbox)

    try {
      // Search for unseen messages — use UID mode throughout for stability
      const uids = await client.search({ seen: false }, { uid: true })
      if (!uids || uids.length === 0) {
        return { fetched: 0, imported: 0, skipped: 0, unmatched: 0 }
      }

      for await (const msg of client.fetch(uids, {
        envelope: true,
        bodyStructure: true,
        source: true,
      }, { uid: true })) {
        fetched++

        const envelope   = msg.envelope
        const messageId  = envelope?.messageId ?? null
        const subject    = envelope?.subject   ?? '(no subject)'
        const sentAt     = envelope?.date      ?? new Date()
        const fromAddr   = envelope?.from?.[0]
        const fromEmail  = fromAddr?.address   ?? null
        const fromName   = fromAddr?.name      ?? fromEmail ?? ''
        const toAddr     = envelope?.to?.[0]
        const toEmail    = toAddr?.address     ?? user

        // Skip emails sent by the system itself to prevent notification loops
        const systemEmails = [
          user,
          process.env.SMTP_FROM,
          process.env.SMTP_USER,
        ].filter(Boolean).map(e => e!.toLowerCase())
        if (fromEmail && systemEmails.includes(fromEmail.toLowerCase())) {
          await client.messageFlagsAdd(String(msg.uid), ['\\Seen'], { uid: true })
          skipped++
          continue
        }

        // Deduplicate by IMAP Message-ID
        if (messageId) {
          const existing = await prisma.emailMessage.findUnique({
            where: { imapMessageId: messageId },
          })
          if (existing) { skipped++; continue }
        }

        // Parse plain-text or HTML body from raw source
        let body = ''
        if (msg.source) {
          const raw = msg.source.toString('utf8')
          body = extractBody(raw)
        }

        // Match sender to a contact
        const contact = fromEmail
          ? await prisma.contact.findFirst({ where: { email: fromEmail } })
          : null

        if (!contact) unmatched++

        await prisma.emailMessage.create({
          data: {
            direction:    'inbound',
            status:       'sent',
            subject,
            body,
            fromEmail:    fromEmail ?? undefined,
            toEmail,
            sentAt,
            imapMessageId: messageId ?? undefined,
            contactId:    contact?.id ?? undefined,
          },
        })

        imported++

        // ── Anti-spam compliance: auto opt-out when contact sends "unsubscribe" ──
        if (contact && !contact.emailOptOut) {
          const lowerSubject = subject.toLowerCase()
          const lowerBody    = body.toLowerCase()
          if (lowerSubject.includes('unsubscribe') || lowerBody.includes('unsubscribe')) {
            await prisma.$transaction([
              prisma.contact.update({
                where: { id: contact.id },
                data:  { emailOptOut: true },
              }),
              prisma.communicationOptLog.create({
                data: {
                  contactId: contact.id,
                  channel:   'email',
                  action:    'opt_out',
                  reason:    'Auto opt-out: inbound email contained "unsubscribe"',
                },
              }),
            ])
          }
        }

        await notifyInboundEmail(contact, fromEmail ?? fromName, subject)

        // Mark as seen on the server
        await client.messageFlagsAdd(String(msg.uid), ['\\Seen'], { uid: true })
      }
    } finally {
      lock.release()
    }
  } finally {
    await client.logout()
  }

  return { fetched, imported, skipped, unmatched }
}

// ─── Body extraction ─────────────────────────────────────────────────────────

/**
 * Very lightweight RFC 2822 body extractor.
 * Prefers text/html parts; falls back to text/plain wrapped in <pre>.
 * For multipart messages it pulls the first readable part.
 */
function extractBody(raw: string): string {
  // Split headers from body
  const bodyStart = raw.indexOf('\r\n\r\n')
  if (bodyStart === -1) return raw

  const headers = raw.slice(0, bodyStart).toLowerCase()
  const body    = raw.slice(bodyStart + 4)

  // Multipart — find boundary
  const boundaryMatch = headers.match(/boundary="?([^"\r\n;]+)"?/)
  if (boundaryMatch) {
    const boundary = boundaryMatch[1]
    const parts    = body.split(`--${boundary}`)
    let htmlPart   = ''
    let textPart   = ''

    for (const part of parts) {
      const partHeaderEnd = part.indexOf('\r\n\r\n')
      if (partHeaderEnd === -1) continue
      const partHeaders = part.slice(0, partHeaderEnd).toLowerCase()
      const partBody    = part.slice(partHeaderEnd + 4).trim()

      if (partHeaders.includes('text/html'))       htmlPart = partBody
      else if (partHeaders.includes('text/plain')) textPart = partBody
    }

    if (htmlPart) return decodeTransferEncoding(headers, htmlPart)
    if (textPart) return `<pre>${escapeHtml(decodeTransferEncoding(headers, textPart))}</pre>`
  }

  // Single-part
  if (headers.includes('text/html'))  return decodeTransferEncoding(headers, body)
  if (headers.includes('text/plain')) return `<pre>${escapeHtml(decodeTransferEncoding(headers, body))}</pre>`

  return `<pre>${escapeHtml(body)}</pre>`
}

function decodeTransferEncoding(headers: string, body: string): string {
  if (headers.includes('base64')) {
    try { return Buffer.from(body.replace(/\s/g, ''), 'base64').toString('utf8') } catch { return body }
  }
  if (headers.includes('quoted-printable')) {
    return body
      .replace(/=\r?\n/g, '')
      .replace(/=([A-Fa-f0-9]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
  }
  return body
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
