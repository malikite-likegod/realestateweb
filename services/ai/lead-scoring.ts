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
}
