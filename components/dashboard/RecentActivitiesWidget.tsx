import Link from 'next/link'
import { Card } from '@/components/layout'
import { ActivityFeed } from '@/components/analytics'
import type { ActivityFeedItem } from '@/types'

interface RecentActivitiesWidgetProps {
  activities: ActivityFeedItem[]
}

export function RecentActivitiesWidget({ activities }: RecentActivitiesWidgetProps) {
  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-charcoal-900">Recent Activity</h3>
        <Link href="/admin/activities" className="text-xs text-gold-600 hover:text-gold-700 font-medium">View all</Link>
      </div>
      <ActivityFeed items={activities.slice(0, 8)} />
    </Card>
  )
}
