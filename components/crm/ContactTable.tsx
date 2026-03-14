'use client'

import Link from 'next/link'
import { Avatar, Badge } from '@/components/ui'
import { formatDate } from '@/lib/utils'
import type { ContactWithTags } from '@/types'

const statusVariants: Record<string, 'default' | 'info' | 'success' | 'gold' | 'warning'> = {
  lead: 'info', prospect: 'warning', client: 'success', past_client: 'default',
}

interface ContactTableProps {
  contacts: ContactWithTags[]
}

export function ContactTable({ contacts }: ContactTableProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-charcoal-100">
      <table className="w-full text-sm">
        <thead className="bg-charcoal-50 border-b border-charcoal-100">
          <tr>
            {['Name', 'Email', 'Phone', 'Status', 'Lead Score', 'Added'].map(h => (
              <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-charcoal-500 uppercase tracking-wide">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-charcoal-100 bg-white">
          {contacts.map(c => (
            <tr key={c.id} className="hover:bg-charcoal-50 transition-colors">
              <td className="px-4 py-3">
                <Link href={`/admin/contacts/${c.id}`} className="flex items-center gap-3">
                  <Avatar name={`${c.firstName} ${c.lastName}`} size="sm" />
                  <div>
                    <p className="font-medium text-charcoal-900">{c.firstName} {c.lastName}</p>
                    {c.company && <p className="text-xs text-charcoal-400">{c.company}</p>}
                  </div>
                </Link>
              </td>
              <td className="px-4 py-3 text-charcoal-600">{c.email ?? '—'}</td>
              <td className="px-4 py-3 text-charcoal-600">{c.phone ?? '—'}</td>
              <td className="px-4 py-3">
                <Badge variant={statusVariants[c.status] ?? 'default'} className="capitalize">
                  {c.status.replace('_', ' ')}
                </Badge>
              </td>
              <td className="px-4 py-3 text-charcoal-700 font-medium">{c.leadScore}</td>
              <td className="px-4 py-3 text-charcoal-400 text-xs">{formatDate(c.createdAt, { month: 'short', day: 'numeric', year: 'numeric' })}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
