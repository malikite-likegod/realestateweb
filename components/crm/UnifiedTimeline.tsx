'use client'

/**
 * UnifiedTimeline
 *
 * Renders a single chronological feed mixing calls, SMS, emails, notes,
 * tasks, and activities. Each entry type has its own icon and colour so
 * agents can scan the full history at a glance.
 */

import {
  Phone, MessageSquare, Mail, FileText, CheckSquare,
  ArrowRight, PhoneIncoming, PhoneOutgoing, PhoneMissed,
  Mic, ArrowDownLeft, ArrowUpRight,
} from 'lucide-react'
import { formatDate } from '@/lib/utils'
import type { TimelineEntry, TimelineEntryType } from '@/lib/communications/timeline-service'

interface UnifiedTimelineProps {
  entries: TimelineEntry[]
}

type EntryConfig = {
  icon:  React.ReactNode
  color: string
  label: string
}

function getConfig(entry: TimelineEntry): EntryConfig {
  switch (entry.type) {
    case 'call': {
      const status = entry.status
      if (status === 'missed') return { icon: <PhoneMissed size={12} />, color: 'bg-red-100 text-red-600', label: 'Missed Call' }
      if (status === 'voicemail') return { icon: <Mic size={12} />, color: 'bg-amber-100 text-amber-600', label: 'Voicemail' }
      return entry.direction === 'inbound'
        ? { icon: <PhoneIncoming size={12} />, color: 'bg-blue-100 text-blue-600', label: 'Inbound Call' }
        : { icon: <PhoneOutgoing size={12} />, color: 'bg-blue-100 text-blue-600', label: 'Outbound Call' }
    }
    case 'sms':
      return entry.direction === 'inbound'
        ? { icon: <ArrowDownLeft size={12} />, color: 'bg-teal-100 text-teal-600', label: 'SMS Received' }
        : { icon: <ArrowUpRight  size={12} />, color: 'bg-teal-100 text-teal-600', label: 'SMS Sent' }
    case 'email':
      return { icon: <Mail size={12} />, color: 'bg-purple-100 text-purple-600', label: entry.direction === 'inbound' ? 'Email Received' : 'Email Sent' }
    case 'note':
      return { icon: <FileText size={12} />, color: 'bg-amber-100 text-amber-600', label: 'Note' }
    case 'task':
      return { icon: <CheckSquare size={12} />, color: 'bg-green-100 text-green-600', label: 'Task' }
    case 'activity':
    default:
      return { icon: <ArrowRight size={12} />, color: 'bg-charcoal-100 text-charcoal-600', label: 'Activity' }
  }
}

function EntryItem({ entry, isLast }: { entry: TimelineEntry; isLast: boolean }) {
  const config = getConfig(entry)

  return (
    <div className={`relative flex gap-4 pb-5 ${isLast ? '' : ''}`}>
      {/* Timeline dot */}
      <div className={`absolute -left-6 flex h-5 w-5 items-center justify-center rounded-full ring-2 ring-white ${config.color}`}>
        {config.icon}
      </div>
      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-xs font-semibold text-charcoal-700">{config.label}</span>
          {entry.subject && <span className="text-xs text-charcoal-900 font-medium truncate">— {entry.subject}</span>}
          {entry.status && entry.type !== 'email' && (
            <span className="text-xs text-charcoal-400 capitalize">({entry.status})</span>
          )}
        </div>

        {entry.body && (
          <p className="text-xs text-charcoal-500 line-clamp-2">{
            // Strip HTML tags for preview
            entry.body.replace(/<[^>]+>/g, ' ').trim()
          }</p>
        )}

        {/* Call duration */}
        {entry.type === 'call' && entry.durationSec && (
          <p className="text-xs text-charcoal-400 mt-0.5">
            Duration: {Math.floor(entry.durationSec / 60)}m {entry.durationSec % 60}s
          </p>
        )}

        {/* Email tracking stats */}
        {entry.type === 'email' && entry.meta && (
          <div className="flex gap-3 mt-0.5">
            {(entry.meta.openCount as number) > 0 && (
              <span className="text-xs text-green-600">{entry.meta.openCount as number} open{(entry.meta.openCount as number) !== 1 ? 's' : ''}</span>
            )}
            {(entry.meta.clickCount as number) > 0 && (
              <span className="text-xs text-blue-600">{entry.meta.clickCount as number} click{(entry.meta.clickCount as number) !== 1 ? 's' : ''}</span>
            )}
          </div>
        )}

        <div className="flex items-center gap-2 mt-1 text-xs text-charcoal-300">
          {entry.userName && <span>{entry.userName}</span>}
          <span>·</span>
          <span>{formatDate(new Date(entry.occurredAt), { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
        </div>
      </div>
    </div>
  )
}

export function UnifiedTimeline({ entries }: UnifiedTimelineProps) {
  if (entries.length === 0) {
    return <p className="text-sm text-charcoal-400 py-4">No communications yet. Log a call, send an SMS, or compose an email to get started.</p>
  }

  return (
    <div className="relative pl-6">
      <div className="absolute left-2 top-0 bottom-0 w-px bg-charcoal-100" />
      <div className="flex flex-col gap-0">
        {entries.map((entry, i) => (
          <EntryItem key={`${entry.type}-${entry.id}`} entry={entry} isLast={i === entries.length - 1} />
        ))}
      </div>
    </div>
  )
}
