import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

/**
 * Distinct MLS areas for the community admin form's City (Area) dropdown.
 *
 * The MLS feed does not expose selectable neighbourhoods/municipalities, so a
 * community is just a public-facing name pinned to one MLS area. Areas are the
 * distinct `city` values on active RESO listings — same source as
 * `GET /api/search/geo?level=areas`.
 *
 * Response: `{ areas: string[] }` (sorted A→Z, raw feed values).
 */
export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rows = await prisma.resoProperty.findMany({
    where:    { standardStatus: 'Active' },
    select:   { city: true },
    distinct: ['city'],
    orderBy:  { city: 'asc' },
  })
  return NextResponse.json({ areas: rows.map(r => r.city).filter(Boolean) })
}
