'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Search, SlidersHorizontal, ChevronLeft, ChevronRight, Bookmark, BookmarkCheck, X } from 'lucide-react'
import { ResoListingCard, type ResoProperty } from './ResoListingCard'
import { MlsDisclaimer } from '@/components/mls/MlsDisclaimer'
import { AutocompleteInput } from '@/components/ui/AutocompleteInput'

interface Filters {
  city:         string
  community:    string
  propertyType: string
  listingType:  string
  minPrice:     string
  maxPrice:     string
  minBeds:      string
  minBaths:     string
  minGarage:    string
  minSqft:      string
  maxSqft:      string
}

const EMPTY: Filters = {
  city: '', community: '', propertyType: '', listingType: '',
  minPrice: '', maxPrice: '', minBeds: '', minBaths: '',
  minGarage: '', minSqft: '', maxSqft: '',
}

const PROPERTY_TYPES = ['Detached', 'Semi-Detached', 'Condo Apt', 'Condo Townhouse', 'Townhouse', 'Link', 'Duplex', 'Commercial']

function hasFilters(f: Filters) {
  return Object.values(f).some(v => v !== '')
}

function filtersToParams(f: Filters, page: number): URLSearchParams {
  const p = new URLSearchParams()
  Object.entries(f).forEach(([k, v]) => { if (v) p.set(k, v) })
  p.set('page', String(page))
  return p
}

function friendlyLabel(f: Filters): string {
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
}

interface Props { firstName: string | null; agentEmail: string }

