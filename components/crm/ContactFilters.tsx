'use client'

/**
 * ContactFilters
 *
 * Status pill filters for the contacts list. Updates the URL query param
 * so the server page can filter by status server-side.
 */

import { useRouter, usePathname, useSearchParams } from 'next/navigation'

const STATUSES = [
  { value: '',           label: 'All' },
  { value: 'lead',       label: 'Lead' },
  { value: 'prospect',   label: 'Prospect' },
  { value: 'client',     label: 'Client' },
  { value: 'past_client', label: 'Past Client' },
]

export function ContactFilters() {
  const router      = useRouter()
  const pathname    = usePathname()
  const searchParams = useSearchParams()
  const current     = searchParams.get('status') ?? ''

  function setStatus(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set('status', value)
    else        params.delete('status')
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {STATUSES.map(s => (
        <button
          key={s.value}
          onClick={() => setStatus(s.value)}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
            current === s.value
              ? 'bg-charcoal-900 text-white'
              : 'bg-charcoal-100 text-charcoal-600 hover:bg-charcoal-200'
          }`}
        >
          {s.label}
        </button>
      ))}
    </div>
  )
}
