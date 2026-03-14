import { formatDate } from '@/lib/utils'
import type { ActivityFeedItem } from '@/types'

interface ActivityFeedProps {
  items: ActivityFeedItem[]
}

export function ActivityFeed({ items }: ActivityFeedProps) {
  return (
    <div className="flex flex-col divide-y divide-charcoal-100">
      {items.map(item => (
        <div key={item.id} className="flex items-start gap-3 py-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm text-charcoal-700 font-medium truncate">
              {item.type.replace('_', ' ')} — {item.subject ?? ''}
            </p>
            {item.contact && (
              <p className="text-xs text-charcoal-400">{item.contact.firstName} {item.contact.lastName}</p>
            )}
          </div>
          <span className="text-xs text-charcoal-300 shrink-0">
            {formatDate(item.occurredAt, { month: 'short', day: 'numeric' })}
          </span>
        </div>
      ))}
    </div>
  )
}
