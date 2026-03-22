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

  try {
    const body = await request.json()
    const { listingId } = z.object({ listingId: z.string().min(1) }).parse(body)

    // Verify the listing exists before upserting
    const listing = await prisma.listing.findUnique({ where: { id: listingId }, select: { id: true } })
    if (!listing) return NextResponse.json({ error: 'Listing not found' }, { status: 404 })

    await prisma.contactSavedListing.upsert({
      where:  { contactId_listingId: { contactId: contact.id, listingId } },
      create: { contactId: contact.id, listingId },
      update: {},
    })

    return NextResponse.json({ message: 'Saved' })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
