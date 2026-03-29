import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const page     = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const pageSize = 24
  const city         = searchParams.get('city')         ?? ''
  const community    = searchParams.get('community')    ?? ''
  const propertyType = searchParams.get('propertyType') ?? ''
  const listingType  = searchParams.get('listingType')  ?? ''
  const minPrice     = searchParams.get('minPrice')     ? parseInt(searchParams.get('minPrice')!) : undefined
  const maxPrice     = searchParams.get('maxPrice')     ? parseInt(searchParams.get('maxPrice')!) : undefined
  const minBeds      = searchParams.get('minBeds')      ? parseInt(searchParams.get('minBeds')!)  : undefined
  const minBaths     = searchParams.get('minBaths')     ? parseInt(searchParams.get('minBaths')!) : undefined

  const where: Record<string, unknown> = { standardStatus: 'Active' }

  if (city)         where.city         = { contains: city,         mode: 'insensitive' }
  if (community)    where.city         = { contains: community,    mode: 'insensitive' }
  if (propertyType) where.propertyType = { contains: propertyType, mode: 'insensitive' }
  if (minBeds)      where.bedroomsTotal          = { gte: minBeds }
  if (minBaths)     where.bathroomsTotalInteger  = { gte: minBaths }
  if (minPrice || maxPrice) {
    where.listPrice = {}
    if (minPrice) (where.listPrice as Record<string, number>).gte = minPrice
    if (maxPrice) (where.listPrice as Record<string, number>).lte = maxPrice
  }

  const [total, properties] = await Promise.all([
    prisma.resoProperty.count({ where }),
    prisma.resoProperty.findMany({
      where,
      orderBy: { listPrice: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        listingKey: true,
        streetNumber: true,
        streetName: true,
        streetSuffix: true,
        unitNumber: true,
        city: true,
        listPrice: true,
        bedroomsTotal: true,
        bathroomsTotalInteger: true,
        livingArea: true,
        propertyType: true,
        media: true,
        standardStatus: true,
      },
    }),
  ])

  return NextResponse.json({ data: properties, total, page, pageSize, totalPages: Math.ceil(total / pageSize) })
}
