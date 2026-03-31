/**
 * CSRF origin check for Next.js Route Handlers.
 *
 * Next.js Server Actions get automatic CSRF protection, but Route Handlers
 * do not. For state-changing public endpoints we verify that browser-sent
 * requests originate from our own domain.
 *
 * - If Origin is present and does NOT match NEXT_PUBLIC_SITE_URL → reject.
 * - If Origin is absent (server-to-server, curl, etc.) → allow.
 * - If NEXT_PUBLIC_SITE_URL is not set → allow (logs a warning in production).
 */
export function verifyCsrfOrigin(request: Request): boolean {
  const origin = request.headers.get('origin')
  if (!origin) return true  // non-browser request — no origin header present

  const allowed = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '')
  if (!allowed) {
    if (process.env.NODE_ENV === 'production') {
      console.warn('[csrf] NEXT_PUBLIC_SITE_URL not set — CSRF origin check skipped')
    }
    return true
  }

  return origin === allowed
}
