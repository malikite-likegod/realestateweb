import { Phone, Mail, Users, FileText, Home, CheckSquare, ArrowRight } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import type { ActivityFeedItem, ActivityType } from '@/types'

const typeConfig: Record<ActivityType, { icon: React.ReactNode; color: string; label: string }> = {
  call:        { icon: <Phone size={12} />,      color: 'bg-blue-100 text-blue-600',    label: 'Call' },
  email:       { icon: <Mail size={12} />,       color: 'bg-purple-100 text-purple-600', label: 'Email' },
  meeting:     { icon: <Users size={12} />,      color: 'bg-green-100 text-green-600',  label: 'Meeting' },
  note:        { icon: <FileText size={12} />,   color: 'bg-amber-100 text-amber-600',  label: 'Note' },
  showing:     { icon: <Home size={12} />,       color: 'bg-rose-100 text-rose-600',    label: 'Showing' },
  task:        { icon: <CheckSquare size={12} />, color: 'bg-teal-100 text-teal-600',   label: 'Task' },
  deal_change: { icon: <ArrowRight size={12} />, color: 'bg-charcoal-100 text-charcoal-600', label: 'Deal Update' },
}

interface ActivityItemProps {
  activity: ActivityFeedItem
  isLast?: boolean
}

export function ActivityItem({ activity, isLast }: ActivityItemProps) {
  const config = typeConfig[activity.type] ?? typeConfig.note
  return (
    <div className={`relative flex gap-4 pb-5 ${isLast ? '' : ''}`}>
      {/* Icon */}
      <div className={`absolute -left-6 flex h-5 w-5 items-center justify-center rounded-full ring-2 ring-white ${config.color}`}>
        {config.icon}
      </div>
      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-xs font-semibold text-charcoal-700">{config.label}</span>
          {activity.subject && <span className="text-xs text-charcoal-900 font-medium truncate">— {activity.subject}</span>}
        </div>
        {activity.body && <p className="text-xs text-charcoal-500 line-clamp-2">{activity.body}</p>}
        <div className="flex items-center gap-2 mt-1 text-xs text-charcoal-300">
          {activity.user && <span>{activity.user.name}</span>}
          <span>·</span>
          <span>{formatDate(activity.occurredAt, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
        </div>
      </div>
    </div>
  )
}
