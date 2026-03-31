import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { sendVerificationEmail } from '@/lib/gate-email'
import { isSecureContext } from '@/lib/auth'

const schema = z.object({
  firstName: z.string().min(1),
  lastName:  z.string().min(1),
  email:     z.string().email(),
  phone:     z.string().min(1),
  returnUrl: z.string().optional(),
})

export async function POST(request: Request) {
  // Parse and validate first — return 400 on bad input
  let data: z.infer<typeof schema>
  try {
    const body = await request.json()
    data = schema.parse(body)
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const cookieStore = await cookies()
  const sessionId   = cookieStore.get('re_session')?.value ?? 'unknown'

  // Generate a secure random token and write to DB
  const rawToken  = crypto.randomUUID() + crypto.randomUUID()
  const tokenHash = await hashToken(rawToken)
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)

  await prisma.emailVerificationToken.create({
    data: {
      email:     data.email,
      firstName: data.firstName,
      lastName:  data.lastName,
      phone:     data.phone,
      tokenHash,
      sessionId,
      returnUrl: data.returnUrl ?? '/listings',
      expiresAt,
    },
  })

  // Send email — return 500 if SMTP is configured but fails
  // (token is already in DB; resend is available)
  try {
    await sendVerificationEmail({
      to:        data.email,
      firstName: data.firstName,
      token:     rawToken,
      returnUrl: data.returnUrl ?? '/listings',
    })
  } catch {
    return NextResponse.json({ error: 'Failed to send verification email. Please try again.' }, { status: 500 })
  }

  // Set re_pending cookie so listing pages show "waiting" overlay
  const response = NextResponse.json({ success: true })
  response.cookies.set('re_pending', data.email, {
    httpOnly: true,
    secure:   isSecureContext,
    sameSite: 'lax',
    path:     '/',
    // session cookie (no maxAge)
  })
  return response
}

async function hashToken(token: string): Promise<string> {
  const data   = new TextEncoder().encode(token)
  const buffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('')
}
