/**
 * POST /api/sms/webhook
 *
 * Twilio inbound SMS webhook. Twilio sends application/x-www-form-urlencoded.
 * Optionally validate the X-Twilio-Signature header for security (requires
 * TWILIO_AUTH_TOKEN to be set).
 *
 * Twilio expects a TwiML response (even an empty one) with Content-Type
 * text/xml to acknowledge receipt.
 */

import { NextResponse } from 'next/server'
import { parseTwilioWebhook, updateSmsStatus } from '@/lib/communications/sms-service'

export async function POST(request: Request) {
  try {
    const text = await request.text()
    const form = new URLSearchParams(text)

    // Twilio status-callback posts MessageStatus field
    const messageStatus = form.get('MessageStatus')
    const messageSid    = form.get('MessageSid')

    if (messageStatus && messageSid) {
      // Status update for an outbound message (delivered, failed, etc.)
      await updateSmsStatus(messageSid, messageStatus)
    } else {
      // Inbound message from a contact
      await parseTwilioWebhook(form)
    }

    // Return empty TwiML so Twilio does not send a reply automatically
    return new NextResponse('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
      status:  200,
      headers: { 'Content-Type': 'text/xml' },
    })
  } catch (error) {
    console.error('[POST /api/sms/webhook]', error)
    return new NextResponse('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
      status:  200,
      headers: { 'Content-Type': 'text/xml' },
    })
  }
}
