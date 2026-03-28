import { prisma } from '@/lib/prisma'

const SCORE_WEIGHTS = {
  page_view:    1,
  listing_view: 5,
  blog_read:    2,
  form_submit:  20,
  search:       3,
}

export async function recalculateLeadScore(contactId: string): Promise<number> {
  const events = await prisma.behaviorEvent.findMany({
    where: { contactId, occurredAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } }, // last 30 days
  })

  let score = 0
  for (const event of events) {
    score += SCORE_WEIGHTS[event.eventType as keyof typeof SCORE_WEIGHTS] ?? 1
  }

  // Cap at 100
  score = Math.min(100, score)

  const contact = await prisma.contact.findUnique({ where: { id: contactId } })
  if (!contact) return score

  const delta = score - contact.leadScore

  if (delta !== 0) {
    await Promise.all([
      prisma.contact.update({ where: { id: contactId }, data: { leadScore: score } }),
      prisma.leadScore.create({ data: { contactId, score, delta, reason: 'Behavior recalculation' } }),
    ])
  }

  return score
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
      entityId: entityId ?? null,
      contactId: contactId ?? null,
      sessionId: sessionId ?? null,
      metadata: metadata ? JSON.stringify(metadata) : null,
    },
  })

  // Recalculate score if contact known
  if (contactId) {
    await recalculateLeadScore(contactId).catch(() => { /* non-critical */ })
  }

  // Hot browser alert — only check for logged-in contacts viewing listings
  if (contactId && eventType === 'listing_view') {
    checkHotBrowserAlert(contactId).catch(() => { /* non-critical */ })
  }
}

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

  // Avoid duplicate alerts — skip if an unread listing_alert already exists for this contact
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

  // Create notification
  await prisma.notification.create({
    data: {
      type:      'listing_alert',
      title:     `${fullName} is browsing listings`,
      body:      `Viewed ${viewCount} listing${viewCount !== 1 ? 's' : ''} in the last ${hours} hour${hours !== 1 ? 's' : ''}. Consider reaching out.`,
      contactId,
    },
  })

  // Create a call-back task due the following day at 9am for the first admin user
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
