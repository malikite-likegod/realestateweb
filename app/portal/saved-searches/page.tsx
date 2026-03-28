'use client'

import { useState, useEffect, useCallback } from 'react'
import { Search, Trash2, ArrowRight } from 'lucide-react'
import { PortalHeader } from '@/components/portal/PortalHeader'
import { useRouter } from 'next/navigation'

interface SavedSearch {
  id:        string
  name:      string
  filters:   string
  createdAt: string
}

function filtersToQuery(filtersJson: string): string {
  try {
    const f = JSON.parse(filtersJson) as Record<string, string>
    const p = new URLSearchParams()
    Object.entries(f).forEach(([k, v]) => { if (v) p.set(k, v) })
    return p.toString() ? `?${p.toString()}` : ''
  } catch {
    return ''
  }
}

function friendlyFilters(filtersJson: string): string {
  try {
    const f = JSON.parse(filtersJson) as Record<string, string>
    const parts: string[] = []
    if (f.city)         parts.push(f.city)
    if (f.community)    parts.push(f.community)
    if (f.propertyType) parts.push(f.propertyType)
    if (f.listingType)  parts.push(f.listingType === 'lease' ? 'For Lease' : 'For Sale')
    if (f.minPrice || f.maxPrice) {
      const lo = f.minPrice ? `$${Number(f.minPrice).toLocaleString()}` : ''
      const hi = f.maxPrice ? `$${Number(f.maxPrice).toLocaleString()}` : ''
      parts.push(lo && hi ? `${lo}–${hi}` : lo ? `${lo}+` : `up to ${hi}`)
    }
    if (f.minBeds)   parts.push(`${f.minBeds}+ bed`)
    if (f.minBaths)  parts.push(`${f.minBaths}+ bath`)
    if (f.minGarage) parts.push(`${f.minGarage}+ garage`)
    if (f.minSqft || f.maxSqft) {
      const lo = f.minSqft ? `${Number(f.minSqft).toLocaleString()} sqft` : ''
      const hi = f.maxSqft ? `${Number(f.maxSqft).toLocaleString()} sqft` : ''
      parts.push(lo && hi ? `${lo}–${hi}` : lo ? `${lo}+` : `up to ${hi}`)
    }
    return parts.join(' · ') || 'All listings'
  } catch {
    return '—'
  }
}

export default function SavedSearchesPage() {
  const router = useRouter()
  const [searches, setSearches] = useState<SavedSearch[]>([])
  const [loading,  setLoading]  = useState(true)
  const [contact,  setContact]  = useState<{ firstName: string | null } | null>(null)

  const load = useCallback(async () => {
    const [sessRes, searchRes] = await Promise.all([
      fetch('/api/portal/session'),
      fetch('/api/portal/saved-searches'),
    ])
    if (sessRes.ok) {
      const s = await sessRes.json()
      setContact(s)
    }
    if (searchRes.ok) {
      const d = await searchRes.json()
      setSearches(d.data ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function remove(id: string) {
    await fetch(`/api/portal/saved-searches/${id}`, { method: 'DELETE' })
    setSearches(s => s.filter(x => x.id !== id))
  }

  function runSearch(filtersJson: string) {
    const query = filtersToQuery(filtersJson)
    router.push(`/portal${query}`)
  }

  return (
    <>
      <PortalHeader firstName={contact?.firstName ?? null} />
      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold text-gray-900">Saved Searches</h1>
          <a href="/portal" className="text-sm text-gray-500 hover:text-gray-700">Browse listings</a>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
          </div>
        ) : searches.length === 0 ? (
          <div className="text-center py-16">
            <Search size={32} className="mx-auto text-gray-300 mb-3" strokeWidth={1.5} />
            <p className="text-gray-400 mb-2">No saved searches yet.</p>
            <a href="/portal" className="text-sm text-amber-600 hover:text-amber-700">Browse listings to save a search →</a>
          </div>
        ) : (
          <div className="space-y-3">
            {searches.map(s => (
              <div key={s.id} className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3.5 hover:border-amber-300 transition-colors">
                <Search size={16} className="shrink-0 text-amber-500 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{s.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5 truncate">{friendlyFilters(s.filters)}</p>
                  <p className="text-xs text-gray-300 mt-0.5">
                    Saved {new Date(s.createdAt).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => runSearch(s.filters)}
                    title="Run search"
                    className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-800 font-medium"
                  >
                    View <ArrowRight size={13} />
                  </button>
                  <button
                    onClick={() => remove(s.id)}
                    title="Delete"
                    className="text-gray-300 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  )
}
