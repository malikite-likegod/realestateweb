import { NextResponse } from 'next/server'
import { validateApiKey } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Missing API key' }, { status: 401 })
  }

  const apiKey = authHeader.slice(7)
  const user = await validateApiKey(apiKey)
  if (!user) return NextResponse.json({ error: 'Invalid API key' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type') ?? 'overview'

  if (type === 'buyer_intent') {
    const topSearches = await prisma.propertySearchLog.findMany({
      orderBy: { occurredAt: 'desc' },
      take: 100,
    })
    return NextResponse.json({ data: topSearches.map(s => ({ query: JSON.parse(s.query), results: s.results, occurredAt: s.occurredAt })) })
  }

  if (type === 'popular_listings') {
    const topListings = await prisma.listing.findMany({
      orderBy: { views: 'desc' },
      take: 20,
      include: { property: { select: { title: true, price: true, city: true } } },
    })
    return NextResponse.json({ data: topListings })
  }

  if (type === 'lead_scores') {
    const hotLeads = await prisma.contact.findMany({
      where: { leadScore: { gte: 50 } },
      orderBy: { leadScore: 'desc' },
      take: 20,
      select: { id: true, firstName: true, lastName: true, email: true, leadScore: true, source: true },
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
