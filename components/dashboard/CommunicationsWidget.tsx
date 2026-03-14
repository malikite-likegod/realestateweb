/**
 * CommunicationsWidget
 *
 * Dashboard widget showing recent inbound messages (SMS, missed calls, emails)
 * so agents can see what needs attention without leaving the dashboard.
 */

import Link from 'next/link'
import { MessageSquare, PhoneMissed, Mail, ArrowRight } from 'lucide-react'
import { Card } from '@/components/layout'
import { formatDate } from '@/lib/utils'

type InboxItem = {
  id:          string
  channel:     'sms' | 'call' | 'email'
  contactName: string
  contactId:   string | null
  preview:     string
  occurredAt:  Date | string
}

interface CommunicationsWidgetProps {
  items: InboxItem[]
}

const channelIcon: Record<string, React.ReactNode> = {
  sms:   <MessageSquare size={13} className="text-teal-600" />,
  call:  <PhoneMissed   size={13} className="text-red-500" />,
  email: <Mail          size={13} className="text-purple-600" />,
}

const channelBg: Record<string, string> = {
  sms:   'bg-teal-50',
  call:  'bg-red-50',
  email: 'bg-purple-50',
}

export function CommunicationsWidget({ items }: CommunicationsWidgetProps) {
  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-charcoal-900">Inbox</h3>
        <Link href="/admin/communications" className="text-xs text-gold-600 hover:text-gold-700 font-medium flex items-center gap-1">
          View all <ArrowRight size={11} />
        </Link>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-charcoal-400 py-4 text-center">No inbound messages.</p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {items.map(item => (
            <div key={`${item.channel}-${item.id}`} className="flex items-start gap-3">
              <div className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 ${channelBg[item.channel]}`}>
                {channelIcon[item.channel]}
              </div>
              <div className="flex-1 min-w-0">
                {item.contactId ? (
                  <Link href={`/admin/contacts/${item.contactId}`}
                    className="text-sm font-medium text-charcoal-900 hover:text-gold-600 truncate block">
                    {item.contactName}
                  </Link>
                ) : (
                  <p className="text-sm font-medium text-charcoal-900 truncate">{item.contactName}</p>
                )}
                <p className="text-xs text-charcoal-400 truncate">{item.preview}</p>
              </div>
              <span className="text-xs text-charcoal-300 shrink-0 mt-0.5">
                {formatDate(new Date(item.occurredAt), { month: 'short', day: 'numeric' })}
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
