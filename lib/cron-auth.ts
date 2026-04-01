import { timingSafeEqual } from 'crypto'

/**
 * Constant-time secret comparison — prevents timing attacks against cron secrets.
 * Returns false if either argument is falsy or the buffers differ in length.
 *
 * Lives in its own file so it never gets bundled into the Edge Runtime
 * (middleware only imports lib/auth.ts for isSecureContext).
 */
export function verifySecret(provided: string | null, expected: string | undefined): boolean {
  if (!provided || !expected) return false
  try {
    const a = Buffer.from(provided)
    const b = Buffer.from(expected)
    if (a.length !== b.length) return false
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}
