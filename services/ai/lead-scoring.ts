import { prisma } from '@/lib/prisma'

// ── Constants ─────────────────────────────────────────────────────────────────

const LOOKBACK_DAYS = 30
const HOT_THRESHOLD  = 70
const WARM_THRESHOLD = 40

// Intent score (0–40): depth and repetition of property engagement
// Urgency score (0–35): recency, frequency, session patterns
// Transition score (0–25): behavioural signals of a buyer moving from browsing → deciding

// ── Intent Score (0–40) ───────────────────────────────────────────────────────

function calculateIntentScore(events: { eventType: string; entityId: string | null; metadata: string | null }[]): number {
  let score = 0

  const listingViews = events.filter(e => e.eventType === 'listing_view')
  const uniqueListings = new Set(listingViews.map(e => e.entityId).filter(Boolean)).size
  const repeatedViews = listingViews.length - uniqueListings   // views beyond first

  // Unique listings seen (up to 10 = 10 pts)
  score += Math.min(10, uniqueListings)

  // Repeated views of same listing (strong intent signal, up to 8 pts)
  score += Math.min(8, repeatedViews * 2)

  // Searches performed (up to 8 pts)
  const searches = events.filter(e => e.eventType === 'search' || e.eventType === 'filter_change').length
  score += Math.min(8, searches)

  // Form submit = very high intent (up to 10 pts)
  const formSubmits = events.filter(e => e.eventType === 'form_submit').length
  score += Math.min(10, formSubmits * 10)

  // Map interactions (exploring geo = intent, up to 4 pts)
  const mapInteractions = events.filter(e => e.eventType === 'map_interaction').length
  score += Math.min(4, mapInteractions)

  return Math.min(40, score)
}

// ── Urgency Score (0–35) ──────────────────────────────────────────────────────

function calculateUrgencyScore(
  events: { occurredAt: Date }[],
  sessions: { startedAt: Date }[]
): number {
  let score = 0

  if (events.length === 0) return 0

  const now = Date.now()
  const dayMs = 24 * 60 * 60 * 1000

  // Recency: last event within N days
  const mostRecent = Math.max(...events.map(e => new Date(e.occurredAt).getTime()))
  const daysSinceLast = (now - mostRecent) / dayMs
  if      (daysSinceLast < 1)  score += 15
  else if (daysSinceLast < 3)  score += 10
  else if (daysSinceLast < 7)  score += 6
  else if (daysSinceLast < 14) score += 3

  // Visit frequency: distinct active days in last 30 days (up to 10 pts)
  const activeDays = new Set(
    events.map(e => {
      const d = new Date(e.occurredAt)
      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
    })
  ).size
  score += Math.min(10, activeDays * 2)

  // Session count (multiple sessions = ongoing interest, up to 10 pts)
  score += Math.min(10, sessions.length * 2)

  return Math.min(35, score)
}

// ── Transition Score (0–25) ───────────────────────────────────────────────────

function calculateTransitionScore(
  events: { eventType: string; metadata: string | null; occurredAt: Date }[]
): number {
  let score = 0

  // Search narrowing: if later searches have more filters than earlier ones
  const searchEvents = events
    .filter(e => e.eventType === 'search' || e.eventType === 'filter_change')
    .sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime())

  if (searchEvents.length >= 2) {
    let maxFilters = 0
    let narrowingDetected = false
    for (const se of searchEvents) {
      const meta = parseJsonSafe<Record<string, unknown>>(se.metadata)
      const filterCount = Object.values(meta).filter(v => v != null && v !== '').length
      if (filterCount > maxFilters) {
        if (maxFilters > 0) narrowingDetected = true
        maxFilters = filterCount
      }
    }
    if (narrowingDetected) score += 8
  }

  // Geo clustering: listing views in the same city (narrow geographic focus, up to 8 pts)
  const listingMetas = events
    .filter(e => e.eventType === 'listing_view')
    .map(e => parseJsonSafe<{ city?: string }>(e.metadata))
  const citiesViewed = new Set(listingMetas.map(m => m.city).filter(Boolean))
  if (citiesViewed.size === 1 && listingMetas.length >= 2) score += 8
  else if (citiesViewed.size <= 2 && listingMetas.length >= 3) score += 4

  // Broad → narrow price range shift (up to 5 pts)
  const searchMetas = searchEvents
    .map(e => parseJsonSafe<{ minPrice?: number; maxPrice?: number }>(e.metadata))
    .filter(m => m.minPrice != null || m.maxPrice != null)
  if (searchMetas.length >= 2) {
    const first = searchMetas[0]
    const last  = searchMetas[searchMetas.length - 1]
    const firstRange = (first.maxPrice ?? Infinity) - (first.minPrice ?? 0)
    const lastRange  = (last.maxPrice  ?? Infinity) - (last.minPrice  ?? 0)
    if (lastRange < firstRange * 0.6) score += 5
  }

  // Contact form / inquiry = decisive transition signal (up to 4 pts)
  const inquiries = events.filter(e => e.eventType === 'form_submit').length
  score += Math.min(4, inquiries * 4)

  return Math.min(25, score)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseJsonSafe<T>(json: string | null | undefined): T {
  if (!json) return {} as T
  try { return JSON.parse(json) as T }
  catch { return {} as T }
}

