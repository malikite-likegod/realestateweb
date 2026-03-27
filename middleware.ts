import { NextResponse, type NextRequest } from 'next/server'
import { verifyJwt } from './lib/jwt'
import { publicSearchLimit, portalLimit, loginLimit, authLimit, forgotPassLimit } from '@/lib/rate-limit'

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
    '/api/auth/login',
    '/api/auth/2fa/verify',
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
    const { allowed, retryAfterMs } = publicSearchLimit.check(ip)
    if (!allowed) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(retryAfterMs / 1000)) } }
      )
    }
  }

  if (pathname.startsWith('/api/portal/listings')) {
    const sessionId = request.cookies.get('contact_token')?.value ?? ip
    const { allowed, retryAfterMs } = portalLimit.check(sessionId)
    if (!allowed) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(retryAfterMs / 1000)) } }
      )
    }
  }

  if (pathname === '/api/portal/login') {
    const { allowed, retryAfterMs } = loginLimit.check(ip)
    if (!allowed) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(retryAfterMs / 1000)) } }
      )
    }
  }

  if (pathname === '/api/auth/login' || pathname === '/api/auth/2fa/verify') {
    const { allowed, retryAfterMs } = authLimit.check(ip)
    if (!allowed) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(retryAfterMs / 1000)) } }
      )
    }
  }

  if (pathname === '/api/auth/forgot-password' || pathname === '/api/auth/reset-password') {
    const { allowed, retryAfterMs } = forgotPassLimit.check(ip)
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
    const propertyId = listingMatch[1]

    // Ensure re_session exists
    let sessionId = request.cookies.get('re_session')?.value
    if (!sessionId) sessionId = crypto.randomUUID()

    // Read + update re_views (JSON array of property IDs)
    const isVerified  = !!request.cookies.get('re_verified')?.value
    const isPending   = !!request.cookies.get('re_pending')?.value
    const adminToken  = request.cookies.get('auth_token')?.value
    const isAdminUser = adminToken ? !!(await verifyJwt(adminToken)) : false

    let views: string[] = []
    try {
      views = JSON.parse(request.cookies.get('re_views')?.value ?? '[]')
      if (!Array.isArray(views)) views = []
    } catch { views = [] }

    if (!views.includes(propertyId)) views.push(propertyId)

    // IMPORTANT: To pass headers to the Server Component via `await headers()`,
    // we must mutate the *forwarded request headers* using NextResponse.next({ request }).
    // Setting headers on response.headers sends them to the browser, NOT the Server Component.
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-view-count', String(views.length))
    requestHeaders.set('x-session-id', sessionId)
    if (isVerified || isAdminUser) requestHeaders.set('x-gate-bypass',  'true')
    if (isPending)                 requestHeaders.set('x-gate-pending', 'true')

    const response = NextResponse.next({ request: { headers: requestHeaders } })

    // Set cookies on the response (written to browser)
    if (!request.cookies.get('re_session')?.value) {
      response.cookies.set('re_session', sessionId, {
        maxAge:   365 * 24 * 60 * 60,
        httpOnly: true,
        sameSite: 'lax',
        path:     '/',
      })
    }

    // Always write updated re_views if the array changed
    const originalViews = request.cookies.get('re_views')?.value ?? '[]'
    if (JSON.stringify(views) !== originalViews) {
      response.cookies.set('re_views', JSON.stringify(views), {
        maxAge:   30 * 24 * 60 * 60,
        sameSite: 'lax',
        path:     '/',
      })
    }

    return response
  }

  // ── Admin / API auth ────────────────────────────────────────────────────────
  const isProtected = PROTECTED_PATHS.some(p => pathname.startsWith(p))
  const isLoginFlow = pathname === '/admin/login' || pathname.startsWith('/admin/login/')

  if (!isProtected || isLoginFlow) {
    return NextResponse.next()
  }

  // AI routes accept Bearer API key OR JWT
  if (pathname.startsWith('/api/ai/')) {
    const auth = request.headers.get('authorization')
    if (auth?.startsWith('Bearer ')) {
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