export function PortalListings({ firstName, agentEmail }: Props) {
  const [filters,     setFilters]     = useState<Filters>(EMPTY)
  const [applied,     setApplied]     = useState<Filters>(EMPTY)
  const [properties,  setProperties]  = useState<ResoProperty[]>([])
  const [total,       setTotal]       = useState(0)
  const [totalPages,  setTotalPages]  = useState(1)
  const [page,        setPage]        = useState(1)
  const [loading,     setLoading]     = useState(true)
  const [showMore,    setShowMore]    = useState(false)
  const [capped,      setCapped]      = useState(false)

  const [cityOptions,      setCityOptions]      = useState<string[]>([])
  const [communityOptions, setCommunityOptions] = useState<string[]>([])

  useEffect(() => {
    fetch('/api/search/geo?level=areas').then(r => r.json()).then(d => setCityOptions(d ?? []))
    fetch('/api/search/geo?level=communities').then(r => r.json()).then(d => setCommunityOptions(d ?? []))
  }, [])

  // Save search state
  const [saveOpen,    setSaveOpen]    = useState(false)
  const [searchName,  setSearchName]  = useState('')
  const [saveStatus,  setSaveStatus]  = useState<'idle' | 'saving' | 'saved'>('idle')
  const saveRef = useRef<HTMLDivElement>(null)

  const fetchListings = useCallback(async (f: Filters, p: number) => {
    setLoading(true)
    const params = filtersToParams(f, p)
    const res  = await fetch(`/api/portal/listings?${params}`)
    const data = await res.json()
    setProperties(data.data ?? [])
    setTotal(data.total ?? 0)
    setTotalPages(data.totalPages ?? 1)
    setCapped(data.capped ?? false)
    setLoading(false)
  }, [])

  useEffect(() => { fetchListings(applied, 1) }, [fetchListings, applied])

  useEffect(() => {
    fetchListings(applied, page)
    window.scrollTo({ top: 0, behavior: 'smooth' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  // Close save popover on outside click
  useEffect(() => {
    if (!saveOpen) return
    function handler(e: MouseEvent) {
      if (saveRef.current && !saveRef.current.contains(e.target as Node)) setSaveOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [saveOpen])

  function applyFilters() {
    setPage(1)
    setApplied(filters)
    setSaveStatus('idle')
    fetch('/api/behavior', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ eventType: 'search', metadata: { ...filters } }),
    }).catch(() => null)
  }

  function clearFilters() {
    setFilters(EMPTY)
    setApplied(EMPTY)
    setPage(1)
    setSaveStatus('idle')
  }

  function update(k: keyof Filters, v: string) {
    setFilters(f => ({ ...f, [k]: v }))
  }

  async function saveSearch() {
    if (!searchName.trim()) return
    setSaveStatus('saving')
    const res = await fetch('/api/portal/saved-searches', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ name: searchName.trim(), filters: applied }),
    })
    if (res.ok) {
      setSaveStatus('saved')
      setSaveOpen(false)
      setSearchName('')
    } else {
      setSaveStatus('idle')
    }
  }

  const start = (page - 1) * 20 + 1
  const end   = Math.min(page * 20, total)

  const inputCls = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500'
  const selectCls = inputCls

  return (
    <main className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            {firstName ? `Hi ${firstName} — ` : ''}Properties
          </h1>
          {!loading && (
            <p className="text-sm text-gray-400 mt-0.5">
              {total > 0 ? <>{start}–{end} of <strong className="text-gray-700">{total.toLocaleString()}</strong> listings</> : '0 listings found'}
            </p>
          )}
        </div>

        {/* Save search button */}
        {hasFilters(applied) && (
          <div ref={saveRef} className="relative">
            <button
              onClick={() => { setSaveOpen(o => !o); setSearchName(friendlyLabel(applied)) }}
              className={`flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg border transition-colors ${
                saveStatus === 'saved'
                  ? 'border-amber-300 bg-amber-50 text-amber-700'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {saveStatus === 'saved' ? <BookmarkCheck size={15} /> : <Bookmark size={15} />}
              {saveStatus === 'saved' ? 'Saved' : 'Save search'}
            </button>
            {saveOpen && (
              <div className="absolute right-0 top-full mt-2 w-72 bg-white border border-gray-200 rounded-xl shadow-lg p-4 z-20">
                <p className="text-sm font-medium text-gray-900 mb-2">Save this search</p>
                <input
                  autoFocus
                  value={searchName}
                  onChange={e => setSearchName(e.target.value)}
                  placeholder="Search name…"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 mb-3"
                  onKeyDown={e => { if (e.key === 'Enter') saveSearch() }}
                />
                <button
                  onClick={saveSearch}
                  disabled={saveStatus === 'saving' || !searchName.trim()}
                  className="w-full bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium py-2 rounded-lg disabled:opacity-50 transition-colors"
                >
                  {saveStatus === 'saving' ? 'Saving…' : 'Save'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Filter bar */}
      <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 mb-6">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs font-medium text-gray-500 mb-1">City</label>
            <AutocompleteInput options={cityOptions} value={filters.city} onChange={v => update('city', v)} placeholder="e.g. Toronto" />
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs font-medium text-gray-500 mb-1">Community / Neighbourhood</label>
            <AutocompleteInput options={communityOptions} value={filters.community} onChange={v => update('community', v)} placeholder="e.g. The Beaches" />
          </div>
          <div className="w-44">
            <label className="block text-xs font-medium text-gray-500 mb-1">Property Type</label>
            <select value={filters.propertyType} onChange={e => update('propertyType', e.target.value)} className={selectCls}>
              <option value="">Any type</option>
              {PROPERTY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="w-36">
            <label className="block text-xs font-medium text-gray-500 mb-1">Listing Type</label>
            <select value={filters.listingType} onChange={e => update('listingType', e.target.value)} className={selectCls}>
              <option value="">Sale or Lease</option>
              <option value="sale">For Sale</option>
              <option value="lease">For Lease</option>
            </select>
          </div>
          <div className="w-32">
            <label className="block text-xs font-medium text-gray-500 mb-1">Min Price</label>
            <input type="number" value={filters.minPrice} onChange={e => update('minPrice', e.target.value)} placeholder="$0" className={inputCls} />
          </div>
          <div className="w-32">
            <label className="block text-xs font-medium text-gray-500 mb-1">Max Price</label>
            <input type="number" value={filters.maxPrice} onChange={e => update('maxPrice', e.target.value)} placeholder="Any" className={inputCls} />
          </div>

          <button
            onClick={() => setShowMore(v => !v)}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors whitespace-nowrap"
          >
            <SlidersHorizontal size={15} />
            {showMore ? 'Less' : 'More'} filters
          </button>

          <div className="flex gap-2">
            <button onClick={applyFilters} className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
              <Search size={14} /> Search
            </button>
            {hasFilters(filters) && (
              <button onClick={clearFilters} className="p-2 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors">
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        {/* More filters */}
        {showMore && (
          <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-gray-200">
            <div className="w-28">
              <label className="block text-xs font-medium text-gray-500 mb-1">Min Beds</label>
              <select value={filters.minBeds} onChange={e => update('minBeds', e.target.value)} className={selectCls}>
                <option value="">Any</option>
                {[1,2,3,4,5].map(n => <option key={n} value={String(n)}>{n}+</option>)}
              </select>
            </div>
            <div className="w-28">
              <label className="block text-xs font-medium text-gray-500 mb-1">Min Baths</label>
              <select value={filters.minBaths} onChange={e => update('minBaths', e.target.value)} className={selectCls}>
                <option value="">Any</option>
                {[1,2,3,4].map(n => <option key={n} value={String(n)}>{n}+</option>)}
              </select>
            </div>
            <div className="w-32">
              <label className="block text-xs font-medium text-gray-500 mb-1">Garage Spaces</label>
              <select value={filters.minGarage} onChange={e => update('minGarage', e.target.value)} className={selectCls}>
                <option value="">Any</option>
                {[1,2,3].map(n => <option key={n} value={String(n)}>{n}+</option>)}
              </select>
            </div>
            <div className="w-32">
              <label className="block text-xs font-medium text-gray-500 mb-1">Min Sqft</label>
              <input type="number" value={filters.minSqft} onChange={e => update('minSqft', e.target.value)} placeholder="0" className={inputCls} />
            </div>
            <div className="w-32">
              <label className="block text-xs font-medium text-gray-500 mb-1">Max Sqft</label>
              <input type="number" value={filters.maxSqft} onChange={e => update('maxSqft', e.target.value)} placeholder="Any" className={inputCls} />
            </div>
          </div>
        )}

        {/* Active filter chips */}
        {hasFilters(applied) && (
          <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-200">
            {Object.entries(applied).filter(([,v]) => v !== '').map(([k, v]) => (
              <span key={k} className="inline-flex items-center gap-1 text-xs bg-amber-100 text-amber-800 rounded-full px-2.5 py-1 font-medium">
                {k}: {v}
                <button onClick={() => { const nf = { ...filters, [k]: '' }; setFilters(nf); setApplied(nf) }} className="hover:text-amber-900">
                  <X size={11} />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Results */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-gray-100 rounded-xl h-64 animate-pulse" />
          ))}
        </div>
      ) : properties.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="font-medium">No listings found</p>
          {hasFilters(applied) && (
            <button onClick={clearFilters} className="mt-2 text-sm text-amber-600 hover:underline">Clear filters</button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {properties.map(p => <ResoListingCard key={p.id} property={p} />)}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-10 flex items-center justify-center gap-2">
          <button onClick={() => setPage(p => p - 1)} disabled={page === 1}
            className="flex items-center gap-1 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
            <ChevronLeft size={16} /> Prev
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
            .reduce<(number | '…')[]>((acc, p, i, arr) => {
              if (i > 0 && (p as number) - (arr[i - 1] as number) > 1) acc.push('…')
              acc.push(p)
              return acc
            }, [])
            .map((p, i) => p === '…'
              ? <span key={`e-${i}`} className="px-2 text-gray-400">…</span>
              : <button key={p} onClick={() => setPage(p as number)}
                  className={`w-9 h-9 rounded-lg text-sm font-medium ${page === p ? 'bg-gray-900 text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                  {p}
                </button>
            )
          }
          <button onClick={() => setPage(p => p + 1)} disabled={page === totalPages}
            className="flex items-center gap-1 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
            Next <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* Cap notice — shown on the last page when results exceed 100 */}
      {capped && page === totalPages && !loading && (
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-center">
          <p className="text-sm font-medium text-amber-900">
            Showing the first 100 results for this search.
          </p>
          <p className="text-sm text-amber-700 mt-1">
            To see more listings, please{' '}
            <a href={`mailto:${agentEmail}`} className="underline hover:text-amber-900">contact me</a>{' '}
            and I&apos;ll help you find exactly what you&apos;re looking for.
          </p>
        </div>
      )}

      <div className="mt-8">
        <MlsDisclaimer variant="vow" />
      </div>
    </main>
  )
}
