import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

export async function GET(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const area         = searchParams.get('area')
  const municipality = searchParams.get('municipality')

  // Level 3: neighbourhoods for a given area + municipality
  if (area && municipality) {
    const rows = await prisma.community.findMany({
      where:    { city: area, municipality, neighbourhood: { not: null } },
      select:   { neighbourhood: true },
      distinct: ['neighbourhood'],
      orderBy:  { neighbourhood: 'asc' },
    })
    return NextResponse.json({ neighbourhoods: rows.map(r => r.neighbourhood as string) })
  }

  // Level 2: municipalities for a given area
  if (area) {
    const rows = await prisma.community.findMany({
      where:    { city: area, municipality: { not: null } },
      select:   { municipality: true },
      distinct: ['municipality'],
      orderBy:  { municipality: 'asc' },
    })
    return NextResponse.json({ municipalities: rows.map(r => r.municipality as string) })
  }

  // Level 1: all distinct areas (city is non-nullable — no null filter needed)
  const rows = await prisma.community.findMany({
    select:   { city: true },
    distinct: ['city'],
    orderBy:  { city: 'asc' },
  })
  return NextResponse.json({ areas: rows.map(r => r.city) })
}
