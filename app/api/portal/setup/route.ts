import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { signPendingContactJwt } from '@/lib/jwt'
import { sendPhoneOtp } from '@/lib/communications/verification-service'

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex')
}

const setupSchema = z.object({
  contactId: z.string().min(1),
  token:     z.string().min(1),
  password:  z.string().min(8),
  phone:     z.string().min(7),
  street:    z.string().min(1),
  city:      z.string().min(1),
  province:  z.string().min(1),
  postalCode:z.string().min(1),
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const data = setupSchema.parse(body)

    const contact = await prisma.contact.findUnique({
      where:  { id: data.contactId },
      select: {
        id:                  true,
        invitationTokenHash: true,
        invitationExpiresAt: true,
        accountStatus:       true,
      },
    })

    if (!contact || !contact.invitationTokenHash || !contact.invitationExpiresAt) {
      return NextResponse.json({ error: 'Invalid invitation' }, { status: 400 })
    }

    if (contact.invitationExpiresAt < new Date()) {
      return NextResponse.json({ error: 'Invitation has expired' }, { status: 400 })
    }

    const tokenHash = sha256(data.token)
    if (tokenHash !== contact.invitationTokenHash) {
      return NextResponse.json({ error: 'Invalid invitation' }, { status: 400 })
    }

    const passwordHash = await bcrypt.hash(data.password, 12)

    await prisma.contact.update({
      where: { id: contact.id },
      data: {
        passwordHash,
        passwordChangedAt:   new Date(),
        phone:               data.phone,
        address:             data.street,
        city:                data.city,
        province:            data.province,
        postalCode:          data.postalCode,
        accountStatus:       'invited',        // stays 'invited' until phone verified
        invitationTokenHash: null,             // single-use token cleared
        invitationExpiresAt: null,
      },
    })

    // Send SMS OTP
    await sendPhoneOtp(contact.id)

    // Issue short-lived pending cookie
    const pendingToken = await signPendingContactJwt(contact.id)
    const response = NextResponse.json({ message: 'Setup complete — OTP sent' })
    response.cookies.set('contact_pending_token', pendingToken, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge:   60 * 15, // 15 minutes
      path:     '/',
    })
    return response
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
