import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * Geography options for the listings search.
 *
 * GET /api/search/geo?level=areas
 *   → distinct city values from active RESO listings
 *
 * GET /api/search/geo?level=communities
 *   → all community names from the Community table
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const level = searchParams.get('level')

  if (level === 'areas') {
    const rows = await prisma.resoProperty.findMany({
      where:    { standardStatus: 'Active' },
      select:   { city: true },
      distinct: ['city'],
      orderBy:  { city: 'asc' },
    })
    const areas = rows.map(r => r.city).filter(Boolean).sort() as string[]
    return NextResponse.json(areas)
  }

  if (level === 'communities') {
    const rows = await prisma.community.findMany({
      select:  { name: true },
      orderBy: { name: 'asc' },
    })
    const communities = rows.map(r => r.name).filter(Boolean) as string[]
    return NextResponse.json(communities)
  }

  return NextResponse.json({ error: 'Invalid level parameter' }, { status: 400 })
}