function classifyScore(total: number): 'hot' | 'warm' | 'cold' {
  if (total >= HOT_THRESHOLD)  return 'hot'
  if (total >= WARM_THRESHOLD) return 'warm'
  return 'cold'
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function recalculateLeadScore(contactId: string): Promise<number> {
  const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000)

  const [events, sessions] = await Promise.all([
    prisma.behaviorEvent.findMany({
      where: { contactId, occurredAt: { gte: since } },
      orderBy: { occurredAt: 'asc' },
    }),
    prisma.contactSession.findMany({
      where: { contactId, startedAt: { gte: since } },
      orderBy: { startedAt: 'asc' },
    }),
  ])

  const intentScore     = calculateIntentScore(events)
  const urgencyScore    = calculateUrgencyScore(events, sessions)
  const transitionScore = calculateTransitionScore(events)
  const totalScore      = Math.min(100, intentScore + urgencyScore + transitionScore)
  const classification  = classifyScore(totalScore)

  const contact = await prisma.contact.findUnique({ where: { id: contactId } })
  if (!contact) return totalScore

  const delta = totalScore - contact.leadScore
  const prevClassification = contact.classification ?? 'cold'

  await Promise.all([
    prisma.contact.update({
      where: { id: contactId },
      data: {
        leadScore:      totalScore,
        intentScore,
        urgencyScore,
        transitionScore,
        classification,
      },
    }),
    ...(delta !== 0 ? [
      prisma.leadScore.create({
        data: {
          contactId,
          score: totalScore,
          delta,
          reason: `Intent:${intentScore} Urgency:${urgencyScore} Transition:${transitionScore}`,
        },
      }),
    ] : []),
  ])

  // Escalation notification: cold/warm → hot
  if (classification === 'hot' && prevClassification !== 'hot') {
    triggerHotLeadAlert(contactId, totalScore, intentScore, urgencyScore, transitionScore).catch(() => null)
  }

  return totalScore
}

export async function trackBehaviorEvent(
  eventType: string,
  entityId?: string,
  contactId?: string,
  sessionId?: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  await prisma.behaviorEvent.create({
    data: {
      eventType,
      entityId:  entityId  ?? null,
      contactId: contactId ?? null,
      sessionId: sessionId ?? null,
      metadata:  metadata ? JSON.stringify(metadata) : null,
    },
  })

  // Upsert session record for urgency tracking
  if (contactId && sessionId) {
    await prisma.contactSession.upsert({
      where:  { sessionId },
      update: { lastSeenAt: new Date(), eventCount: { increment: 1 }, ...(eventType === 'search' || eventType === 'filter_change' ? { searchCount: { increment: 1 } } : {}), ...(eventType === 'listing_view' ? { listingViews: { increment: 1 } } : {}) },
      create: {
        contactId,
        sessionId,
        eventCount:   1,
        searchCount:  (eventType === 'search' || eventType === 'filter_change') ? 1 : 0,
        listingViews: eventType === 'listing_view' ? 1 : 0,
      },
    }).catch(() => null)
  }

  if (contactId) {
    await recalculateLeadScore(contactId).catch(() => null)
  }

  if (contactId && eventType === 'listing_view') {
    checkHotBrowserAlert(contactId).catch(() => null)
  }
}

export async function trackBehaviorEventBatch(
  events: Array<{
    eventType: string
    entityId?: string
    sessionId?: string
    metadata?: Record<string, unknown>
  }>,
  contactId?: string
): Promise<void> {
  if (events.length === 0) return

  await prisma.behaviorEvent.createMany({
    data: events.map(e => ({
      eventType: e.eventType,
      entityId:  e.entityId  ?? null,
      contactId: contactId   ?? null,
      sessionId: e.sessionId ?? null,
      metadata:  e.metadata  ? JSON.stringify(e.metadata) : null,
    })),
  })

  // Update session for the last seen sessionId
  const lastEvent = events[events.length - 1]
  if (contactId && lastEvent.sessionId) {
    const listingViews = events.filter(e => e.eventType === 'listing_view').length
    const searches     = events.filter(e => e.eventType === 'search' || e.eventType === 'filter_change').length

    await prisma.contactSession.upsert({
      where:  { sessionId: lastEvent.sessionId },
      update: {
        lastSeenAt:   new Date(),
        eventCount:   { increment: events.length },
        listingViews: { increment: listingViews },
        searchCount:  { increment: searches },
      },
      create: {
        contactId,
        sessionId:    lastEvent.sessionId,
        eventCount:   events.length,
        listingViews,
        searchCount:  searches,
      },
    }).catch(() => null)
  }

  if (contactId) {
    await recalculateLeadScore(contactId).catch(() => null)
  }
}

