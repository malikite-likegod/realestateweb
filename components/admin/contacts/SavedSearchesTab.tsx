'use client'

import { useState, useEffect } from 'react'
import { Trash2, ExternalLink, Search } from 'lucide-react'
import { Button } from '@/components/ui'
import { formatDate } from '@/lib/utils'

interface SavedSearch {
  id:        string
  name:      string | null
  filters:   string
  createdAt: string
  lastRunAt: string | null
}

interface Props { contactId: string }

function filtersToLabel(filtersJson: string): string {
  try {
    const f = JSON.parse(filtersJson) as Record<string, string>
    const parts: string[] = []
    if (f.city)         parts.push(f.city)
    if (f.minPrice)     parts.push(`$${Number(f.minPrice).toLocaleString()}+`)
    if (f.maxPrice)     parts.push(`up to $${Number(f.maxPrice).toLocaleString()}`)
    if (f.minBeds)      parts.push(`${f.minBeds}+ beds`)
    if (f.propertyType) parts.push(f.propertyType)
    return parts.length ? parts.join(' · ') : 'All listings'
  } catch {
    return 'Search'
  }
}

function filtersToQS(filtersJson: string): string {
  try {
    const f = JSON.parse(filtersJson) as Record<string, string>
    return new URLSearchParams(f).toString()
  } catch {
    return ''
  }
}

export function SavedSearchesTab({ contactId }: Props) {
  const [searches, setSearches] = useState<SavedSearch[]>([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    fetch(`/api/contacts/${contactId}/saved-searches`)
      .then(r => r.json())
      .then(d => { setSearches(d.searches ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [contactId])

  async function handleDelete(id: string) {
    await fetch(`/api/contacts/${contactId}/saved-searches/${id}`, { method: 'DELETE' })
    setSearches(s => s.filter(x => x.id !== id))
  }

  if (loading) return <p className="text-sm text-charcoal-400 py-4">Loading saved searches…</p>

  if (searches.length === 0) {
    return (
      <div className="py-8 text-center">
        <Search size={32} className="mx-auto text-charcoal-200 mb-3" />
        <p className="text-sm text-charcoal-400">No saved searches yet.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {searches.map(s => (
        <div key={s.id} className="flex items-start justify-between gap-4 rounded-xl border border-charcoal-100 bg-charcoal-50 px-4 py-3">
          <div className="min-w-0">
            {s.name && <p className="text-sm font-semibold text-charcoal-900 truncate">{s.name}</p>}
            <p className="text-sm text-charcoal-600">{filtersToLabel(s.filters)}</p>
            <p className="text-xs text-charcoal-400 mt-0.5">
              Saved {formatDate(new Date(s.createdAt), { month: 'short', day: 'numeric', year: 'numeric' })}
              {s.lastRunAt && ` · Last run ${formatDate(new Date(s.lastRunAt), { month: 'short', day: 'numeric' })}`}
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button variant="ghost" size="sm" asChild>
              <a href={`/listings?${filtersToQS(s.filters)}`} target="_blank" rel="noreferrer">
                <ExternalLink size={14} />
              </a>
            </Button>
            <Button variant="ghost" size="sm" onClick={() => handleDelete(s.id)}>
              <Trash2 size={14} className="text-red-400" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}
