import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const type  = searchParams.get('type') ?? 'overview'

  if (type === 'buyer_intent') {
    const page  = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)))
    const [topSearches, total] = await Promise.all([
      prisma.propertySearchLog.findMany({
        orderBy: { occurredAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.propertySearchLog.count(),
    ])
    return NextResponse.json({
      data:  topSearches.map(s => ({ query: JSON.parse(s.query), results: s.results, occurredAt: s.occurredAt })),
      total,
      page,
      limit,
    })
  }

  if (type === 'popular_listings') {
    // Manual listings only — ResoProperty data is never included here
    const topListings = await prisma.listing.findMany({
      orderBy: { views: 'desc' },
      take: 20,
      include: { property: { select: { title: true, price: true, city: true } } },
    })
    return NextResponse.json({ data: topListings })
  }

  if (type === 'lead_scores') {
    const hotLeads = await prisma.contact.findMany({
      where:   { leadScore: { gte: 50 } },
      orderBy: { leadScore: 'desc' },
      take:    20,
      select:  { id: true, firstName: true, lastName: true, email: true, leadScore: true, source: true },
    })
    return NextResponse.json({ data: hotLeads })
  }

  // Overview
  const [contacts, deals, listings, searchLogs] = await Promise.all([
    prisma.contact.count(),
    prisma.deal.count(),
    prisma.property.count({ where: { status: 'active' } }),
    prisma.propertySearchLog.count({ where: { occurredAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } }),
  ])
  return NextResponse.json({ data: { contacts, deals, activeListings: listings, searchesThisWeek: searchLogs } })
}
