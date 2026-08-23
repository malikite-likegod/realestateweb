import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getBrokerageFilter } from '@/lib/site-settings'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)

  const isRelational = !process.env.DATABASE_URL?.startsWith('file:')
  const iContains = (val: string) => isRelational
    ? { contains: val, mode: 'insensitive' as const }
    : { contains: val }

  const officeOnly = searchParams.get('officeOnly') === 'true'
  const baseWhere: Record<string, unknown> = { standardStatus: { notIn: ['Active'] } }
  if (officeOnly) {
    const { officeKey, officeName } = await getBrokerageFilter()
    if (officeKey)       baseWhere.listOfficeKey  = officeKey
    else if (officeName) baseWhere.listOfficeName = iContains(officeName)
  }

  // Status/count breakdown for the filter dropdown and summary tiles — driven by
  // whatever standardStatus values actually exist, not a hardcoded guessed list.
  if (searchParams.get('meta') === 'statuses') {
    const groups = await prisma.resoProperty.groupBy({
      by:    ['standardStatus'],
      where: baseWhere,
      _count: true,
    })
    return NextResponse.json({
      statuses: groups
        .map(g => ({ status: g.standardStatus, count: g._count }))
        .sort((a, b) => b.count - a.count),
    })
  }

  const page        = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const pageSize    = 25
  const status      = searchParams.get('status') ?? ''
  const area        = searchParams.get('area')   ?? ''
  const from        = searchParams.get('from')   ?? ''
  const to          = searchParams.get('to')     ?? ''

  const where: Record<string, unknown> = { ...baseWhere }

  if (status) where.standardStatus = status
  if (area)   where.city = iContains(area)

  if (from || to) {
    where.OR = [
      { closeDate: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } },
      { AND: [{ closeDate: null }, { modificationTimestamp: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } }] },
    ]
  }

  const [total, properties] = await Promise.all([
    prisma.resoProperty.count({ where }),
    prisma.resoProperty.findMany({
      where,
      // Postgres puts NULLs first on a plain `desc` sort, which would bury every closed/priced
      // listing under the (usually far more numerous) expired/withdrawn ones on page 1 — sort by
      // modificationTimestamp instead so the most recently changed listings show up first regardless
      // of status, and the presence/absence of a close price is never a sort-order artifact.
      orderBy: { modificationTimestamp: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id:                    true,
        listingKey:            true,
        streetNumber:          true,
        streetDirPrefix:       true,
        streetName:            true,
        streetSuffix:          true,
        streetDirSuffix:       true,
        unitNumber:            true,
        city:                  true,
        standardStatus:        true,
        listPrice:             true,
        closePrice:            true,
        closeDate:             true,
        listingContractDate:   true,
        modificationTimestamp: true,
        listOfficeName:        true,
        propertyType:          true,
      },
    }),
  ])

  return NextResponse.json({ data: properties, total, page, pageSize, totalPages: Math.ceil(total / pageSize) })
}
