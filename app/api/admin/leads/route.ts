import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

/**
 * GET /api/admin/leads
 *
 * Returns contacts sorted by lead score with component breakdown.
 *
 * Query params:
 *   classification  = hot | warm | cold  (default: all)
 *   limit           = 1–100              (default: 50)
 *   offset          = 0+                 (default: 0)
 */
export async function GET(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const classification = searchParams.get('classification') ?? undefined
  const limit  = Math.min(100, Math.max(1, parseInt(searchParams.get('limit')  ?? '50', 10)))
  const offset =              Math.max(0,  parseInt(searchParams.get('offset') ?? '0',  10))

  const where = classification ? { classification } : {}

  const [contacts, total] = await Promise.all([
    prisma.contact.findMany({
      where,
      orderBy: { leadScore: 'desc' },
      take:    limit,
      skip:    offset,
      select: {
        id:             true,
        firstName:      true,
        lastName:       true,
        email:          true,
        phone:          true,
        leadScore:      true,
        intentScore:    true,
        urgencyScore:   true,
        transitionScore:true,
        classification: true,
        createdAt:      true,
        updatedAt:      true,
        behaviorEvents: {
          where:   { occurredAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
          orderBy: { occurredAt: 'desc' },
          take:    5,
          select: { eventType: true, entityId: true, metadata: true, occurredAt: true },
        },
        leadScoreHistory: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { createdAt: true, delta: true, reason: true },
        },
      },
    }),
    prisma.contact.count({ where }),
  ])

  const leads = contacts.map(c => ({
    id:             c.id,
    name:           [c.firstName, c.lastName].filter(Boolean).join(' '),
    email:          c.email,
    phone:          c.phone,
    score: {
      total:      c.leadScore,
      intent:     c.intentScore     ?? 0,
      urgency:    c.urgencyScore    ?? 0,
      transition: c.transitionScore ?? 0,
    },
    classification: c.classification ?? 'cold',
    signals:        buildSignals(c.intentScore ?? 0, c.urgencyScore ?? 0, c.transitionScore ?? 0, c.behaviorEvents),
    recentEvents:   c.behaviorEvents,
    lastActivity:   c.behaviorEvents[0]?.occurredAt ?? null,
    lastScoreChange: c.leadScoreHistory[0] ?? null,
    createdAt:      c.createdAt,
  }))

  return NextResponse.json({ leads, total, limit, offset })
}

function buildSignals(
  intent: number,
  urgency: number,
  transition: number,
  events: { eventType: string }[]
): string[] {
  const signals: string[] = []

  if (intent >= 25)     signals.push('High listing engagement')
  if (urgency >= 20)    signals.push('Frequent recent visits')
  if (transition >= 15) signals.push('Narrowing search behaviour')

  const listingViewCount = events.filter(e => e.eventType === 'listing_view').length
  if (listingViewCount >= 3) signals.push(`Viewed ${listingViewCount} listings recently`)

  if (events.some(e => e.eventType === 'search' || e.eventType === 'filter_change'))
    signals.push('Active search filters')

  if (events.some(e => e.eventType === 'form_submit'))
    signals.push('Submitted inquiry form')

  return signals
}
