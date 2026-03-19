/**
 * ZeroBounce email validation client.
 * Set ZEROBOUNCE_API_KEY in .env to enable.
 * Returns 'unknown' (pass-through) when not configured or on any error.
 */

export type EmailValidationResult = 'valid' | 'invalid' | 'unknown'

const INVALID_STATUSES = new Set(['invalid', 'abuse', 'disposable', 'spamtrap'])

export async function validateEmail(email: string): Promise<EmailValidationResult> {
  const apiKey = process.env.ZEROBOUNCE_API_KEY
  if (!apiKey) return 'unknown'

  try {
    const url = `https://api.zerobounce.net/v2/validate?api_key=${encodeURIComponent(apiKey)}&email=${encodeURIComponent(email)}`
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
    if (!res.ok) {
      console.warn(`[zerobounce] API returned ${res.status} — failing open`)
      return 'unknown'
    }
    const data = await res.json() as { status: string }
    if (INVALID_STATUSES.has(data.status)) return 'invalid'
    if (data.status === 'valid') return 'valid'
    return 'unknown'
  } catch (err) {
    console.warn('[zerobounce] Request failed — failing open:', err)
    return 'unknown'
  }
}
