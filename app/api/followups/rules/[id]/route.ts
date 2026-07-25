// PATCH /api/followups/rules/[id] — edit a segment's cadence (interval, channel, template, priority, active)

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { updateFollowUpRule } from '@/lib/followups/rule-service'

const patchSchema = z.object({
  intervalDays:      z.number().int().min(1).optional(),
  preferredChannel:  z.enum(['email', 'text', 'call']).optional(),
  taskTitleTemplate: z.string().min(1).optional(),
  priority:          z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  isActive:          z.boolean().optional(),
})

interface Props { params: Promise<{ id: string }> }

export async function PATCH(request: Request, { params }: Props) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    const body   = await request.json()
    const parsed = patchSchema.parse(body)
    const rule   = await updateFollowUpRule(id, parsed)
    return NextResponse.json({ data: rule })
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.errors }, { status: 400 })
    console.error('[PATCH /api/followups/rules/[id]]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
