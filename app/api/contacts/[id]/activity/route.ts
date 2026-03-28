import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

interface Params { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Params) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: contactId } = await params

  const [behaviorEvents, searchLogs] = await Promise.all([
    prisma.behaviorEvent.findMany({
      where:   { contactId },
      orderBy: { occurredAt: 'desc' },
      take:    200,
    }),
    prisma.propertySearchLog.findMany({
      where:   { contactId },
      orderBy: { occurredAt: 'desc' },
      take:    200,
    }),
  ])

  // Fetch property details for listing_view events
  const listingIds = [
    ...new Set(
      behaviorEvents
        .filter(e => e.eventType === 'listing_view' && e.entityId)
        .map(e => e.entityId as string)
    ),
  ]
  const properties = listingIds.length
    ? await prisma.resoProperty.findMany({
        where:  { id: { in: listingIds } },
        select: {
          id:              true,
          listingKey:      true,
          streetNumber:    true,
          streetName:      true,
          streetSuffix:    true,
          unitNumber:      true,
          city:            true,
          listPrice:       true,
          propertySubType: true,
          media:           true,
        },
      })
    : []
  const propertyMap = Object.fromEntries(properties.map(p => [p.id, p]))

  // Merge into a single sorted feed
  type FeedItem =
    | { kind: 'search';  occurredAt: Date; query: Record<string, string>; results: number }
    | { kind: 'listing_view'; occurredAt: Date; property: typeof properties[number] | null; entityId: string }
    | { kind: 'page_view';   occurredAt: Date; entityId: string | null; metadata: Record<string, unknown> | null }
    | { kind: 'form_submit'; occurredAt: Date; metadata: Record<string, unknown> | null }
    | { kind: 'blog_read';   occurredAt: Date; entityId: string | null }
    | { kind: 'other';       occurredAt: Date; eventType: string; entityId: string | null }

  const items: FeedItem[] = []

  for (const ev of behaviorEvents) {
    let meta: Record<string, unknown> | null = null
    try { meta = ev.metadata ? JSON.parse(ev.metadata) : null } catch { /* ignore */ }

    if (ev.eventType === 'listing_view') {
      items.push({ kind: 'listing_view', occurredAt: ev.occurredAt, property: ev.entityId ? (propertyMap[ev.entityId] ?? null) : null, entityId: ev.entityId ?? '' })
    } else if (ev.eventType === 'page_view') {
      items.push({ kind: 'page_view', occurredAt: ev.occurredAt, entityId: ev.entityId, metadata: meta })
    } else if (ev.eventType === 'form_submit') {
      items.push({ kind: 'form_submit', occurredAt: ev.occurredAt, metadata: meta })
    } else if (ev.eventType === 'blog_read') {
      items.push({ kind: 'blog_read', occurredAt: ev.occurredAt, entityId: ev.entityId })
    } else if (ev.eventType === 'search') {
      let query: Record<string, string> = {}
      try { query = ev.metadata ? JSON.parse(ev.metadata) : {} } catch { /* ignore */ }
      items.push({ kind: 'search', occurredAt: ev.occurredAt, query, results: 0 })
    } else {
      items.push({ kind: 'other', occurredAt: ev.occurredAt, eventType: ev.eventType, entityId: ev.entityId })
    }
  }

  for (const log of searchLogs) {
    let query: Record<string, string> = {}
    try { query = JSON.parse(log.query) } catch { /* ignore */ }
    items.push({ kind: 'search', occurredAt: log.occurredAt, query, results: log.results })
  }

  items.sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())

  return NextResponse.json({ items })
}
