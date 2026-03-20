import { prisma } from '@/lib/prisma'

export type NotificationType =
  | 'inbound_sms'
  | 'inbound_email'
  | 'new_contact'
  | 'sms_unsubscribe'
  | 'email_unsubscribe'

export async function createNotification(opts: {
  type: NotificationType
  title: string
  body?: string
  contactId?: string | null
}) {
  try {
    return await prisma.notification.create({
      data: {
        type:      opts.type,
        title:     opts.title,
        body:      opts.body ?? null,
        contactId: opts.contactId ?? null,
      },
    })
  } catch (err) {
    // Non-critical — log and continue
    console.error('[notifications] Failed to create notification:', err)
  }
}
