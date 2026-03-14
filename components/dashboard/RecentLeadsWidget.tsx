import Link from 'next/link'
import { Avatar, Badge } from '@/components/ui'
import { Card } from '@/components/layout'
import { formatDate } from '@/lib/utils'
import type { ContactWithTags } from '@/types'

interface RecentLeadsWidgetProps {
  leads: ContactWithTags[]
}

export function RecentLeadsWidget({ leads }: RecentLeadsWidgetProps) {
  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-charcoal-900">Recent Leads</h3>
        <Link href="/admin/contacts" className="text-xs text-gold-600 hover:text-gold-700 font-medium">View all</Link>
      </div>
      <div className="flex flex-col gap-3">
        {leads.slice(0, 6).map(lead => (
          <Link key={lead.id} href={`/admin/contacts/${lead.id}`} className="flex items-center gap-3 hover:bg-charcoal-50 -mx-2 px-2 py-1.5 rounded-lg transition-colors">
            <Avatar name={`${lead.firstName} ${lead.lastName}`} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-charcoal-900 truncate">{lead.firstName} {lead.lastName}</p>
              <p className="text-xs text-charcoal-400">{formatDate(lead.createdAt, { month: 'short', day: 'numeric' })}</p>
            </div>
            <Badge variant="info" className="shrink-0 text-xs">Lead</Badge>
          </Link>
        ))}
      </div>
    </Card>
  )
}
