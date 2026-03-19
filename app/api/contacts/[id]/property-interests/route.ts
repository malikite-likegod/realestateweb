import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

interface Params { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Params) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: contactId } = await params

  const interests = await prisma.contactPropertyInterest.findMany({
    where:   { contactId },
    orderBy: { updatedAt: 'desc' },
    include: { resoProperty: true },
  })

  // Raw view history grouped by resoPropertyId
  const rawEvents = await prisma.behaviorEvent.findMany({
    where:   { contactId, eventType: 'listing_view' },
    orderBy: { occurredAt: 'asc' },
  })

  const viewMap: Record<string, { count: number; first: Date; last: Date }> = {}
  for (const ev of rawEvents) {
    const pid = ev.entityId ?? ''
    if (!viewMap[pid]) viewMap[pid] = { count: 0, first: ev.occurredAt, last: ev.occurredAt }
    viewMap[pid].count++
    viewMap[pid].last = ev.occurredAt
  }

  const propertyIds = Object.keys(viewMap)
  const resoProperties = propertyIds.length
    ? await prisma.resoProperty.findMany({ where: { id: { in: propertyIds } } })
    : []

  const viewHistory = resoProperties.map(p => ({
    property: p,
    count:    viewMap[p.id].count,
    firstSeen: viewMap[p.id].first,
    lastSeen:  viewMap[p.id].last,
  })).sort((a, b) => b.lastSeen.getTime() - a.lastSeen.getTime())

  const interestProps = interests.map(i => i.resoProperty).filter(Boolean)
  const summary = computeBuyerProfile(
    interestProps as Array<{ id: string; propertySubType: string | null; listPrice: number | null; city: string }>,
    viewMap,
    resoProperties
  )

  return NextResponse.json({ interests, viewHistory, summary })
}

const addSchema = z.object({ resoPropertyId: z.string(), notes: z.string().optional() })

export async function POST(request: Request, { params }: Params) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: contactId } = await params

  try {
    const body = await request.json()
    const { resoPropertyId, notes } = addSchema.parse(body)

    const interest = await prisma.contactPropertyInterest.upsert({
      where:  { contactId_resoPropertyId: { contactId, resoPropertyId } },
      update: { source: 'manual', notes: notes ?? undefined },
      create: { contactId, resoPropertyId, source: 'manual', notes },
    })
    return NextResponse.json(interest, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}

function computeBuyerProfile(
  interestProps: Array<{ id: string; propertySubType: string | null; listPrice: number | null; city: string }>,
  viewMap: Record<string, { count: number }>,
  viewProps: Array<{ id: string; propertySubType: string | null; listPrice: number | null; city: string }>
) {
  const seen = new Map<string, { propertySubType: string | null; listPrice: number | null; city: string }>()
  for (const p of [...interestProps, ...viewProps]) seen.set(p.id, p)
  const allProps = Array.from(seen.values())

  if (allProps.length === 0) return null

  const typeCounts: Record<string, number> = {}
  for (const p of allProps) {
    const t = p.propertySubType ?? 'Unknown'
    typeCounts[t] = (typeCounts[t] ?? 0) + 1
  }
  const topType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0]?.[0]

  const prices   = allProps.map(p => p.listPrice).filter((p): p is number => p != null)
  const minPrice = prices.length ? Math.min(...prices) : 0
  const maxPrice = prices.length ? Math.max(...prices) : 0

  const cityCounts: Record<string, number> = {}
  for (const p of allProps) cityCounts[p.city] = (cityCounts[p.city] ?? 0) + 1
  const topCity = Object.entries(cityCounts).sort((a, b) => b[1] - a[1])[0]?.[0]

  return { topType, minPrice, maxPrice, topCity }
}
