import { ActivityItem } from './ActivityItem'
import type { ActivityFeedItem } from '@/types'

interface ActivityTimelineProps {
  activities: ActivityFeedItem[]
}

export function ActivityTimeline({ activities }: ActivityTimelineProps) {
  if (activities.length === 0) {
    return <p className="text-sm text-charcoal-400 py-4">No activities yet.</p>
  }
  return (
    <div className="relative pl-6">
      <div className="absolute left-2 top-0 bottom-0 w-px bg-charcoal-100" />
      <div className="flex flex-col gap-0">
        {activities.map((a, i) => <ActivityItem key={a.id} activity={a} isLast={i === activities.length - 1} />)}
      </div>
    </div>
  )
}
