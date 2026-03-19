'use client'

import { useState, useEffect, useCallback } from 'react'
import { formatPrice } from '@/lib/utils'
import { Home, X, Plus, Eye, Link as LinkIcon } from 'lucide-react'

interface ResoPropertyInfo {
  id:           string
  listingKey:   string
  streetNumber: string | null
  streetName:   string | null
  unitNumber:   string | null
  city:         string
  listPrice:    number | null
  propertySubType: string | null
  media:        string | null
}

interface Interest {
  id:             string
  resoPropertyId: string
  source:         string
  notes:          string | null
  updatedAt:      string
  resoProperty:   ResoPropertyInfo
}

interface ViewRecord {
  property:  ResoPropertyInfo
  count:     number
  firstSeen: string
  lastSeen:  string
}

interface Summary {
  topType:   string
  minPrice:  number
  maxPrice:  number
  topCity:   string
}

interface Props { contactId: string }

function getAddress(p: ResoPropertyInfo): string {
  return [p.streetNumber, p.streetName].filter(Boolean).join(' ') || p.listingKey
}

export function PropertyInterestsPanel({ contactId }: Props) {
  const [tab,         setTab]         = useState<'interests' | 'history'>('interests')
  const [interests,   setInterests]   = useState<Interest[]>([])
  const [viewHistory, setViewHistory] = useState<ViewRecord[]>([])
  const [summary,     setSummary]     = useState<Summary | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [showAdd,     setShowAdd]     = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<ResoPropertyInfo[]>([])
  const [searching,   setSearching]   = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    const res  = await fetch(`/api/contacts/${contactId}/property-interests`)
    const data = await res.json()
    setInterests(data.interests ?? [])
    setViewHistory(data.viewHistory ?? [])
    setSummary(data.summary ?? null)
    setLoading(false)
  }, [contactId])

  useEffect(() => { loadData() }, [loadData])

  async function searchListings(q: string) {
    if (!q.trim()) { setSearchResults([]); return }
    setSearching(true)
    const res  = await fetch(`/api/search?city=${encodeURIComponent(q)}&source=reso&pageSize=8`)
    const data = await res.json()
    setSearchResults((data.results ?? []).map((r: { id: string; listingKey?: string; address: string | null; city: string | null; price: number | null; propertyType: string | null; images: string[] }) => ({
      id:           r.id,
      listingKey:   r.listingKey ?? r.id,
      streetNumber: null,
      streetName:   r.address,
      unitNumber:   null,
      city:         r.city ?? '',
      listPrice:    r.price,
      propertySubType: r.propertyType,
      media:        r.images.length ? JSON.stringify(r.images.map((url, i) => ({ url, order: i + 1 }))) : null,
    })))
    setSearching(false)
  }

  async function addInterest(id: string) {
    await fetch(`/api/contacts/${contactId}/property-interests`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ resoPropertyId: id }),
    })
    setShowAdd(false)
    setSearchQuery('')
    setSearchResults([])
    loadData()
  }

  async function removeInterest(resoPropertyId: string) {
    await fetch(`/api/contacts/${contactId}/property-interests/${resoPropertyId}`, { method: 'DELETE' })
    loadData()
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const getFirstImage = (media: string | null): string => {
    try {
      const items = JSON.parse(media ?? '[]') as { url: string }[]
      return items[0]?.url ?? '/placeholder-property.jpg'
    }
    catch { return '/placeholder-property.jpg' }
  }

  return (
    <div className="rounded-xl border border-charcoal-100 overflow-hidden">
      {/* Summary header */}
      <div className="bg-charcoal-50 px-5 py-4 border-b border-charcoal-100">
        <h3 className="font-semibold text-charcoal-900 mb-1">Property Interests</h3>
        {summary ? (
          <p className="text-sm text-charcoal-500">
            Mostly viewing: <strong className="text-charcoal-700 capitalize">{summary.topType}</strong>
            {' · '}
            <strong className="text-charcoal-700">{formatPrice(summary.minPrice)}–{formatPrice(summary.maxPrice)}</strong>
            {' · '}
            <strong className="text-charcoal-700">{summary.topCity}</strong>
          </p>
        ) : (
          <p className="text-sm text-charcoal-400">No browsing data yet</p>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-charcoal-100">
        {(['interests', 'history'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2.5 text-sm font-medium capitalize transition-colors ${
              tab === t
                ? 'border-b-2 border-gold-500 text-gold-600'
                : 'text-charcoal-400 hover:text-charcoal-700'
            }`}
          >
            {t === 'interests' ? `Interests (${interests.length})` : `View History (${viewHistory.length})`}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-4">
        {loading ? (
          <p className="text-sm text-charcoal-400 text-center py-6">Loading…</p>
        ) : tab === 'interests' ? (
          <>
            <button
              onClick={() => setShowAdd(s => !s)}
              className="flex items-center gap-1.5 text-sm text-gold-600 hover:text-gold-700 mb-3 font-medium"
            >
              <Plus size={15} /> Add listing
            </button>

            {showAdd && (
              <div className="mb-4 rounded-lg border border-charcoal-200 p-3">
                <input
                  autoFocus
                  placeholder="Search listings…"
                  value={searchQuery}
                  onChange={e => { setSearchQuery(e.target.value); searchListings(e.target.value) }}
                  className="w-full text-sm border border-charcoal-200 rounded-lg px-3 py-2 mb-2 focus:outline-none focus:ring-2 focus:ring-gold-500"
                />
                {searching && <p className="text-xs text-charcoal-400">Searching…</p>}
                {searchResults.map(p => (
                  <button
                    key={p.id}
                    onClick={() => addInterest(p.id)}
                    className="flex items-start gap-2 w-full text-left rounded-lg hover:bg-charcoal-50 px-2 py-1.5 text-sm"
                  >
                    <Home size={14} className="shrink-0 text-charcoal-400 mt-0.5" />
                    <div>
                      <p className="text-charcoal-800 font-medium leading-tight">{getAddress(p)}, {p.city}</p>
                      <p className="text-charcoal-400 text-xs">{formatPrice(p.listPrice ?? 0)} · {p.propertySubType}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {interests.length === 0 ? (
              <p className="text-sm text-charcoal-400 text-center py-4">No interests recorded yet</p>
            ) : (
              <div className="flex flex-col gap-2">
                {interests.map(i => (
                  <div key={i.id} className="flex items-start gap-3 rounded-lg bg-charcoal-50 px-3 py-2.5">
                    <img
                      src={getFirstImage(i.resoProperty.media)}
                      alt={getAddress(i.resoProperty)}
                      className="h-12 w-16 rounded-md object-cover shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-charcoal-900 truncate">{getAddress(i.resoProperty)}, {i.resoProperty.city}</p>
                      <p className="text-xs text-charcoal-500">{formatPrice(i.resoProperty.listPrice ?? 0)} · <span className="capitalize">{i.resoProperty.propertySubType}</span></p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full font-medium ${
                          i.source === 'auto'
                            ? 'bg-blue-50 text-blue-600'
                            : 'bg-gold-50 text-gold-700'
                        }`}>
                          {i.source === 'auto' ? <Eye size={10} /> : <LinkIcon size={10} />}
                          {i.source === 'auto' ? 'Viewed' : 'Linked'}
                        </span>
                        <span className="text-xs text-charcoal-400">{formatDate(i.updatedAt)}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => removeInterest(i.resoPropertyId)}
                      className="shrink-0 text-charcoal-300 hover:text-red-500 transition-colors mt-0.5"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          /* View History tab */
          viewHistory.length === 0 ? (
            <p className="text-sm text-charcoal-400 text-center py-4">No view history yet</p>
          ) : (
            <div className="flex flex-col gap-2">
              {viewHistory.map(v => (
                <div key={v.property.id} className="flex items-start gap-3 rounded-lg bg-charcoal-50 px-3 py-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-charcoal-900 truncate">{getAddress(v.property)}, {v.property.city}</p>
                    <p className="text-xs text-charcoal-500">{formatPrice(v.property.listPrice ?? 0)} · <span className="capitalize">{v.property.propertySubType}</span></p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-semibold text-charcoal-700">{v.count} view{v.count !== 1 ? 's' : ''}</p>
                    <p className="text-xs text-charcoal-400">Last: {formatDate(v.lastSeen)}</p>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  )
}
