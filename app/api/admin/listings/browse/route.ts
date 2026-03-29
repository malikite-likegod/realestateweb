import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const page        = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const pageSize    = 24
  const city         = searchParams.get('city')         ?? ''
  const community    = searchParams.get('community')    ?? ''
  const propertyType = searchParams.get('propertyType') ?? ''
  const listingType  = searchParams.get('listingType')  ?? ''
  const minPrice     = searchParams.get('minPrice')     ? parseInt(searchParams.get('minPrice')!)    : undefined
  const maxPrice     = searchParams.get('maxPrice')     ? parseInt(searchParams.get('maxPrice')!)    : undefined
  const minBeds      = searchParams.get('minBeds')      ? parseInt(searchParams.get('minBeds')!)     : undefined
  const minBaths     = searchParams.get('minBaths')     ? parseInt(searchParams.get('minBaths')!)    : undefined
  const minGarage    = searchParams.get('minGarage')    ? parseInt(searchParams.get('minGarage')!)   : undefined
  const minSqft      = searchParams.get('minSqft')      ? parseInt(searchParams.get('minSqft')!)     : undefined
  const maxSqft      = searchParams.get('maxSqft')      ? parseInt(searchParams.get('maxSqft')!)     : undefined

  const isRelational = !process.env.DATABASE_URL?.startsWith('file:')
  const iContains = (val: string) => isRelational
    ? { contains: val, mode: 'insensitive' as const }
    : { contains: val }

  const where: Record<string, unknown> = { standardStatus: 'Active' }

  if (city) where.city = iContains(city)

  if (community && !city) {
    const comm = await prisma.community.findFirst({ where: { name: iContains(community) } })
    if (comm) where.city = iContains(comm.city)
  }

  if (propertyType) {
    where.OR = [
      { propertyType:    iContains(propertyType) },
      { propertySubType: iContains(propertyType) },
    ]
  }

  if (listingType === 'lease') {
    where.transactionType = iContains('lease')
  } else if (listingType === 'sale') {
    where.NOT = { transactionType: iContains('lease') }
  }

  if (minPrice || maxPrice) {
    where.listPrice = {
      ...(minPrice ? { gte: minPrice } : {}),
      ...(maxPrice ? { lte: maxPrice } : {}),
    }
  }

  if (minBeds)   where.bedroomsTotal        = { gte: minBeds }
  if (minBaths)  where.bathroomsTotalInteger = { gte: minBaths }
  if (minGarage) where.garageSpaces          = { gte: minGarage }
  if (minSqft || maxSqft) {
    where.livingArea = {
      ...(minSqft ? { gte: minSqft } : {}),
      ...(maxSqft ? { lte: maxSqft } : {}),
    }
  }

  const [total, properties] = await Promise.all([
    prisma.resoProperty.count({ where }),
    prisma.resoProperty.findMany({
      where,
      orderBy: { listPrice: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        listingKey:            true,
        streetNumber:          true,
        streetName:            true,
        streetSuffix:          true,
        unitNumber:            true,
        city:                  true,
        listPrice:             true,
        bedroomsTotal:         true,
        bathroomsTotalInteger: true,
        garageSpaces:          true,
        livingArea:            true,
        propertyType:          true,
        propertySubType:       true,
        transactionType:       true,
        media:                 true,
        standardStatus:        true,
      },
    }),
  ])

  return NextResponse.json({ data: properties, total, page, pageSize, totalPages: Math.ceil(total / pageSize) })
}
