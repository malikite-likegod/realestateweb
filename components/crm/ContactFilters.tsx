'use client'

/**
 * ContactFilters
 *
 * Status pill filters + optional tag dropdown for the contacts list.
 * Updates URL query params so the server page can filter server-side.
 */

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import type { Tag } from '@/types'

const STATUSES = [
  { value: '',            label: 'All' },
  { value: 'lead',        label: 'Lead' },
  { value: 'prospect',    label: 'Prospect' },
  { value: 'client',      label: 'Client' },
  { value: 'past_client', label: 'Past Client' },
]

interface ContactFiltersProps {
  tags?: Tag[]
}

export function ContactFilters({ tags }: ContactFiltersProps) {
  const router       = useRouter()
  const pathname     = usePathname()
  const searchParams = useSearchParams()
  const current      = searchParams.get('status') ?? ''
  const currentTag   = searchParams.get('tag')    ?? ''

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set(key, value)
    else        params.delete(key)
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      {STATUSES.map(s => (
        <button
          key={s.value}
          onClick={() => setParam('status', s.value)}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
            current === s.value
              ? 'bg-charcoal-900 text-white'
              : 'bg-charcoal-100 text-charcoal-600 hover:bg-charcoal-200'
          }`}
        >
          {s.label}
        </button>
      ))}

      {tags && tags.length > 0 && (
        <select
          value={currentTag}
          onChange={e => setParam('tag', e.target.value)}
          className="ml-2 px-2 py-1 rounded-full text-xs font-medium border border-charcoal-200 bg-white text-charcoal-600 focus:outline-none focus:ring-1 focus:ring-charcoal-400 cursor-pointer"
        >
          <option value="">All Tags</option>
          {tags.map(t => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      )}
    </div>
  )
}
