import type { AiWebhookEvent, AiWebhookPayload } from '@/types'

// Webhook URLs can be stored in DB or env. For now support env-based config.
const WEBHOOK_URLS = (process.env.OPENCLAW_WEBHOOK_URLS ?? '').split(',').filter(Boolean)
const WEBHOOK_SECRET = process.env.OPENCLAW_WEBHOOK_SECRET ?? ''

async function signPayload(payload: string): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', encoder.encode(WEBHOOK_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(payload))
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function sendWebhook(event: AiWebhookEvent, data: Record<string, unknown>): Promise<void> {
  if (WEBHOOK_URLS.length === 0) return

  const webhookPayload: AiWebhookPayload = {
    event,
    timestamp: new Date().toISOString(),
    data,
  }

  const body = JSON.stringify(webhookPayload)
  const signature = WEBHOOK_SECRET ? await signPayload(body) : ''

  const sends = WEBHOOK_URLS.map(url =>
    fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Event': event,
        ...(signature && { 'X-Webhook-Signature': signature }),
      },
      body,
    }).catch(e => console.error(`[Webhook] Failed to send to ${url}:`, e))
  )

  await Promise.allSettled(sends)
}
