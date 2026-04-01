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
 *
 * @param startAtStep  0-indexed step to begin at (default 0). Used by transfer_campaign steps.
 */
export async function enrollContact(sequenceId: string, contactId: string, startAtStep = 0) {
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

  // Clamp startAtStep to valid range
  const clampedStep = Math.max(0, Math.min(startAtStep, sequence.steps.length - 1))
  const entryStep   = sequence.steps[clampedStep]

  // For special_event campaigns compute the next run from the contact's data
  let nextRunAt: Date
  if (sequence.trigger === 'special_event') {
    const contact = await prisma.contact.findUnique({
      where:  { id: contactId },
      select: { birthday: true },
    })
    const lastDeal = await getLastClosedDealDate(contactId)
    const config        = JSON.parse(entryStep.config) as Record<string, unknown>
    const computedDate  = computeSpecialEventDate(config, contact?.birthday ?? null, lastDeal)
    if (!computedDate) return null   // Required contact data missing — skip enrollment
    nextRunAt = computedDate
  } else {
    nextRunAt = addMinutes(new Date(), entryStep.delayMinutes)
  }

  const enrollment = existing
    ? await prisma.campaignEnrollment.update({
        where: { id: existing.id },
        data:  { status: 'active', currentStep: clampedStep, nextRunAt, completedAt: null },
      })
    : await prisma.campaignEnrollment.create({
        data: { sequenceId, contactId, currentStep: clampedStep, nextRunAt },
      })

  // If the entry step is a create_task (call reminder), create it immediately
  // so the agent sees it on their calendar right away with dueAt = nextRunAt.
  if (entryStep.type === 'create_task') {
    const taskConfig  = JSON.parse(entryStep.config) as Record<string, unknown>
    const taskTitle   = taskConfig.title as string | undefined
    const taskDesc    = taskConfig.description as string | undefined
    const campaignTag = `Campaign: ${sequence.name}`
    const contactRec  = await prisma.contact.findUnique({
      where:  { id: contactId },
      select: { firstName: true, lastName: true },
    })
    const contactName = contactRec
      ? `${contactRec.firstName} ${contactRec.lastName}`.trim()
      : null
    const resolvedTitle = taskTitle
      ? (contactName ? `${taskTitle} — ${contactName}` : taskTitle)
      : (contactName ? `Call ${contactName}` : 'Call')
    await prisma.task.create({
      data: {
        title:       resolvedTitle,
        description: taskDesc ? `${taskDesc} · ${campaignTag}` : campaignTag,
        priority:    (taskConfig.priority as string) ?? 'normal',
        taskTypeId:  (taskConfig.taskTypeId as string) || null,
        contactId,
        dueAt:       nextRunAt,
      },
    })
    await prisma.campaignStepExecution.create({
      data: {
        enrollmentId: enrollment.id,
        stepId:       entryStep.id,
        status:       'completed',
        ranAt:        new Date(),
        result:       JSON.stringify({ type: 'create_task', scheduledFor: nextRunAt }),
      },
    })
    // Advance past the create_task step; the next step will be queued below
    // via a normal executeNextStep job if there is one, otherwise complete.
    const nextStepAfterEntry = sequence.steps[clampedStep + 1]
    if (nextStepAfterEntry) {
      const afterRunAt = sequence.trigger === 'special_event'
        ? null // special_event dates are computed per-step in executeNextStep
        : addMinutes(nextRunAt, nextStepAfterEntry.delayMinutes)
      const runAt = afterRunAt ?? nextRunAt
      await prisma.campaignEnrollment.update({
        where: { id: enrollment.id },
        data:  { currentStep: clampedStep + 1, nextRunAt: runAt },
      })
      await enqueueJob('execute_campaign_step', { enrollmentId: enrollment.id }, runAt)
    } else {
      await prisma.campaignEnrollment.update({
        where: { id: enrollment.id },
        data:  { status: 'completed', completedAt: new Date(), nextRunAt: null },
      })
    }
    return enrollment
  }

  // Queue the entry step
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

    // transfer_campaign completes the current enrollment then re-enrolls — skip normal advancement
    let transferred = false

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

      case 'create_task': {
        const taskTitle   = config.title as string | undefined
        const taskDesc    = config.description as string | undefined
        const campaignTag = `Campaign: ${enrollment.sequence.name}`
        const contactName = `${enrollment.contact.firstName} ${enrollment.contact.lastName}`.trim()
        const resolvedTitle = taskTitle
          ? `${taskTitle} — ${contactName}`
          : `Call ${contactName}`
        await prisma.task.create({
          data: {
            title:       resolvedTitle,
            description: taskDesc ? `${taskDesc} · ${campaignTag}` : campaignTag,
            priority:    (config.priority as string) ?? 'normal',
            taskTypeId:  (taskConfig.taskTypeId as string) || null,
            contactId:   enrollment.contactId,
            dueAt:       enrollment.nextRunAt ?? new Date(),
          },
        })
        break
      }

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

      case 'send_portal_invite':
        await enqueueJob('send_portal_invite_job', { contactId: enrollment.contactId })
        break

      case 'wait':
        // 'wait' steps just pause; the delay is handled by nextRunAt below
        break

      case 'transfer_campaign': {
        const targetSequenceId = config.targetSequenceId as string
        const startAtStep      = typeof config.startAtStep === 'number' ? config.startAtStep : 0

        // Enroll in the target campaign FIRST so that if it throws,
        // the current enrollment stays active and the job can be retried.
        if (targetSequenceId) {
          await enrollContact(targetSequenceId, enrollment.contactId, startAtStep)
        }

        // Only mark the current enrollment as completed after a successful transfer
        await prisma.campaignEnrollment.update({
          where: { id: enrollmentId },
          data:  { status: 'completed', completedAt: new Date(), nextRunAt: null },
        })

        transferred = true
        break
      }
    }

    // Mark step as completed
    await prisma.campaignStepExecution.update({
      where: { id: execution.id },
      data:  { status: 'completed', ranAt: new Date(), result: JSON.stringify({ type: step.type }) },
    })

    // Transfer already handled enrollment completion — skip normal advancement
    if (transferred) return

    // Advance enrollment to next step
    const nextStepIndex = stepIndex + 1
    const nextStep      = steps[nextStepIndex]

    if (nextStep) {
      let nextRunAt: Date
      if (enrollment.sequence.trigger === 'special_event') {
        const nextConfig    = JSON.parse(nextStep.config) as Record<string, unknown>
        const lastDeal      = await getLastClosedDealDate(enrollment.contactId)
        const computedDate  = computeSpecialEventDate(nextConfig, enrollment.contact.birthday, lastDeal)
        if (!computedDate) {
          // Required contact data missing — cannot schedule next step; complete enrollment
          await prisma.campaignEnrollment.update({
            where: { id: enrollmentId },
            data:  { status: 'completed', completedAt: new Date(), nextRunAt: null },
          })
          return
        }
        nextRunAt = computedDate
      } else {
        nextRunAt = addMinutes(new Date(), nextStep.delayMinutes)
      }

      // create_task steps are user-facing reminders, not system actions.
      // Create the task immediately so the agent sees it on their calendar
      // and task list right away; dueAt tells them when the call is due.
      if (nextStep.type === 'create_task') {
        const taskConfig  = JSON.parse(nextStep.config) as Record<string, unknown>
        const taskTitle   = taskConfig.title as string | undefined
        const taskDesc    = taskConfig.description as string | undefined
        const campaignTag = `Campaign: ${enrollment.sequence.name}`
        const contactName = `${enrollment.contact.firstName} ${enrollment.contact.lastName}`.trim()
        const resolvedTitle = taskTitle
          ? `${taskTitle} — ${contactName}`
          : `Call ${contactName}`
        await prisma.task.create({
          data: {
            title:       resolvedTitle,
            description: taskDesc ? `${taskDesc} · ${campaignTag}` : campaignTag,
            priority:    (taskConfig.priority as string) ?? 'normal',
            taskTypeId:  (taskConfig.taskTypeId as string) || null,
            contactId:   enrollment.contactId,
            dueAt:       nextRunAt,
          },
        })
        // Log this step as completed immediately
        await prisma.campaignStepExecution.create({
          data: {
            enrollmentId,
            stepId: nextStep.id,
            status: 'completed',
            ranAt:  new Date(),
            result: JSON.stringify({ type: 'create_task', scheduledFor: nextRunAt }),
          },
        })

        // Skip past the create_task step to the one after it
        const afterIndex = nextStepIndex + 1
        const afterStep  = steps[afterIndex]
        if (afterStep) {
          // For chained delays: the step after the call is timed from when
          // the call itself was scheduled, preserving the campaign timeline.
          const afterRunAt = enrollment.sequence.trigger === 'special_event'
            ? (() => {
                const afterConfig = JSON.parse(afterStep.config) as Record<string, unknown>
                return computeSpecialEventDate(afterConfig, enrollment.contact.birthday, null)
              })()
            : addMinutes(nextRunAt, afterStep.delayMinutes)

          if (!afterRunAt) {
            await prisma.campaignEnrollment.update({
              where: { id: enrollmentId },
              data:  { status: 'completed', completedAt: new Date(), nextRunAt: null },
            })
          } else {
            await prisma.campaignEnrollment.update({
              where: { id: enrollmentId },
              data:  { currentStep: afterIndex, nextRunAt: afterRunAt },
            })
            await enqueueJob('execute_campaign_step', { enrollmentId }, afterRunAt)
          }
        } else {
          // create_task was the last step — complete the enrollment
          await prisma.campaignEnrollment.update({
            where: { id: enrollmentId },
            data:  { status: 'completed', completedAt: new Date(), nextRunAt: null },
          })
        }
        return
      }

      await prisma.campaignEnrollment.update({
        where: { id: enrollmentId },
        data:  { currentStep: nextStepIndex, nextRunAt },
      })
      await enqueueJob('execute_campaign_step', { enrollmentId }, nextRunAt)
    } else {
      // Last step done — either cycle annually or complete
      const shouldRepeat =
        enrollment.sequence.repeatAnnually &&
        enrollment.sequence.trigger === 'special_event'

      if (shouldRepeat && steps.length > 0) {
        const step0Config    = JSON.parse(steps[0].config) as Record<string, unknown>
        const lastDeal       = await getLastClosedDealDate(enrollment.contactId)
        const nextRunAt      = computeSpecialEventDate(step0Config, enrollment.contact.birthday, lastDeal)

        if (nextRunAt) {
          // Cycle back to step 0 for next year
          await prisma.campaignEnrollment.update({
            where: { id: enrollmentId },
            data:  { currentStep: 0, nextRunAt, status: 'active', completedAt: null },
          })
          await enqueueJob('execute_campaign_step', { enrollmentId }, nextRunAt)
        } else {
          // Required contact data missing — fall back to completing
          await prisma.campaignEnrollment.update({
            where: { id: enrollmentId },
            data:  { status: 'completed', completedAt: new Date(), nextRunAt: null },
          })
        }
      } else {
        await prisma.campaignEnrollment.update({
          where: { id: enrollmentId },
          data:  { status: 'completed', completedAt: new Date(), nextRunAt: null },
        })
      }
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

/**
 * Compute the next run date for a special-event step.
 *
 * scheduleType:
 *   'contact_birthday'  — fires on the contact's next birthday
 *   'last_deal_closed'  — fires on the next anniversary of their last closed deal
 *   'fixed_date'        — fires on the next occurrence of month/day (e.g. Dec 25)
 *
 * offsetDays: negative = N days before the event, positive = after, 0 = same day
 *
 * Returns null if the required contact data is missing.
 */
function computeSpecialEventDate(
  config:              Record<string, unknown>,
  birthday:            Date | null,
  lastClosedDealDate:  Date | null,
): Date | null {
  const scheduleType = config.scheduleType as string
  const offsetDays   = (config.offsetDays  as number) ?? 0
  const now          = new Date()

  function nextAnnual(month: number, day: number): Date {
    // month is 0-indexed here
    const thisYear = new Date(now.getFullYear(), month, day)
    const runDate  = new Date(thisYear.getTime() + offsetDays * 86_400_000)
    if (runDate > now) return runDate
    const nextYear = new Date(now.getFullYear() + 1, month, day)
    return new Date(nextYear.getTime() + offsetDays * 86_400_000)
  }

  if (scheduleType === 'contact_birthday') {
    if (!birthday) return null
    const d = new Date(birthday)
    return nextAnnual(d.getMonth(), d.getDate())
  }

  if (scheduleType === 'last_deal_closed') {
    if (!lastClosedDealDate) return null
    const d = new Date(lastClosedDealDate)
    return nextAnnual(d.getMonth(), d.getDate())
  }

  if (scheduleType === 'fixed_date') {
    const month = ((config.fixedMonth as number) ?? 1) - 1 // convert 1-indexed to 0-indexed
    const day   = (config.fixedDay  as number) ?? 1
    return nextAnnual(month, day)
  }

  return null
}

/**
 * Fetch the date of the most recent closed deal a contact was a participant in.
 */
async function getLastClosedDealDate(contactId: string): Promise<Date | null> {
  const participant = await prisma.dealParticipant.findFirst({
    where:   { contactId, deal: { closedAt: { not: null } } },
    include: { deal: { select: { closedAt: true } } },
    orderBy: { deal: { closedAt: 'desc' } },
  })
  return participant?.deal.closedAt ?? null
}
