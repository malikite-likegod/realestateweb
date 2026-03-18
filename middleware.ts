import { NextResponse, type NextRequest } from 'next/server'
import { verifyJwt } from './lib/jwt'

const PROTECTED_PATHS = ['/admin', '/api/contacts', '/api/deals', '/api/tasks',
  '/api/activities', '/api/listings', '/api/blog', '/api/stages', '/api/api-keys']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Check if path needs protection
  const isProtected = PROTECTED_PATHS.some(p => pathname.startsWith(p))
  const isLoginFlow = pathname === '/admin/login' || pathname.startsWith('/admin/login/')

  if (!isProtected || isLoginFlow) {
    // Redirect already-authenticated users away from login pages
    if (isLoginFlow) {
      const authToken = request.cookies.get('auth_token')?.value
      if (authToken) {
        const payload = await verifyJwt(authToken)
        if (payload) {
          const url = request.nextUrl.clone()
          url.pathname = '/admin/dashboard'
          return NextResponse.redirect(url)
        }
      }
    }
    return NextResponse.next()
  }

  // AI routes accept Bearer API key OR JWT
  if (pathname.startsWith('/api/ai/')) {
    const auth = request.headers.get('authorization')
    if (auth?.startsWith('Bearer ')) {
      // API key validation happens inside the route handler
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
  matcher: ['/admin/:path*', '/api/:path*'],
}
