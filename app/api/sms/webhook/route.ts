/**
 * POST /api/sms/webhook
 *
 * Twilio inbound SMS webhook. Twilio sends application/x-www-form-urlencoded.
 * Validates the X-Twilio-Signature header to reject spoofed requests.
 *
 * Required env vars:
 *   TWILIO_AUTH_TOKEN   — your Twilio auth token
 *   TWILIO_WEBHOOK_URL  — exact public URL Twilio is configured to call
 *                         e.g. https://yoursite.com/api/sms/webhook
 *
 * Twilio expects a TwiML response (even an empty one) with Content-Type
 * text/xml to acknowledge receipt.
 */

import { NextResponse } from 'next/server'
import twilio from 'twilio'
import { parseTwilioWebhook, updateSmsStatus } from '@/lib/communications/sms-service'

const TWIML_OK = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>'

function validateTwilioSignature(
  signature: string,
  url: string,
  params: Record<string, string>,
): boolean {
  const authToken = process.env.TWILIO_AUTH_TOKEN
  if (!authToken) {
    // No token configured — skip in development, block in production
    if (process.env.NODE_ENV === 'production') {
      console.error('[sms/webhook] TWILIO_AUTH_TOKEN not set — rejecting request in production')
      return false
    }
    return true
  }
  return twilio.validateRequest(authToken, signature, url, params)
}

export async function POST(request: Request) {
  try {
    const text      = await request.text()
    const signature = request.headers.get('x-twilio-signature') ?? ''
    const webhookUrl = process.env.TWILIO_WEBHOOK_URL

    if (!webhookUrl && process.env.NODE_ENV === 'production') {
      console.error('[sms/webhook] TWILIO_WEBHOOK_URL not set')
      return new NextResponse('Service misconfigured', { status: 500 })
    }

    const params = Object.fromEntries(new URLSearchParams(text))

    if (webhookUrl && !validateTwilioSignature(signature, webhookUrl, params)) {
      console.warn('[sms/webhook] Invalid Twilio signature — request rejected')
      return new NextResponse('Forbidden', { status: 403 })
    }

    const form = new URLSearchParams(text)
    const messageStatus = form.get('MessageStatus')
    const messageSid    = form.get('MessageSid')

    if (messageStatus && messageSid) {
      // Status update for an outbound message (delivered, failed, etc.)
      await updateSmsStatus(messageSid, messageStatus)
    } else {
      // Inbound message from a contact
      await parseTwilioWebhook(form)
    }

    return new NextResponse(TWIML_OK, {
      status:  200,
      headers: { 'Content-Type': 'text/xml' },
    })
  } catch (error) {
    console.error('[POST /api/sms/webhook]', error)
    return new NextResponse(TWIML_OK, {
      status:  200,
      headers: { 'Content-Type': 'text/xml' },
    })
  }
}
