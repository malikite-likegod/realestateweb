import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getContactSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const contact = await getContactSession()
  if (!contact) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const saved = await prisma.contactSavedListing.findMany({
    where:   { contactId: contact.id },
    include: {
      listing: {
        include: {
          property: {
            select: {
              id: true, title: true, status: true, price: true,
              bedrooms: true, bathrooms: true, sqft: true,
              address: true, city: true, province: true, postalCode: true,
              images: true,
            },
          },
        },
      },
    },
    orderBy: { savedAt: 'desc' },
  })

  return NextResponse.json({ data: saved.map(s => ({ ...s.listing, isSaved: true })) })
}

export async function POST(request: Request) {
  const contact = await getContactSession()
  if (!contact) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body      = await request.json()
  const { listingId } = z.object({ listingId: z.string() }).parse(body)

  await prisma.contactSavedListing.upsert({
    where:  { contactId_listingId: { contactId: contact.id, listingId } },
    create: { contactId: contact.id, listingId },
    update: {},
  })

  return NextResponse.json({ message: 'Saved' })
}
