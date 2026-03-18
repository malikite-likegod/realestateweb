import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { sendVerificationEmail } from '@/lib/gate-email'

const schema = z.object({ email: z.string().email() })

export async function POST(request: Request) {
  try {
    const body      = await request.json()
    const { email } = schema.parse(body)
    const cookieStore = await cookies()
    const sessionId = cookieStore.get('re_session')?.value ?? 'unknown'

    // Rate limit: one resend per 60 seconds per (email, sessionId)
    const recent = await prisma.emailVerificationToken.findFirst({
      where:   { email, sessionId },
      orderBy: { createdAt: 'desc' },
    })
    if (recent) {
      const elapsed = Date.now() - recent.createdAt.getTime()
      if (elapsed < 60_000) {
        return NextResponse.json({ error: 'Please wait before resending' }, { status: 429 })
      }
    }

    if (!recent) {
      return NextResponse.json({ error: 'No pending verification found' }, { status: 404 })
    }

    // Create a new token
    const rawToken  = crypto.randomUUID() + crypto.randomUUID()
    const tokenHash = await hashToken(rawToken)
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)

    await prisma.emailVerificationToken.create({
      data: {
        email,
        firstName: recent.firstName,
        lastName:  recent.lastName,
        tokenHash,
        sessionId,
        returnUrl: recent.returnUrl,
        expiresAt,
      },
    })

    await sendVerificationEmail({
      to:        email,
      firstName: recent.firstName,
      token:     rawToken,
      returnUrl: recent.returnUrl ?? '/listings',
    })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}

async function hashToken(token: string): Promise<string> {
  const data   = new TextEncoder().encode(token)
  const buffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('')
}
