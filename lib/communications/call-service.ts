/**
 * Call Service
 *
 * Handles call log CRUD operations. The Twilio provider fields
 * (twilioCallSid, recordingUrl, transcription) are populated by the
 * incoming Twilio status-callback webhook once the provider is configured.
 * Until then, calls are logged manually by agents.
 */

import { prisma } from '@/lib/prisma'

export type CreateCallInput = {
  contactId?: string
  direction?: 'inbound' | 'outbound'
  status?: 'completed' | 'missed' | 'voicemail' | 'failed'
  durationSec?: number
  notes?: string
  recordingUrl?: string
  transcription?: string
  fromNumber?: string
  toNumber?: string
  twilioCallSid?: string
  loggedById?: string
  occurredAt?: Date
}

export async function createCallLog(input: CreateCallInput) {
  return prisma.callLog.create({
    data: {
      contactId:     input.contactId     ?? null,
      direction:     input.direction     ?? 'outbound',
      status:        input.status        ?? 'completed',
      durationSec:   input.durationSec   ?? null,
      notes:         input.notes         ?? null,
      recordingUrl:  input.recordingUrl  ?? null,
      transcription: input.transcription ?? null,
      fromNumber:    input.fromNumber    ?? null,
      toNumber:      input.toNumber      ?? null,
      twilioCallSid: input.twilioCallSid ?? null,
      loggedById:    input.loggedById    ?? null,
      occurredAt:    input.occurredAt    ?? new Date(),
    },
    include: { contact: { select: { firstName: true, lastName: true } }, loggedBy: { select: { name: true } } },
  })
}

export async function getCallLogs(opts: {
  contactId?: string
  page?: number
  pageSize?: number
}) {
  const page     = opts.page     ?? 1
  const pageSize = opts.pageSize ?? 20
  const where    = opts.contactId ? { contactId: opts.contactId } : {}

  const [total, data] = await Promise.all([
    prisma.callLog.count({ where }),
    prisma.callLog.findMany({
      where,
      orderBy:  { occurredAt: 'desc' },
      skip:     (page - 1) * pageSize,
      take:     pageSize,
      include: {
        contact:  { select: { firstName: true, lastName: true } },
        loggedBy: { select: { name: true } },
      },
    }),
  ])

  return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) }
}

export async function updateCallLog(
  id: string,
  patch: Partial<Pick<CreateCallInput, 'status' | 'notes' | 'recordingUrl' | 'transcription' | 'durationSec'>>,
) {
  return prisma.callLog.update({
    where: { id },
    data:  patch,
    include: { contact: { select: { firstName: true, lastName: true } }, loggedBy: { select: { name: true } } },
  })
}

export async function deleteCallLog(id: string) {
  return prisma.callLog.delete({ where: { id } })
}
