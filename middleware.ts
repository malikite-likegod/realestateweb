import { NextResponse, type NextRequest } from 'next/server'
import { verifyJwt } from './lib/jwt'
import { isSecureContext } from './lib/auth'
import { publicSearchLimit, portalLimit, loginLimit, authLimit, forgotPassLimit, aiLimit, publicLeadLimit } from '@/lib/rate-limit'

// ── Blocked IP cache ────────────────────────────────────────────────────────
let blockedIpCache: { ips: Set<string>; refreshedAt: number } = {
  ips: new Set(),
  refreshedAt: 0,
}
const BLOCKED_IP_CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

async function getBlockedIps(): Promise<Set<string>> {
  if (Date.now() - blockedIpCache.refreshedAt < BLOCKED_IP_CACHE_TTL_MS) {
    return blockedIpCache.ips
  }

  const secret = process.env.INTERNAL_SECRET
  if (!secret) return blockedIpCache.ips

  blockedIpCache.refreshedAt = Date.now() // prevent thundering herd while refresh is in flight

  try {
    const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const res  = await fetch(`${base}/api/internal/blocked-ips`, {
      headers: { 'x-internal-secret': secret },
      signal:  AbortSignal.timeout(2000),
      cache:   'no-store',
    })
    if (res.ok) {
      const json: { ips: string[] } = await res.json()
      blockedIpCache = { ips: new Set(json.ips), refreshedAt: Date.now() }
    }
  } catch {
    // On fetch failure keep stale cache — never crash middleware
  }
  return blockedIpCache.ips
}

const PROTECTED_PATHS = ['/admin', '/api/contacts', '/api/deals', '/api/tasks',
  '/api/activities', '/api/listings', '/api/blog', '/api/stages', '/api/api-keys',
  '/api/admin', '/api/tags', '/api/uploads']

