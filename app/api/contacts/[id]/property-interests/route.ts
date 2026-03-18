import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

interface Params { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Params) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: contactId } = await params

  // Deduplicated interests
  const interests = await prisma.contactPropertyInterest.findMany({
    where:   { contactId },
    orderBy: { updatedAt: 'desc' },
    include: { property: true },
  })

  // Raw view history grouped by property
  const rawEvents = await prisma.behaviorEvent.findMany({
    where:   { contactId, eventType: 'listing_view' },
    orderBy: { occurredAt: 'asc' },
  })

  // Group view events by entityId (property ID)
  const viewMap: Record<string, { count: number; first: Date; last: Date }> = {}
  for (const ev of rawEvents) {
    const pid = ev.entityId ?? ''
    if (!viewMap[pid]) viewMap[pid] = { count: 0, first: ev.occurredAt, last: ev.occurredAt }
    viewMap[pid].count++
    viewMap[pid].last = ev.occurredAt
  }

  // Fetch property info for view history
  const propertyIds = Object.keys(viewMap)
  const properties  = propertyIds.length
    ? await prisma.property.findMany({ where: { id: { in: propertyIds } } })
    : []

  const viewHistory = properties.map(p => ({
    property: p,
    count:    viewMap[p.id].count,
    firstSeen: viewMap[p.id].first,
    lastSeen:  viewMap[p.id].last,
  })).sort((a, b) => b.lastSeen.getTime() - a.lastSeen.getTime())

  // Buyer profile summary
  const interestProps = interests.map(i => i.property)
  const summary       = computeBuyerProfile(interestProps, viewMap, properties)

  return NextResponse.json({ interests, viewHistory, summary })
}

const addSchema = z.object({ propertyId: z.string(), notes: z.string().optional() })

export async function POST(request: Request, { params }: Params) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: contactId } = await params

  try {
    const body = await request.json()
    const { propertyId, notes } = addSchema.parse(body)

    const interest = await prisma.contactPropertyInterest.upsert({
      where:  { contactId_propertyId: { contactId, propertyId } },
      update: { source: 'manual', notes: notes ?? undefined },
      create: { contactId, propertyId, source: 'manual', notes },
    })
    return NextResponse.json(interest, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}

function computeBuyerProfile(
  interestProps: Array<{ id: string; propertyType: string; price: number; city: string }>,
  viewMap: Record<string, { count: number }>,
  viewProps: Array<{ id: string; propertyType: string; price: number; city: string }>
) {
  // Deduplicate by property ID — a property may appear in both interests and view history
  const seen = new Map<string, { propertyType: string; price: number; city: string }>()
  for (const p of [...interestProps, ...viewProps]) seen.set(p.id, p)
  const allProps = Array.from(seen.values())

  if (allProps.length === 0) return null

  // Most common property type
  const typeCounts: Record<string, number> = {}
  for (const p of allProps) typeCounts[p.propertyType] = (typeCounts[p.propertyType] ?? 0) + 1
  const topType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0]?.[0]

  // Price range
  const prices   = allProps.map(p => p.price).filter(Boolean)
  const minPrice = Math.min(...prices)
  const maxPrice = Math.max(...prices)

  // Most viewed city
  const cityCounts: Record<string, number> = {}
  for (const p of allProps) cityCounts[p.city] = (cityCounts[p.city] ?? 0) + 1
  const topCity = Object.entries(cityCounts).sort((a, b) => b[1] - a[1])[0]?.[0]

  return { topType, minPrice, maxPrice, topCity }
}
