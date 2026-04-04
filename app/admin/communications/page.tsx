/**
 * Communications Inbox (/admin/communications)
 *
 * Shows a unified view of recent inbound messages across all channels:
 * - Inbound SMS from contacts
 * - Inbound/received emails
 * - Missed calls and voicemails
 *
 * Each row links to the sending contact's profile so the agent can reply
 * from the contact detail page.
 */

import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { DashboardLayout } from '@/components/dashboard'
import { PageHeader } from '@/components/layout'
import { Card } from '@/components/layout'
import { Phone, MessageSquare, Mail, PhoneMissed } from 'lucide-react'
import { InboxComposeButton }  from '@/components/communications/InboxComposeButton'
import { InboxClientShell }    from '@/components/communications/InboxClientShell'

export default async function CommunicationsPage() {
  const session = await getSession()
  if (!session) redirect('/admin/login')

  // Fetch recent inbound items in parallel
  const [inboundSms, missedCalls, inboundEmails] = await Promise.all([
    prisma.smsMessage.findMany({
      where:   { direction: 'inbound' },
      orderBy: { sentAt: 'desc' },
      take:    25,
      include: { contact: { select: { id: true, firstName: true, lastName: true } } },
    }),
    prisma.callLog.findMany({
      where:   { status: { in: ['missed', 'voicemail'] } },
      orderBy: { occurredAt: 'desc' },
      take:    25,
      include: { contact: { select: { id: true, firstName: true, lastName: true } } },
    }),
    prisma.emailMessage.findMany({
      where:   { direction: 'inbound' },
      orderBy: { sentAt: 'desc' },
      take:    25,
      include: { contact: { select: { id: true, firstName: true, lastName: true } } },
    }),
  ])

  // Normalise all items into one sortable list
  const items = [
    ...inboundSms.map(m => ({
      id:          m.id,
      channel:     'sms' as const,
      status:      m.status,
      preview:     m.body.slice(0, 80),
      contactId:   m.contactId,
      contactName: m.contact ? `${m.contact.firstName} ${m.contact.lastName}` : (m.fromNumber ?? 'Unknown'),
      occurredAt:  m.sentAt,
    })),
    ...missedCalls.map(c => ({
      id:          c.id,
      channel:     'call' as const,
      status:      c.status,
      preview:     c.notes ?? (c.status === 'voicemail' ? 'Voicemail received' : 'Missed call'),
      contactId:   c.contactId,
      contactName: c.contact ? `${c.contact.firstName} ${c.contact.lastName}` : (c.fromNumber ?? 'Unknown'),
      occurredAt:  c.occurredAt,
    })),
    ...inboundEmails.map(e => ({
      id:          e.id,
      channel:     'email' as const,
      status:      e.status,
      preview:     e.subject,
      contactId:   e.contactId,
      contactName: e.contact ? `${e.contact.firstName} ${e.contact.lastName}` : (e.fromEmail ?? 'Unknown'),
      occurredAt:  e.sentAt,
    })),
  ].sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())

  return (
    <DashboardLayout user={session}>
      <PageHeader
        title="Communications Inbox"
        subtitle="Inbound SMS, missed calls, and received emails"
        breadcrumbs={[
          { label: 'Dashboard', href: '/admin/dashboard' },
          { label: 'Communications' },
        ]}
        actions={<InboxComposeButton />}
      />

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Inbound SMS',    count: inboundSms.length,    icon: <MessageSquare size={16} />, color: 'text-teal-600' },
          { label: 'Missed / VMs',   count: missedCalls.length,   icon: <PhoneMissed   size={16} />, color: 'text-red-600' },
          { label: 'Inbound Emails', count: inboundEmails.length, icon: <Mail          size={16} />, color: 'text-purple-600' },
        ].map(stat => (
          <Card key={stat.label} className="flex items-center gap-4">
            <div className={`${stat.color}`}>{stat.icon}</div>
            <div>
              <p className="text-2xl font-bold text-charcoal-900">{stat.count}</p>
              <p className="text-xs text-charcoal-500">{stat.label}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Inbox list */}
      <Card>
        <InboxClientShell items={items} />
      </Card>
    </DashboardLayout>
  )
}