// ── Hot Browser Alert (unchanged logic) ───────────────────────────────────────

async function checkHotBrowserAlert(contactId: string): Promise<void> {
  const settingRows = await prisma.siteSettings.findMany({
    where: { key: { in: ['hot_browser_alert_enabled', 'hot_browser_alert_views', 'hot_browser_alert_hours'] } },
  })
  const settingMap: Record<string, string> = {}
  for (const r of settingRows) settingMap[r.key] = r.value

  if ((settingMap['hot_browser_alert_enabled'] ?? 'false') !== 'true') return

  const threshold = parseInt(settingMap['hot_browser_alert_views'] ?? '5', 10)
  const hours     = parseInt(settingMap['hot_browser_alert_hours']  ?? '24', 10)
  const since     = new Date(Date.now() - hours * 60 * 60 * 1000)

  const viewCount = await prisma.behaviorEvent.count({
    where: { contactId, eventType: 'listing_view', occurredAt: { gte: since } },
  })

  if (viewCount < threshold) return

  const existing = await prisma.notification.findFirst({
    where: { contactId, type: 'listing_alert', isRead: false },
  })
  if (existing) return

  const contact = await prisma.contact.findUnique({
    where:  { id: contactId },
    select: { firstName: true, lastName: true },
  })
  if (!contact) return

  const fullName = [contact.firstName, contact.lastName].filter(Boolean).join(' ') || 'A contact'

  await prisma.notification.create({
    data: {
      type:      'listing_alert',
      title:     `${fullName} is browsing listings`,
      body:      `Viewed ${viewCount} listing${viewCount !== 1 ? 's' : ''} in the last ${hours} hour${hours !== 1 ? 's' : ''}. Consider reaching out.`,
      contactId,
    },
  })

  const adminUser = await prisma.user.findFirst({ where: { role: 'admin' }, select: { id: true } })
  if (!adminUser) return

  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(9, 0, 0, 0)

  await prisma.task.create({
    data: {
      title:       `Call ${fullName}`,
      description: `${fullName} viewed ${viewCount} listing${viewCount !== 1 ? 's' : ''} in the last ${hours} hour${hours !== 1 ? 's' : ''}. Good time to follow up.`,
      status:      'todo',
      priority:    'high',
      dueAt:       tomorrow,
      assigneeId:  adminUser.id,
      contactId,
    },
  })
}

// ── Hot Lead Alert (score-based escalation) ───────────────────────────────────

async function triggerHotLeadAlert(
  contactId: string,
  total: number,
  intent: number,
  urgency: number,
  transition: number
): Promise<void> {
  const contact = await prisma.contact.findUnique({
    where:  { id: contactId },
    select: { firstName: true, lastName: true },
  })
  if (!contact) return

  const fullName = [contact.firstName, contact.lastName].filter(Boolean).join(' ') || 'A contact'

  // Deduplicate: skip if an unread hot_lead notification already exists
  const existing = await prisma.notification.findFirst({
    where: { contactId, type: 'hot_lead', isRead: false },
  })
  if (existing) return

  const signals: string[] = []
  if (intent     >= 25) signals.push('high listing engagement')
  if (urgency    >= 20) signals.push('frequent recent visits')
  if (transition >= 15) signals.push('narrowing search behaviour')

  await prisma.notification.create({
    data: {
      type:      'hot_lead',
      title:     `${fullName} became a hot lead`,
      body:      `Score: ${total}/100 (Intent ${intent}, Urgency ${urgency}, Transition ${transition}). Signals: ${signals.join(', ') || 'score threshold reached'}.`,
      contactId,
    },
  })

  const adminUser = await prisma.user.findFirst({ where: { role: 'admin' }, select: { id: true } })
  if (!adminUser) return

  const dueAt = new Date()
  dueAt.setHours(dueAt.getHours() + 4) // follow up within 4 hours

  await prisma.task.create({
    data: {
      title:       `Follow up with ${fullName} — hot lead`,
      description: `${fullName} has reached a lead score of ${total}/100. Signals: ${signals.join(', ') || 'score threshold reached'}. Reach out while interest is high.`,
      status:      'todo',
      priority:    'high',
      dueAt,
      assigneeId:  adminUser.id,
      contactId,
    },
  })
}
