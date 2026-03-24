import { prisma } from '@/lib/prisma'

export const AUDIT_EVENTS = [
  'login_success',
  'login_failure',
  'logout',
  '2fa_sent',
  '2fa_success',
  '2fa_failure',
  'password_reset_request',
  'password_reset_complete',
  'password_change',
  'portal_login_success',
  'portal_login_failure',
  'portal_logout',
] as const

export type AuditEvent = (typeof AUDIT_EVENTS)[number]

interface AuditEventParams {
  event: AuditEvent
  actor?: string
  userId?: string
  contactId?: string
  ip?: string
  userAgent?: string
  meta?: Record<string, unknown>
}

export function extractIp(request: Request): string | undefined {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    const first = forwarded.split(',')[0].trim()
    if (first) return first
  }
  return request.headers.get('x-real-ip') ?? undefined
}

export function extractUserAgent(request: Request): string | undefined {
  return request.headers.get('user-agent') ?? undefined
}

export async function logAuditEvent(params: AuditEventParams): Promise<void> {
  try {
    await prisma.securityAuditLog.create({
      data: {
        event: params.event,
        actor: params.actor ?? null,
        userId: params.userId ?? null,
        contactId: params.contactId ?? null,
        ip: params.ip ?? null,
        userAgent: params.userAgent ?? null,
        meta: params.meta ? JSON.stringify(params.meta) : null,
      },
    })
  } catch (err) {
    // Fire-and-forget: logging must never interrupt auth flows
    console.error('[audit] Failed to write audit log:', err)
  }
}
