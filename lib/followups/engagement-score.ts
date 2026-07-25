/**
 * Engagement Score (follow-up "heat")
 *
 * A recency-scoped 0-100 score separate from Contact.leadScore (which measures
 * sales intent for hot/warm/cold classification — see services/ai/lead-scoring.ts).
 * This score only measures how actively a contact has been engaging lately
 * (opens, clicks, site activity, replies) and is used purely to bump a
 * follow-up task's priority — it never changes the contact's classification.
 */

import { prisma } from '@/lib/prisma'

const LOOKBACK_DAYS = 30

export async function calculateEngagementHeat(contactId: string): Promise<number> {
  const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000)

  const [emails, behaviorEventCount, inboundSms, inboundCalls] = await Promise.all([
    prisma.emailMessage.findMany({
      where:  { contactId, direction: 'outbound', sentAt: { gte: since } },
      select: { openCount: true, clickCount: true },
    }),
    prisma.behaviorEvent.count({
      where: { contactId, occurredAt: { gte: since } },
    }),
    prisma.smsMessage.count({
      where: { contactId, direction: 'inbound', sentAt: { gte: since } },
    }),
    prisma.callLog.count({
      where: { contactId, direction: 'inbound', occurredAt: { gte: since } },
    }),
  ])

  const totalOpens  = emails.reduce((sum, e) => sum + e.openCount,  0)
  const totalClicks = emails.reduce((sum, e) => sum + e.clickCount, 0)

  const openScore     = Math.min(30, totalOpens * 6)
  const clickScore    = Math.min(20, totalClicks * 5)
  const activityScore = Math.min(30, behaviorEventCount * 3)
  const replyScore    = Math.min(20, (inboundSms + inboundCalls) * 10)

  return Math.min(100, openScore + clickScore + activityScore + replyScore)
}
