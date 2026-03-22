import { NextResponse } from 'next/server'
import { getContactSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const contact = await getContactSession()
  if (!contact) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const listing = await prisma.listing.findUnique({
    where:   { id },
    include: {
      property: {
        select: {
          id: true, title: true, status: true, price: true,
          bedrooms: true, bathrooms: true, sqft: true,
          address: true, city: true, province: true, postalCode: true,
          images: true, listedAt: true, soldAt: true,
        },
      },
      savedByContacts: {
        where:  { contactId: contact.id },
        select: { id: true },
      },
    },
  })

  if (!listing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (listing.property.status === 'draft') return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({
    data: {
      ...listing,
      isSaved: listing.savedByContacts.length > 0,
      savedByContacts: undefined,
    },
  })
}
