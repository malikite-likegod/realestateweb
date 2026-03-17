/**
 * Job Queue
 *
 * Database-backed background job queue using the JobQueue Prisma model.
 * Compatible with any deployment — no Redis or separate worker process needed.
 *
 * Jobs are picked up by the processor at POST /api/automation/process,
 * which is called either by a cron request (x-cron-secret header) or manually.
 *
 * Supported job types:
 *   send_email_job          → sends an email via email-service
 *   send_sms_job            → sends an SMS via sms-service
 *   execute_campaign_step   → advances a campaign enrollment one step
 *   evaluate_rules          → fires automation rules for a given trigger+contact
 *   bulk_email_send         → sends one email to a bulk-send recipient via email-service
 */

import { prisma } from '@/lib/prisma'
import { readFile } from 'fs/promises'
import { join }     from 'path'

export type JobType =
  | 'send_email_job'
  | 'send_sms_job'
  | 'execute_campaign_step'
  | 'evaluate_rules'
  | 'bulk_email_send'

/**
 * Add a job to the queue.
 * @param type    Job handler identifier
 * @param payload Arbitrary data passed to the handler
 * @param runAt   Earliest execution time (defaults to now)
 */
export async function enqueueJob(
  type:    JobType,
  payload: Record<string, unknown>,
  runAt:   Date = new Date(),
) {
  return prisma.jobQueue.create({
    data: {
      type,
      payload: JSON.stringify(payload),
      runAt,
    },
  })
}

/**
 * Claim and process up to `limit` pending jobs whose runAt <= now().
 * Returns a summary of what was processed.
 */
export async function processPendingJobs(limit = 20): Promise<{
  processed: number
  failed:    number
  skipped:   number
}> {
  const now  = new Date()
  let processed = 0
  let failed    = 0
  let skipped   = 0

  // Fetch pending jobs (runAt in the past, not currently running)
  const jobs = await prisma.jobQueue.findMany({
    where:   { status: 'pending', runAt: { lte: now } },
    orderBy: { runAt: 'asc' },
    take:    limit,
  })

  for (const job of jobs) {
    // Optimistic lock: mark as running; skip if another process beat us to it
    const claimed = await prisma.jobQueue.updateMany({
      where: { id: job.id, status: 'pending' },
      data:  { status: 'running', startedAt: new Date(), attempts: { increment: 1 } },
    })
    if (claimed.count === 0) { skipped++; continue }

    try {
      const payload = JSON.parse(job.payload) as Record<string, unknown>
      await runJob(job.type as JobType, payload)

      await prisma.jobQueue.update({
        where: { id: job.id },
        data:  { status: 'completed', completedAt: new Date() },
      })
      processed++
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      const attempts = job.attempts + 1

      await prisma.jobQueue.update({
        where: { id: job.id },
        data:  {
          status: attempts >= job.maxAttempts ? 'failed' : 'pending',
          error:  message,
          // Exponential back-off: retry after 2^attempts minutes
          runAt:  attempts < job.maxAttempts
            ? new Date(Date.now() + Math.pow(2, attempts) * 60_000)
            : undefined,
        },
      })
      failed++
    }
  }

  return { processed, failed, skipped }
}

// ─── Job handlers ────────────────────────────────────────────────────────────

async function runJob(type: JobType, payload: Record<string, unknown>): Promise<void> {
  switch (type) {
    case 'send_email_job': {
      const { sendEmail } = await import('@/lib/communications/email-service')

      // Load attachment from disk if the step config stored a URL
      let attachments: Array<{ filename: string; content: Buffer }> | undefined
      const attachmentUrl  = payload.attachmentUrl  as string | undefined
      const attachmentName = payload.attachmentName as string | undefined
      if (attachmentUrl && attachmentName) {
        try {
          // attachmentUrl is e.g. "/uploads/uuid.pdf" — resolve from public/ folder.
          // Strip leading slash so path.join doesn't treat it as an absolute path on Unix.
          const filePath = join(process.cwd(), 'public', attachmentUrl.replace(/^\//, ''))
          const content  = await readFile(filePath)
          attachments    = [{ filename: attachmentName, content }]
        } catch (err) {
          console.warn('[send_email_job] Could not load attachment:', attachmentUrl, err)
        }
      }

      await sendEmail({
        contactId:   payload.contactId  as string,
        subject:     payload.subject    as string,
        body:        payload.body       as string,
        toEmail:     payload.toEmail    as string,
        templateId:  payload.templateId as string | undefined,
        attachments,
      })
      break
    }

    case 'send_sms_job': {
      const { sendSms } = await import('@/lib/communications/sms-service')
      await sendSms({
        contactId: payload.contactId as string,
        body:      payload.body      as string,
        toNumber:  payload.toNumber  as string,
      })
      break
    }

    case 'execute_campaign_step': {
      const { executeNextStep } = await import('@/lib/automation/campaign-service')
      await executeNextStep(payload.enrollmentId as string)
      break
    }

    case 'evaluate_rules': {
      const { evaluateRulesForTrigger } = await import('@/lib/automation/rule-service')
      await evaluateRulesForTrigger(
        payload.trigger   as string,
        payload.contactId as string | undefined,
        payload.dealId    as string | undefined,
        payload.meta      as Record<string, unknown> | undefined,
      )
      break
    }

    case 'bulk_email_send': {
      const { sendEmail } = await import('@/lib/communications/email-service')
      // Note: sendEmail() resolves merge tags internally (spec "runner behavior step 2")
      // — no separate resolveMergeTags call is needed here.
      await sendEmail({
        contactId:  payload.contactId  as string,
        subject:    payload.subject    as string,
        body:       payload.body       as string,
        toEmail:    payload.toEmail    as string,
        templateId: payload.templateId as string | undefined,
      })
      break
    }

    default:
      throw new Error(`Unknown job type: ${type}`)
  }
}
