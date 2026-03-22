import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex')
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const contactId = searchParams.get('contactId')
  const token     = searchParams.get('token')

  if (!contactId || !token) {
    return NextResponse.json({ valid: false })
  }

  const contact = await prisma.contact.findUnique({
    where:  { id: contactId },
    select: {
      firstName:           true,
      invitationTokenHash: true,
      invitationExpiresAt: true,
      accountStatus:       true,
      phone:               true,
      address:             true,
      city:                true,
      province:            true,
      postalCode:          true,
      phones:              { select: { number: true }, orderBy: { createdAt: 'asc' }, take: 1 },
      addresses:           { select: { street: true, city: true, province: true, postalCode: true }, orderBy: { createdAt: 'asc' }, take: 1 },
    },
  })

  if (!contact || !contact.invitationTokenHash || !contact.invitationExpiresAt) {
    return NextResponse.json({ valid: false })
  }

  if (contact.invitationExpiresAt < new Date()) {
    return NextResponse.json({ valid: false, reason: 'expired' })
  }

  const tokenHash = sha256(token)
  if (tokenHash !== contact.invitationTokenHash) {
    return NextResponse.json({ valid: false })
  }

  // Prefill data for the setup form
  const prefillPhone = contact.phones[0]?.number ?? contact.phone ?? ''
  const prefillAddress = contact.addresses[0]
    ? {
        street:     contact.addresses[0].street   ?? '',
        city:       contact.addresses[0].city     ?? '',
        province:   contact.addresses[0].province ?? '',
        postalCode: contact.addresses[0].postalCode ?? '',
      }
    : {
        street:     contact.address   ?? '',
        city:       contact.city      ?? '',
        province:   contact.province  ?? '',
        postalCode: contact.postalCode ?? '',
      }

  return NextResponse.json({
    valid:    true,
    firstName: contact.firstName,
    prefill:  { phone: prefillPhone, address: prefillAddress },
  })
}
