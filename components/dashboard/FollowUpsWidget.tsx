/**
 * FollowUpsWidget
 *
 * Dashboard widget showing contacts currently overdue for a follow-up per the
 * cadence analyzer (lib/followups/analyzer-service.ts) — segment breakdown
 * plus the top few most-overdue contacts, linking to the full /admin/followups page.
 */

import Link from 'next/link'
import { ArrowRight, Phone, Mail, MessageSquare } from 'lucide-react'
import { Card } from '@/components/layout'
import { Badge } from '@/components/ui'
import type { OverdueContactPreview } from '@/lib/followups/analyzer-service'

const SEGMENT_LABEL: Record<string, string> = {
  hot: 'Hot', warm: 'Warm', cool: 'Cool', past_client: 'Past Client', soi: 'SOI',
}

const CHANNEL_ICON = { email: Mail, text: MessageSquare, call: Phone } as const

interface FollowUpsWidgetProps {
  overdue: OverdueContactPreview[]
}

export function FollowUpsWidget({ overdue }: FollowUpsWidgetProps) {
  const bySegment = overdue.reduce<Record<string, number>>((acc, o) => {
    acc[o.segment] = (acc[o.segment] ?? 0) + 1
    return acc
  }, {})

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-charcoal-900">Follow-Ups Due</h3>
        <Link href="/admin/followups" className="text-xs text-gold-600 hover:text-gold-700 font-medium flex items-center gap-1">
          View all <ArrowRight size={11} />
        </Link>
      </div>

      {overdue.length === 0 ? (
        <p className="text-sm text-charcoal-400">Nobody's overdue right now — nice work.</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2 mb-4">
            {Object.entries(bySegment).map(([segment, count]) => (
              <Badge key={segment} variant={segment === 'hot' ? 'danger' : segment === 'warm' ? 'warning' : 'default'}>
                {SEGMENT_LABEL[segment] ?? segment}: {count}
              </Badge>
            ))}
          </div>

          <div className="flex flex-col gap-3">
            {overdue.slice(0, 5).map(contact => {
              const ChannelIcon = CHANNEL_ICON[contact.recommendedChannel]
              return (
                <Link
                  key={contact.contactId}
                  href={`/admin/contacts/${contact.contactId}`}
                  className="flex items-center gap-3 hover:bg-charcoal-50 -mx-2 px-2 py-1.5 rounded-lg transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-charcoal-900 truncate">{contact.name}</p>
                    <p className="text-xs text-charcoal-400">{contact.daysSinceLastTouch} days since last touch</p>
                  </div>
                  <ChannelIcon size={14} className="shrink-0 text-charcoal-400" />
                </Link>
              )
            })}
          </div>
        </>
      )}
    </Card>
  )
}
