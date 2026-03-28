import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * Cascading geography endpoint for the listings search.
 *
 * GET /api/search/geo?level=areas
 *   → distinct municipality values from the Community table (area = municipality in TRREB)
 *
 * GET /api/search/geo?level=communities&area=Toronto
 *   → community names from the Community table where municipality = area
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const level = searchParams.get('level')
  const area  = searchParams.get('area') ?? undefined

  if (level === 'areas') {
    // Areas = distinct active city values from RESO properties
    const rows = await prisma.resoProperty.findMany({
      where:    { standardStatus: 'Active' },
      select:   { city: true },
      distinct: ['city'],
      orderBy:  { city: 'asc' },
    })
    const areas = rows.map(r => r.city).filter(Boolean).sort() as string[]
    return NextResponse.json(areas)
  }

  if (level === 'communities' && area) {
    const isRelationalDB = !process.env.DATABASE_URL?.startsWith('file:')
    const rows = await prisma.community.findMany({
      where: {
        city: isRelationalDB
          ? { equals: area, mode: 'insensitive' }
          : { equals: area },
      },
      select:  { name: true },
      orderBy: { name: 'asc' },
    })
    const communities = rows.map(r => r.name).filter(Boolean).sort() as string[]
    return NextResponse.json(communities)
  }

  return NextResponse.json({ error: 'Invalid level parameter' }, { status: 400 })
}
