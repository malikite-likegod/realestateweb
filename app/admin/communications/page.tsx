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

import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { DashboardLayout } from '@/components/dashboard'
import { PageHeader } from '@/components/layout'
import { Card } from '@/components/layout'
import { Badge } from '@/components/ui'
import { formatDate } from '@/lib/utils'
import { Phone, MessageSquare, Mail, PhoneMissed, Mic } from 'lucide-react'
import Link from 'next/link'

export default async function CommunicationsPage() {
  const session = await getSession()
  if (!session) return null

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

  type InboxItem = {
    id:          string
    channel:     'sms' | 'call' | 'email'
    status:      string
    preview:     string
    contactId:   string | null
    contactName: string
    occurredAt:  Date
  }

  // Normalise all items into one sortable list
  const items: InboxItem[] = [
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

  const channelIcon: Record<InboxItem['channel'], React.ReactNode> = {
    sms:   <MessageSquare size={14} />,
    call:  <Phone size={14} />,
    email: <Mail size={14} />,
  }

  const channelColor: Record<InboxItem['channel'], string> = {
    sms:   'bg-teal-100 text-teal-600',
    call:  'bg-red-100 text-red-600',
    email: 'bg-purple-100 text-purple-600',
  }

  function StatusIcon({ item }: { item: InboxItem }) {
    if (item.channel === 'call' && item.status === 'voicemail') return <Mic size={14} />
    if (item.channel === 'call' && item.status === 'missed')    return <PhoneMissed size={14} />
    return channelIcon[item.channel]
  }

  return (
    <DashboardLayout user={session}>
      <PageHeader
        title="Communications Inbox"
        subtitle="Inbound SMS, missed calls, and received emails"
        breadcrumbs={[
          { label: 'Dashboard', href: '/admin/dashboard' },
          { label: 'Communications' },
        ]}
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
        {items.length === 0 ? (
          <p className="text-sm text-charcoal-400 text-center py-12">No inbound communications yet.</p>
        ) : (
          <div className="divide-y divide-charcoal-100">
            {items.map(item => (
              <div key={`${item.channel}-${item.id}`} className="flex items-start gap-4 py-3 hover:bg-charcoal-50 px-2 rounded-lg transition-colors">
                {/* Channel icon */}
                <div className={`mt-0.5 h-8 w-8 shrink-0 rounded-full flex items-center justify-center ${channelColor[item.channel]}`}>
                  <StatusIcon item={item} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    {item.contactId ? (
                      <Link href={`/admin/contacts/${item.contactId}`}
                        className="text-sm font-semibold text-charcoal-900 hover:text-gold-600 transition-colors">
                        {item.contactName}
                      </Link>
                    ) : (
                      <span className="text-sm font-semibold text-charcoal-900">{item.contactName}</span>
                    )}
                    <Badge variant="default" className="capitalize text-xs">{item.channel}</Badge>
                    {item.channel === 'call' && (
                      <Badge variant="default" className="capitalize text-xs">{item.status}</Badge>
                    )}
                  </div>
                  <p className="text-xs text-charcoal-500 truncate">{item.preview}</p>
                </div>

                {/* Time */}
                <span className="text-xs text-charcoal-400 shrink-0 mt-0.5">
                  {formatDate(item.occurredAt, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </DashboardLayout>
  )
}
