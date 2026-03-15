/**
 * Campaign Service
 *
 * Manages drip campaign (AutomationSequence) enrollments and step execution
 * scheduling. The actual sending of emails/SMS is handled by the job queue.
 *
 * Enrollment flow:
 *   1. enrollContact()     → creates CampaignEnrollment, queues first step
 *   2. Job processor runs  → executeNextStep() sends message / creates task
 *   3. After each step     → schedules next step via JobQueue with delay
 *   4. After last step     → marks enrollment as completed
 */

import { prisma } from '@/lib/prisma'
import { enqueueJob } from './job-queue'

// ─── Enrollment ─────────────────────────────────────────────────────────────

/**
 * Enroll a contact in a campaign (AutomationSequence).
 * Idempotent — silently skips if already enrolled and active.
 */
export async function enrollContact(sequenceId: string, contactId: string) {
  const sequence = await prisma.automationSequence.findUnique({
    where:   { id: sequenceId },
    include: { steps: { orderBy: { order: 'asc' } } },
  })
  if (!sequence || !sequence.isActive) return null
  if (sequence.steps.length === 0)     return null

  // Check for existing active enrollment
  const existing = await prisma.campaignEnrollment.findUnique({
    where: { sequenceId_contactId: { sequenceId, contactId } },
  })
  if (existing && existing.status === 'active') return existing

  const firstStep = sequence.steps[0]
  const nextRunAt = addMinutes(new Date(), firstStep.delayMinutes)

  const enrollment = existing
    ? await prisma.campaignEnrollment.update({
        where: { id: existing.id },
        data:  { status: 'active', currentStep: 0, nextRunAt, completedAt: null },
      })
    : await prisma.campaignEnrollment.create({
        data: { sequenceId, contactId, currentStep: 0, nextRunAt },
      })

  // Queue the first step
  await enqueueJob('execute_campaign_step', { enrollmentId: enrollment.id }, nextRunAt)
  return enrollment
}

/**
 * Enroll multiple contacts in a campaign at once.
 */
export async function bulkEnroll(sequenceId: string, contactIds: string[]) {
  const results = await Promise.allSettled(
    contactIds.map(id => enrollContact(sequenceId, id)),
  )
  return results
}

export async function pauseEnrollment(enrollmentId: string) {
  return prisma.campaignEnrollment.update({
    where: { id: enrollmentId },
    data:  { status: 'paused' },
  })
}

export async function cancelEnrollment(enrollmentId: string) {
  return prisma.campaignEnrollment.update({
    where: { id: enrollmentId },
    data:  { status: 'cancelled', completedAt: new Date() },
  })
}

export async function getEnrollments(sequenceId: string, opts?: { page?: number; pageSize?: number }) {
  const page     = opts?.page     ?? 1
  const pageSize = opts?.pageSize ?? 25

  const [total, data] = await Promise.all([
    prisma.campaignEnrollment.count({ where: { sequenceId } }),
    prisma.campaignEnrollment.findMany({
      where:   { sequenceId },
      orderBy: { enrolledAt: 'desc' },
      skip:    (page - 1) * pageSize,
      take:    pageSize,
      include: { contact: { select: { id: true, firstName: true, lastName: true, email: true } } },
    }),
  ])
  return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) }
}

/**
 * Execute the next pending step for an enrollment.
 * Called by the job queue processor.
 */
export async function executeNextStep(enrollmentId: string): Promise<void> {
  const enrollment = await prisma.campaignEnrollment.findUnique({
    where:   { id: enrollmentId },
    include: {
      sequence: { include: { steps: { orderBy: { order: 'asc' } } } },
      contact:  true,
    },
  })

  if (!enrollment || enrollment.status !== 'active') return

  const steps      = enrollment.sequence.steps
  const stepIndex  = enrollment.currentStep
  const step       = steps[stepIndex]
  if (!step) {
    // All steps done — mark complete
    await prisma.campaignEnrollment.update({
      where: { id: enrollmentId },
      data:  { status: 'completed', completedAt: new Date(), nextRunAt: null },
    })
    return
  }

  // Log execution attempt
  const execution = await prisma.campaignStepExecution.create({
    data: { enrollmentId, stepId: step.id, status: 'pending' },
  })

  try {
    const config = JSON.parse(step.config) as Record<string, unknown>

    switch (step.type) {
      case 'send_email':
        await enqueueJob('send_email_job', {
          contactId:      enrollment.contactId,
          subject:        config.subject        as string,
          body:           config.body           as string,
          templateId:     config.templateId     as string | undefined,
          toEmail:        enrollment.contact.email ?? undefined,
          attachmentUrl:  config.attachmentUrl  as string | undefined,
          attachmentName: config.attachmentName as string | undefined,
        })
        break

      case 'send_sms':
        if (enrollment.contact.phone) {
          await enqueueJob('send_sms_job', {
            contactId: enrollment.contactId,
            body:      config.body as string,
            toNumber:  enrollment.contact.phone,
          })
        }
        break

      case 'create_task':
        await prisma.task.create({
          data: {
            title:       (config.title as string) ?? 'Follow-up task',
            description: (config.description as string) ?? null,
            priority:    (config.priority  as string) ?? 'normal',
            contactId:   enrollment.contactId,
          },
        })
        break

      case 'update_lead_score': {
        const delta = (config.delta as number) ?? 0
        const contact = await prisma.contact.findUnique({ where: { id: enrollment.contactId } })
        if (contact) {
          const newScore = Math.min(100, Math.max(0, contact.leadScore + delta))
          await prisma.contact.update({ where: { id: enrollment.contactId }, data: { leadScore: newScore } })
          await prisma.leadScore.create({
            data: { contactId: enrollment.contactId, score: newScore, delta, reason: `Campaign: ${enrollment.sequence.name}` },
          })
        }
        break
      }

      case 'wait':
        // 'wait' steps just pause; the delay is handled by nextRunAt below
        break
    }

    // Mark step as completed
    await prisma.campaignStepExecution.update({
      where: { id: execution.id },
      data:  { status: 'completed', ranAt: new Date(), result: JSON.stringify({ type: step.type }) },
    })

    // Advance enrollment to next step
    const nextStepIndex = stepIndex + 1
    const nextStep      = steps[nextStepIndex]

    if (nextStep) {
      const nextRunAt = addMinutes(new Date(), nextStep.delayMinutes)
      await prisma.campaignEnrollment.update({
        where: { id: enrollmentId },
        data:  { currentStep: nextStepIndex, nextRunAt },
      })
      await enqueueJob('execute_campaign_step', { enrollmentId }, nextRunAt)
    } else {
      await prisma.campaignEnrollment.update({
        where: { id: enrollmentId },
        data:  { status: 'completed', completedAt: new Date(), nextRunAt: null },
      })
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await prisma.campaignStepExecution.update({
      where: { id: execution.id },
      data:  { status: 'failed', ranAt: new Date(), result: JSON.stringify({ error: message }) },
    })
    throw err
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000)
}
