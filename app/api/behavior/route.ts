import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { trackBehaviorEvent } from '@/services/ai/lead-scoring'

const eventSchema = z.object({
  eventType: z.string(),
  entityId:  z.string().optional(),
  contactId: z.string().optional(),
  sessionId: z.string().optional(),
  metadata:  z.record(z.unknown()).optional(),
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const data = eventSchema.parse(body)

    await trackBehaviorEvent(data.eventType, data.entityId, data.contactId, data.sessionId, data.metadata)

    // When a verified contact views a listing, upsert a ContactPropertyInterest record
    if (data.eventType === 'listing_view' && data.contactId && data.entityId) {
      await prisma.contactPropertyInterest.upsert({
        where:  { contactId_resoPropertyId: { contactId: data.contactId, resoPropertyId: data.entityId } },
        update: { updatedAt: new Date() },
        create: { contactId: data.contactId, resoPropertyId: data.entityId, source: 'auto' },
      })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ success: false }, { status: 400 })
  }
}
