import { NextResponse } from 'next/server'
import { z } from 'zod'
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
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ success: false }, { status: 400 })
  }
}
