import Link from 'next/link'
import { LogIn } from 'lucide-react'
import { Avatar } from '@/components/ui'
import { Card } from '@/components/layout'

interface PortalLogin {
  contactId: string
  lastLoginAt: Date
  contact: { firstName: string; lastName: string; email: string | null } | null
}

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (seconds < 60)    return 'just now'
  if (seconds < 3600)  return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

interface Props {
  logins: PortalLogin[]
}

export function RecentPortalLoginsWidget({ logins }: Props) {
  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-charcoal-900">Recent Portal Logins</h3>
        <span className="text-xs text-charcoal-400">Last 3 days</span>
      </div>

      {logins.length === 0 ? (
        <p className="text-sm text-charcoal-400 py-4 text-center">No portal logins in the last 3 days.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {logins.map(l => {
            const name = l.contact
              ? `${l.contact.firstName} ${l.contact.lastName}`.trim()
              : 'Unknown'
            return (
              <Link
                key={l.contactId}
                href={`/admin/contacts/${l.contactId}`}
                className="flex items-center gap-3 hover:bg-charcoal-50 -mx-2 px-2 py-1.5 rounded-lg transition-colors"
              >
                <Avatar name={name} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-charcoal-900 truncate">{name}</p>
                  <p className="text-xs text-charcoal-400 truncate">
                    {l.contact?.email ?? '—'}
                  </p>
                </div>
                <div className="flex items-center gap-1 text-xs text-charcoal-400 shrink-0">
                  <LogIn size={12} />
                  {timeAgo(l.lastLoginAt)}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </Card>
  )
}
