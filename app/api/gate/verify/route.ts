import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isSecureContext } from '@/lib/auth'

async function hashToken(token: string): Promise<string> {
  const data   = new TextEncoder().encode(token)
  const buffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function GET(request: NextRequest) {
  const rawToken = request.nextUrl.searchParams.get('token')

  if (!rawToken) {
    return NextResponse.redirect(new URL('/listings?gate_error=invalid', request.url))
  }

  const tokenHash = await hashToken(rawToken)
  const record    = await prisma.emailVerificationToken.findUnique({ where: { tokenHash } })

  if (!record || record.usedAt || record.expiresAt < new Date()) {
    return NextResponse.redirect(new URL('/listings?gate_error=expired', request.url))
  }

  // Mark token as used
  await prisma.emailVerificationToken.update({
    where: { tokenHash },
    data:  { usedAt: new Date() },
  })

  // Upsert contact — include phone on create; fill it in on update if not already set
  const existing = await prisma.contact.findUnique({ where: { email: record.email }, select: { id: true, phone: true } })
  const contact = await prisma.contact.upsert({
    where:  { email: record.email },
    update: existing?.phone ? {} : { phone: record.phone ?? null },
    create: {
      email:     record.email,
      firstName: record.firstName,
      lastName:  record.lastName,
      phone:     record.phone ?? null,
      source:    'web',
      status:    'lead',
    },
  })

  const returnUrl = record.returnUrl ?? '/listings'
  const response  = NextResponse.redirect(new URL(returnUrl, request.url))

  // Set verified cookie (Route Handler — cookie writes are permitted here)
  response.cookies.set('re_verified', contact.id, {
    maxAge:   365 * 24 * 60 * 60,
    httpOnly: true,
    secure:   isSecureContext,
    sameSite: 'lax',
    path:     '/',
  })
  // Clear pending cookie
  response.cookies.set('re_pending', '', { maxAge: 0, path: '/' })

  return response
}
