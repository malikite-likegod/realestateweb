/**
 * Mock auth for local development — validates Bearer token against the three
 * AMPRE env vars. No HMAC, no expiry. Not a security boundary.
 */
export function validateMockToken(request: Request): boolean {
  const auth = request.headers.get('authorization') ?? ''
  if (!auth.startsWith('Bearer ')) return false
  const token = auth.slice(7)
  const valid = [
    process.env.AMPRE_IDX_TOKEN ?? 'mock-idx-token',
    process.env.AMPRE_DLA_TOKEN ?? 'mock-dla-token',
    process.env.AMPRE_VOX_TOKEN ?? 'mock-vox-token',
  ]
  return valid.includes(token)
}
