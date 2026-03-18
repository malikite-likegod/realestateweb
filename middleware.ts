import { NextResponse, type NextRequest } from 'next/server'
import { verifyJwt } from './lib/jwt'

const PROTECTED_PATHS = ['/admin', '/api/contacts', '/api/deals', '/api/tasks',
  '/api/activities', '/api/listings', '/api/blog', '/api/stages', '/api/api-keys',
  '/api/admin']

// Public listing detail pages: /listings/[id]
const LISTING_PATH_RE = /^\/listings\/([^/]+)$/

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ── Gate cookie logic (public listing pages only) ──────────────────────────
  const listingMatch = pathname.match(LISTING_PATH_RE)
  if (listingMatch) {
    const propertyId = listingMatch[1]

    // Ensure re_session exists
    let sessionId = request.cookies.get('re_session')?.value
    if (!sessionId) sessionId = crypto.randomUUID()

    // Read + update re_views (JSON array of property IDs)
    const isVerified = !!request.cookies.get('re_verified')?.value
    const isPending  = !!request.cookies.get('re_pending')?.value

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
    if (isVerified) requestHeaders.set('x-gate-bypass',  'true')
    if (isPending)  requestHeaders.set('x-gate-pending', 'true')

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
  matcher: ['/admin/:path*', '/api/:path*', '/listings/:path*'],
}
