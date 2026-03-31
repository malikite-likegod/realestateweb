import { NextResponse } from 'next/server'
import { getContactSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  const contact = await getContactSession()
  if (!contact) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const city         = searchParams.get('city')         ?? ''
  const community    = searchParams.get('community')    ?? ''
  const propertyType = searchParams.get('propertyType') ?? ''
  const listingType  = searchParams.get('listingType')  ?? ''
  const minPrice     = searchParams.get('minPrice')
  const maxPrice     = searchParams.get('maxPrice')
  const minBeds      = searchParams.get('minBeds')
  const minBaths     = searchParams.get('minBaths')
  const minGarage    = searchParams.get('minGarage')
  const minSqft      = searchParams.get('minSqft')
  const maxSqft      = searchParams.get('maxSqft')
  const page         = Math.max(1, Number(searchParams.get('page') ?? '1'))
  const pageSize     = 20
  const skip         = (page - 1) * pageSize

  const isRelational = !process.env.DATABASE_URL?.startsWith('file:')
  const iContains = (val: string) => isRelational
    ? { contains: val, mode: 'insensitive' as const }
    : { contains: val }

  const where: Record<string, unknown> = { standardStatus: 'Active' }

  // City — direct match
  if (city) where.city = iContains(city)

  // Community — resolve to city via Community table
  if (community && !city) {
    const comm = await prisma.community.findFirst({ where: { name: iContains(community) } })
    if (comm) where.city = iContains(comm.city)
  }

  // Property type
  if (propertyType) {
    where.OR = [
      { propertyType:    iContains(propertyType) },
      { propertySubType: iContains(propertyType) },
    ]
  }

  // Listing type
  if (listingType === 'lease') {
    where.transactionType = iContains('lease')
  } else if (listingType === 'sale') {
    where.NOT = { transactionType: iContains('lease') }
  }

  // Price
  if (minPrice || maxPrice) {
    where.listPrice = {
      ...(minPrice ? { gte: Number(minPrice) } : {}),
      ...(maxPrice ? { lte: Number(maxPrice) } : {}),
    }
  }

  // Beds / baths / garage / sqft
  if (minBeds)   where.bedroomsTotal        = { gte: Number(minBeds) }
  if (minBaths)  where.bathroomsTotalInteger = { gte: Number(minBaths) }
  if (minGarage) where.garageSpaces          = { gte: Number(minGarage) }
  if (minSqft || maxSqft) {
    where.livingArea = {
      ...(minSqft ? { gte: Number(minSqft) } : {}),
      ...(maxSqft ? { lte: Number(maxSqft) } : {}),
    }
  }

  const MAX_RESULTS = 100

  const [rawTotal, properties] = await Promise.all([
    prisma.resoProperty.count({ where }),
    prisma.resoProperty.findMany({
      where,
      orderBy: { listingContractDate: 'desc' },
      skip,
      take: pageSize,
      select: {
        id: true, listingKey: true, standardStatus: true,
        propertyType: true, propertySubType: true, transactionType: true,
        listPrice: true, bedroomsTotal: true, bathroomsTotalInteger: true,
        garageSpaces: true, livingArea: true, yearBuilt: true,
        streetNumber: true, streetName: true, streetSuffix: true, unitNumber: true,
        city: true, stateOrProvince: true, postalCode: true,
        latitude: true, longitude: true,
        publicRemarks: true, media: true,
        listAgentFullName: true, listOfficeName: true,
      },
    }),
  ])

  // Saved status
  const propertyIds = properties.map(p => p.id)
  const saved = propertyIds.length
    ? await prisma.contactPropertyInterest.findMany({
        where:  { contactId: contact.id, resoPropertyId: { in: propertyIds }, source: 'portal_saved' },
        select: { resoPropertyId: true },
      })
    : []
  const savedSet = new Set(saved.map(s => s.resoPropertyId))

  const total      = Math.min(rawTotal, MAX_RESULTS)
  const capped     = rawTotal > MAX_RESULTS
  const totalPages = Math.ceil(total / pageSize)

  const data = properties.map(p => ({ ...p, isSaved: savedSet.has(p.id) }))
  return NextResponse.json({ data, total, page, pageSize, totalPages, capped })
}
