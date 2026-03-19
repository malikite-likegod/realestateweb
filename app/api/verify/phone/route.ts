// app/api/verify/phone/route.ts
// Reads the phone session token from the HttpOnly cookie set by the email verify redirect.
// The POST body only carries the OTP code — no session token in the body (avoids IDOR).

import { NextRequest, NextResponse } from 'next/server'
import { verifyPhoneOtp } from '@/lib/communications/verification-service'

export async function POST(req: NextRequest) {
  const sessionToken = req.cookies.get('phone_session')?.value
  const body = await req.json().catch(() => null)
  const code: string | undefined = body?.code

  if (!sessionToken || !code) {
    return NextResponse.json({ error: 'invalid', message: 'Missing fields.' }, { status: 400 })
  }

  const result = await verifyPhoneOtp(sessionToken, code)

  const res = (() => {
    switch (result) {
      case 'verified':   return NextResponse.json({ success: true })
      case 'invalid':    return NextResponse.json({ error: 'invalid',   message: 'Incorrect code.' },     { status: 400 })
      case 'expired':    return NextResponse.json({ error: 'expired',   message: 'Code has expired.' },   { status: 410 })
      case 'locked':     return NextResponse.json({ error: 'locked',    message: 'Too many attempts.' },  { status: 429 })
      case 'not_found':  return NextResponse.json({ error: 'not_found', message: 'Session not found.' },  { status: 404 })
    }
  })()

  // Clear the cookie after use (regardless of result)
  res.cookies.delete('phone_session')
  return res
}
