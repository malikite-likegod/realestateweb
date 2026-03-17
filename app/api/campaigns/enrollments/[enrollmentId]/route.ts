// PATCH /api/campaigns/enrollments/[enrollmentId] — update enrollment status (pause, resume, cancel)

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { enqueueJob } from '@/lib/automation/job-queue'
import { enrollContact } from '@/lib/automation/campaign-service'

const patchSchema = z.object({
  status: z.enum(['active', 'paused', 'cancelled', 'restart']),
})

interface Props { params: Promise<{ enrollmentId: string }> }

export async function PATCH(request: Request, { params }: Props) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { enrollmentId } = await params
    const body   = await request.json()
    const parsed = patchSchema.parse(body)

    const existing = await prisma.campaignEnrollment.findUnique({ where: { id: enrollmentId } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // ── Restart command ────────────────────────────────────────────────────────
    if (parsed.status === 'restart') {
      if (existing.status !== 'completed' && existing.status !== 'cancelled') {
        return NextResponse.json(
          { error: 'Can only restart a completed or cancelled enrollment' },
          { status: 422 },
        )
      }
      const result = await enrollContact(existing.sequenceId, existing.contactId, 0)
      if (!result) {
        return NextResponse.json(
          { error: 'Could not restart enrollment' },
          { status: 422 },
        )
      }
      return NextResponse.json({ data: result })
    }

    // ── Normal status update ───────────────────────────────────────────────────
    const enrollment = await prisma.campaignEnrollment.update({
      where: { id: enrollmentId },
      data:  {
        status:      parsed.status,
        completedAt: parsed.status === 'cancelled' ? new Date() : undefined,
      },
    })

    // When resuming a paused enrollment, re-enqueue the current step because
    // the original job was consumed (and skipped) while status was 'paused'.
    if (parsed.status === 'active' && existing.status === 'paused') {
      const nextRunAt = existing.nextRunAt && existing.nextRunAt > new Date()
        ? existing.nextRunAt
        : new Date()
      await enqueueJob('execute_campaign_step', { enrollmentId }, nextRunAt)
    }

    return NextResponse.json({ data: enrollment })
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.errors }, { status: 400 })
    console.error('[PATCH /api/campaigns/enrollments/[enrollmentId]]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
