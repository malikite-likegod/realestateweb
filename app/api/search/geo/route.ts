import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * Cascading geography endpoint for the listings search.
 *
 * GET /api/search/geo?level=areas
 *   → distinct city values that have active RESO listings
 *
 * GET /api/search/geo?level=municipalities&area=Toronto
 *   → distinct municipality values from the Community table for that area/city
 *
 * GET /api/search/geo?level=communities&municipality=Mississauga
 *   → community names from the Community table for that municipality
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const level        = searchParams.get('level')
  const area         = searchParams.get('area') ?? undefined
  const municipality = searchParams.get('municipality') ?? undefined

  if (level === 'areas') {
    // Distinct active cities from RESO properties, sorted alphabetically
    const rows = await prisma.resoProperty.findMany({
      where:   { standardStatus: 'Active' },
      select:  { city: true },
      distinct: ['city'],
      orderBy: { city: 'asc' },
    })
    const cities = rows.map(r => r.city).filter(Boolean).sort()
    return NextResponse.json(cities)
  }

  if (level === 'municipalities' && area) {
    const isRelationalDB = !process.env.DATABASE_URL?.startsWith('file:')
    const rows = await prisma.community.findMany({
      where: {
        municipality: { not: null },
        city: isRelationalDB
          ? { equals: area, mode: 'insensitive' }
          : { equals: area },
      },
      select:   { municipality: true },
      distinct: ['municipality'],
      orderBy:  { municipality: 'asc' },
    })
    const municipalities = rows.map(r => r.municipality).filter(Boolean).sort() as string[]
    return NextResponse.json(municipalities)
  }

  if (level === 'communities' && municipality) {
    const isRelationalDB = !process.env.DATABASE_URL?.startsWith('file:')
    const rows = await prisma.community.findMany({
      where: {
        municipality: isRelationalDB
          ? { equals: municipality, mode: 'insensitive' }
          : { equals: municipality },
      },
      select:  { name: true },
      orderBy: { name: 'asc' },
    })
    const communities = rows.map(r => r.name).filter(Boolean).sort() as string[]
    return NextResponse.json(communities)
  }

  return NextResponse.json({ error: 'Invalid level parameter' }, { status: 400 })
}