// Public listing detail pages: /listings/[id]
const LISTING_PATH_RE = /^\/listings\/([^/]+)$/

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ── Blocked IP check ───────────────────────────────────────────────────────
  const skipBlockPaths = [
    '/admin/login',
    '/api/auth/', // all auth routes (login, 2FA send/verify, etc.) — must be reachable even when blocked
    '/api/portal/login',
    // Note: /api/internal/* is excluded by the middleware matcher config — no need to list here
  ]
  const isBlockSkipped = skipBlockPaths.some(p => pathname.startsWith(p))

  if (!isBlockSkipped) {
    const clientIp =
      request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
      request.headers.get('x-real-ip') ??
      'unknown'
    // Normalize: strip leading zeros per octet
    const normalizedIp = clientIp
      .split('.')
      .map(p => { const n = parseInt(p, 10); return isNaN(n) ? p : String(n) })
      .join('.')
    const blocked = await getBlockedIps()
    if (blocked.has(normalizedIp)) {
      return NextResponse.json(
        { error: 'Your IP has been blocked.' },
        { status: 403 }
      )
    }
  }

  // ── Rate limiting ───────────────────────────────────────────────────────────
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim()
          ?? request.headers.get('x-real-ip')
          ?? 'unknown'

  if (pathname.startsWith('/api/search') || (pathname.startsWith('/api/listings') && request.method === 'GET')) {
    const { allowed, retryAfterMs } = await publicSearchLimit.check(ip)
    if (!allowed) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(retryAfterMs / 1000)) } }
      )
    }
  }

  if (pathname.startsWith('/api/portal/listings')) {
    const sessionId = request.cookies.get('contact_token')?.value ?? ip
    const { allowed, retryAfterMs } = await portalLimit.check(sessionId)
    if (!allowed) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(retryAfterMs / 1000)) } }
      )
    }
  }

  if (pathname === '/api/portal/login') {
    const { allowed, retryAfterMs } = await loginLimit.check(ip)
    if (!allowed) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(retryAfterMs / 1000)) } }
      )
    }
  }

  if (pathname === '/api/auth/login' || pathname === '/api/auth/2fa/verify') {
    const { allowed, retryAfterMs } = await authLimit.check(ip)
    if (!allowed) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(retryAfterMs / 1000)) } }
      )
    }
  }

  if (pathname === '/api/auth/forgot-password' || pathname === '/api/auth/reset-password') {
    const { allowed, retryAfterMs } = await forgotPassLimit.check(ip)
    if (!allowed) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(retryAfterMs / 1000)) } }
      )
    }
  }

  // AI routes — rate-limit per API key (falls back to IP if no Bearer header)
  if (pathname.startsWith('/api/ai/')) {
    const bearer = request.headers.get('authorization')
    const aiKey  = bearer?.startsWith('Bearer ') ? bearer.slice(7) : ip
    const { allowed, retryAfterMs } = await aiLimit.check(aiKey)
    if (!allowed) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(retryAfterMs / 1000)) } }
      )
    }
  }

  // Public lead-capture endpoints — rate-limit by IP to prevent CRM spam
  if (
    (pathname === '/api/contacts' && request.method === 'POST') ||
    pathname === '/api/gate/submit' ||
    (pathname.startsWith('/api/landing-pages/') && pathname.endsWith('/lead')) ||
    pathname.startsWith('/api/market-reports/') ||
    (pathname.startsWith('/api/book/') && request.method === 'POST')
  ) {
    const { allowed, retryAfterMs } = await publicLeadLimit.check(ip)
    if (!allowed) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(retryAfterMs / 1000)) } }
      )
    }
  }

  // ── Gate cookie logic (public listing pages only) ──────────────────────────
  const listingMatch = pathname.match(LISTING_PATH_RE)
  if (listingMatch) {
    // Ensure the visitor has an httpOnly session cookie.
    // View counts are now stored server-side in the GateView table keyed by
    // this session ID — the client can no longer tamper with the counter by
    // deleting or forging the old client-writable re_views cookie.
    let sessionId = request.cookies.get('re_session')?.value
    if (!sessionId) sessionId = crypto.randomUUID()

    const isVerified  = !!request.cookies.get('re_verified')?.value
    const isPending   = !!request.cookies.get('re_pending')?.value
    const adminToken  = request.cookies.get('auth_token')?.value
    const isAdminUser = adminToken ? !!(await verifyJwt(adminToken)) : false

    // IMPORTANT: To pass headers to the Server Component via `await headers()`,
    // we must mutate the *forwarded request headers* using NextResponse.next({ request }).
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-session-id', sessionId)
    if (isVerified || isAdminUser) requestHeaders.set('x-gate-bypass',  'true')
    if (isPending)                 requestHeaders.set('x-gate-pending', 'true')

    const response = NextResponse.next({ request: { headers: requestHeaders } })

    if (!request.cookies.get('re_session')?.value) {
      response.cookies.set('re_session', sessionId, {
        maxAge:   365 * 24 * 60 * 60,
        httpOnly: true,
        secure:   isSecureContext,
        sameSite: 'lax',
        path:     '/',
      })
    }

    return response
  }

  // ── Public lead-capture bypass ─────────────────────────────────────────────
  // POST /api/contacts is a public endpoint (contact form, lead capture).
  // The GET handler protects itself via getSession(); only POST needs to be open.
  if (pathname === '/api/contacts' && request.method === 'POST') {
    return NextResponse.next()
  }

  // ── Admin / API auth ────────────────────────────────────────────────────────
  const isProtected = PROTECTED_PATHS.some(p => pathname.startsWith(p))
  const isLoginFlow = pathname === '/admin/login' || pathname.startsWith('/admin/login/')

  if (!isProtected || isLoginFlow) {
    return NextResponse.next()
  }

  // Any protected API route accepts an API key in lieu of a session cookie.
  // Supported formats: Authorization: Bearer <key> | Authorization: <key> | x-api-key: <key>
  // The route handler validates the key via getSession() / validateApiKey().
  if (pathname.startsWith('/api/')) {
    const auth   = request.headers.get('authorization')
    const xKey   = request.headers.get('x-api-key')
    if (auth || xKey) {
      return NextResponse.next()
    }
  }

  // JWT cookie check
  const token = request.cookies.get('auth_token')?.value
  if (!token) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const url = request.nextUrl.clone()
    url.pathname = '/admin/login'
    return NextResponse.redirect(url)
  }

  const payload = await verifyJwt(token)
  if (!payload) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }
    const url = request.nextUrl.clone()
    url.pathname = '/admin/login'
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*', '/api/((?!internal/).*)', '/listings/:path*'],
}
