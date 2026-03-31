import { NextResponse } from 'next/server'
import { z } from 'zod'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { trackBehaviorEvent, trackBehaviorEventBatch } from '@/services/ai/lead-scoring'
import { getContactSession } from '@/lib/auth'
import { verifyVerifiedContactCookie } from '@/lib/jwt'

const singleEventSchema = z.object({
  eventType: z.string().max(50),
  entityId:  z.string().max(100).optional(),
  sessionId: z.string().max(100).optional(),
  metadata:  z.record(z.string().max(500)).refine(v => Object.keys(v).length <= 20, { message: 'metadata cannot exceed 20 keys' }).optional(),
})

const batchSchema = z.object({
  events:    z.array(singleEventSchema).min(1).max(50),
  sessionId: z.string().optional(),
})

async function resolveContactId(): Promise<string | undefined> {
  try {
    const cookieStore = await cookies()
    // Public gate flow — cookie value is a signed JWT
    const verifiedToken = cookieStore.get('re_verified')?.value
    if (verifiedToken) {
      const contactId = await verifyVerifiedContactCookie(verifiedToken)
      if (contactId) return contactId
    }
    // Portal session (contact_token JWT)
    const contact = await getContactSession()
    return contact?.id ?? undefined
  } catch {
    return undefined
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const contactId = await resolveContactId()

    // Batch path
    if (Array.isArray(body?.events)) {
      const { events, sessionId } = batchSchema.parse(body)
      const hydratedEvents = events.map(e => ({ ...e, sessionId: e.sessionId ?? sessionId }))
      await trackBehaviorEventBatch(hydratedEvents, contactId)

      // Upsert ContactPropertyInterest for any listing_view events
      if (contactId) {
        const listingEvents = hydratedEvents.filter(e => e.eventType === 'listing_view' && e.entityId)
        await Promise.all(
          listingEvents.map(e =>
            prisma.contactPropertyInterest.upsert({
              where:  { contactId_resoPropertyId: { contactId, resoPropertyId: e.entityId! } },
              update: { updatedAt: new Date() },
              create: { contactId, resoPropertyId: e.entityId!, source: 'auto' },
            }).catch(() => null)
          )
        )
      }

      return NextResponse.json({ success: true, count: events.length })
    }

    // Single event path (backwards compat)
    const data = singleEventSchema.parse(body)
    await trackBehaviorEvent(data.eventType, data.entityId, contactId, data.sessionId, data.metadata)

    if (data.eventType === 'listing_view' && contactId && data.entityId) {
      await prisma.contactPropertyInterest.upsert({
        where:  { contactId_resoPropertyId: { contactId, resoPropertyId: data.entityId } },
        update: { updatedAt: new Date() },
        create: { contactId, resoPropertyId: data.entityId, source: 'auto' },
      }).catch(() => null)
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ success: false }, { status: 400 })
  }
}
