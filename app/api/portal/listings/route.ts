import { NextResponse } from 'next/server'
import { getContactSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  const contact = await getContactSession()
  if (!contact) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const status    = searchParams.get('status')    // 'active'|'sold'|'expired'|null
  const minPrice  = searchParams.get('minPrice')
  const maxPrice  = searchParams.get('maxPrice')
  const minBeds   = searchParams.get('minBeds')

  // Build property filter
  const propertyWhere: Record<string, unknown> = {}
  if (status && ['active','sold','expired','draft'].includes(status)) {
    propertyWhere.status = status
  }
  if (minPrice) propertyWhere.price = { ...(propertyWhere.price as object ?? {}), gte: Number(minPrice) }
  if (maxPrice) propertyWhere.price = { ...(propertyWhere.price as object ?? {}), lte: Number(maxPrice) }
  if (minBeds)  propertyWhere.bedrooms = { gte: Number(minBeds) }

  const listings = await prisma.listing.findMany({
    where:   { property: propertyWhere },
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
    orderBy: [{ property: { status: 'asc' } }, { property: { listedAt: 'desc' } }],
  })

  const data = listings.map(l => ({
    id:        l.id,
    slug:      l.slug,
    property:  l.property,
    isSaved:   l.savedByContacts.length > 0,
  }))

  return NextResponse.json({ data })
}
