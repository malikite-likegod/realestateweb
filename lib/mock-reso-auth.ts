import { createHmac } from 'crypto'

const SECRET = process.env.RESO_TOKEN_SECRET ?? 'dev-reso-secret'

function toBase64Url(s: string): string {
  return Buffer.from(s).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function hmacSign(payload: string): string {
  return createHmac('sha256', SECRET).update(payload).digest('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

export function createMockResoToken(): string {
  const payload = toBase64Url(JSON.stringify({ sub: 'mock-client', exp: Math.floor(Date.now() / 1000) + 3600 }))
  return `${payload}.${hmacSign(payload)}`
}

export function validateMockResoToken(request: Request): boolean {
  const auth = request.headers.get('authorization') ?? ''
  if (!auth.startsWith('Bearer ')) return false
  const token = auth.slice(7)
  const [payload, sig] = token.split('.')
  if (!payload || !sig) return false
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64').toString())
    if (!data.exp || data.exp < Math.floor(Date.now() / 1000)) return false
    // Simple string comparison is acceptable here — this is a mock for local dev only, not a security boundary
    return hmacSign(payload) === sig
  } catch {
    return false
  }
}
