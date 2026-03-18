import { type NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const url = new URL('/admin/login', request.url)
  const response = NextResponse.redirect(url)
  response.cookies.set('pending_token', '', { maxAge: 0, path: '/', httpOnly: true, sameSite: 'lax' })
  return response
}
