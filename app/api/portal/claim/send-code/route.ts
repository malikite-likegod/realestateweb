import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { signPendingContactJwt } from '@/lib/jwt'
import { sendPhoneOtp } from '@/lib/communications/verification-service'
import { isSecureContext } from '@/lib/auth'

const schema = z.object({
  email: z.string().email(),
  phone: z.string().optional(), // required only when contact has no phone on file
})

export async function POST(request: Request) {
  try {
    const { email, phone } = schema.parse(await request.json())

    const contact = await prisma.contact.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: { id: true, phone: true, passwordHash: true },
    })

    // Return the same response regardless of whether the contact exists or has a
    // password — distinct error codes would allow enumeration of the contact DB.
    if (!contact || contact.passwordHash) {
      return NextResponse.json({ sent: true })
    }

    // If no phone on file, save the provided phone number
    if (!contact.phone) {
      if (!phone) {
        return NextResponse.json({ error: 'Phone number required' }, { status: 400 })
      }
      await prisma.contact.update({
        where: { id: contact.id },
        data:  { phone },
      })
    }

    await sendPhoneOtp(contact.id)

    const pendingToken = await signPendingContactJwt(contact.id)
    const response = NextResponse.json({ sent: true })
    response.cookies.set('contact_pending_token', pendingToken, {
      httpOnly: true,
      secure:   isSecureContext,
      sameSite: 'lax',
      maxAge:   60 * 15,
      path:     '/',
    })
    return response
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.errors }, { status: 400 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
