'use client'

import Link from 'next/link'
import { Avatar, Badge } from '@/components/ui'
import { formatDate } from '@/lib/utils'
import type { ContactWithTags } from '@/types'

const statusVariants: Record<string, 'default' | 'info' | 'success' | 'gold' | 'warning'> = {
  lead: 'info', prospect: 'warning', client: 'success', past_client: 'default',
}

interface ContactTableProps {
  contacts:          ContactWithTags[]
  selectedIds?:      Set<string>
  onToggle?:         (id: string) => void
  onToggleAll?:      (checked: boolean) => void
}

export function ContactTable({
  contacts,
  selectedIds,
  onToggle,
  onToggleAll,
}: ContactTableProps) {
  const selectable   = !!onToggle
  const allChecked   = selectable && contacts.length > 0 && contacts.every(c => selectedIds?.has(c.id))
  const someChecked  = selectable && !allChecked && contacts.some(c => selectedIds?.has(c.id))

  return (
    <div className="overflow-x-auto rounded-xl border border-charcoal-100">
      <table className="w-full text-sm">
        <thead className="bg-charcoal-50 border-b border-charcoal-100">
          <tr>
            {selectable && (
              <th className="px-4 py-3 w-10">
                <input
                  type="checkbox"
                  checked={allChecked}
                  ref={el => { if (el) el.indeterminate = someChecked }}
                  onChange={e => onToggleAll?.(e.target.checked)}
                  className="rounded border-charcoal-300 text-charcoal-900 cursor-pointer"
                />
              </th>
            )}
            {['Name', 'Email', 'Phone', 'Status', 'Lead Score', 'Added'].map(h => (
              <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-charcoal-500 uppercase tracking-wide">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-charcoal-100 bg-white">
          {contacts.map(c => (
            <tr
              key={c.id}
              className={`hover:bg-charcoal-50 transition-colors ${selectable && selectedIds?.has(c.id) ? 'bg-indigo-50' : ''}`}
            >
              {selectable && (
                <td className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={selectedIds?.has(c.id) ?? false}
                    onChange={() => onToggle?.(c.id)}
                    className="rounded border-charcoal-300 text-charcoal-900 cursor-pointer"
                  />
                </td>
              )}
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
              <td className="px-4 py-3 text-charcoal-600">{
                (() => {
                  const mobile  = c.phones.find(p => p.label === 'mobile')
                  const primary = c.phones.find(p => p.isPrimary)
                  const any     = c.phones[0]
                  return (mobile ?? primary ?? any)?.number ?? c.phone ?? ''
                })()
              }</td>
              <td className="px-4 py-3">
                <Badge variant={statusVariants[c.status] ?? 'default'} className="capitalize">
                  {c.status.replace('_', ' ')}
                </Badge>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="w-16 h-1.5 rounded-full bg-charcoal-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        c.leadScore >= 75 ? 'bg-green-500' :
                        c.leadScore >= 40 ? 'bg-gold-500' : 'bg-charcoal-300'
                      }`}
                      style={{ width: `${Math.min(c.leadScore, 100)}%` }}
                    />
                  </div>
                  <span className="text-xs text-charcoal-600 font-medium tabular-nums">{c.leadScore}</span>
                </div>
              </td>
              <td className="px-4 py-3 text-charcoal-400 text-xs">{formatDate(c.createdAt, { month: 'short', day: 'numeric', year: 'numeric' })}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
