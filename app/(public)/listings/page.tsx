'use client'

import { useState, useEffect, useCallback, Suspense, useId } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Container } from '@/components/layout'
import { PropertyGrid } from '@/components/real-estate'
import { ListingMap } from '@/components/real-estate'
import { Button, Select, Input, AutocompleteInput } from '@/components/ui'
import { LISTING_TYPES, PROPERTY_CLASSES, RESIDENTIAL_PROPERTY_TYPES, COMMERCIAL_PROPERTY_TYPES } from '@/lib/constants'
import { Map, List, SlidersHorizontal, ChevronLeft, ChevronRight } from 'lucide-react'
import type { SearchResult } from '@/services/search/types'
import { SaveSearchButton } from '@/components/public/SaveSearchButton'
import { MlsDisclaimer } from '@/components/mls/MlsDisclaimer'
import { useBehaviorTracker } from '@/hooks/useBehaviorTracker'

const PAGE_SIZE            = 20
const MAX_SEARCH_PAGES     = 5   // caps search results at 100 (5 × 20)

function hasActiveSearch(f: Record<string, string>) {
  return Object.values(f).some(v => v !== '')
}

function ListingsContent() {
  const searchParams = useSearchParams()
  const router       = useRouter()
  const sessionId    = useId()
  const { track }    = useBehaviorTracker({ sessionId })

  const [results, setResults] = useState<SearchResult[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'grid' | 'map'>('grid')
  const [showFilters, setShowFilters] = useState(false)

  const [areaOptions, setAreaOptions] = useState<string[]>([])

  const [filters, setFilters] = useState({
    keyword:       searchParams.get('keyword') ?? '',
    city:          searchParams.get('city') ?? '',
    postalCode:    searchParams.get('postalCode') ?? '',
    minPrice:      searchParams.get('minPrice') ?? '',
    maxPrice:      searchParams.get('maxPrice') ?? '',
    minBeds:       searchParams.get('minBeds') ?? '',
    propertyClass: searchParams.get('propertyClass') ?? '',
    propertyType:  searchParams.get('propertyType') ?? '',
    listingType:   searchParams.get('listingType') ?? '',
  })

  const [activeFilters, setActiveFilters] = useState(filters)

  const propertyTypeOptions: Array<{ value: string; label: string }> =
    filters.propertyClass === 'Residential' ? [...RESIDENTIAL_PROPERTY_TYPES] :
    filters.propertyClass === 'Commercial'  ? [...COMMERCIAL_PROPERTY_TYPES]  :
    [...RESIDENTIAL_PROPERTY_TYPES, ...COMMERCIAL_PROPERTY_TYPES]

  // Load area options on mount
  useEffect(() => {
    fetch('/api/search/geo?level=areas')
      .then(r => r.json())
      .then((data: string[]) => setAreaOptions(data))
      .catch(() => {})
  }, [])

  const fetchResults = useCallback(async (currentFilters: typeof filters, currentPage: number) => {
    setLoading(true)
    const searching = hasActiveSearch(currentFilters)
    const params = new URLSearchParams()
    Object.entries(currentFilters).forEach(([k, v]) => { if (v) params.set(k, v) })
    params.set('source', 'reso')
    params.set('pageSize', String(PAGE_SIZE))
    params.set('page', String(currentPage))
    if (searching) {
      params.set('brokerageOnly', 'false')
    } else {
      params.set('brokerageOnly', 'true')
    }
    const res = await fetch(`/api/search?${params}`)
    const data = await res.json()
    setResults(data.results ?? [])
    // If the backend resolved the keyword to a city or property type, populate
    // that field and clear the keyword so the filter UI reflects what was searched.
    if (data.resolved && currentFilters.keyword && !currentFilters.city && !currentFilters.propertyType) {
      const { field, value } = data.resolved as { field: 'city' | 'community' | 'propertyType'; value: string }
      const resolvedField = field === 'community' ? 'city' : field
      setFilters(f => ({ ...f, keyword: '', [resolvedField]: value }))
      setActiveFilters(f => ({ ...f, keyword: '', [resolvedField]: value }))
    }
    if (searching) {
      // Cap total and pages to MAX_SEARCH_PAGES so we never show more than 100 results
      const cappedTotal = Math.min(data.total ?? 0, MAX_SEARCH_PAGES * PAGE_SIZE)
      setTotal(cappedTotal)
      setTotalPages(Math.min(data.totalPages ?? 1, MAX_SEARCH_PAGES))
    } else {
      setTotal(data.total ?? 0)
      setTotalPages(data.totalPages ?? 1)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    setPage(1)
    fetchResults(activeFilters, 1)
  }, [fetchResults, activeFilters])

  useEffect(() => {
    fetchResults(activeFilters, page)
    window.scrollTo({ top: 0, behavior: 'instant' })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  const properties = results.map(r => ({
    id: r.listingKey ?? r.id,
    title: r.title,
    price: r.price ?? 0,
    bedrooms: r.bedrooms,
    bathrooms: r.bathrooms,
    sqft: r.sqft,
    address: r.address ?? '',
    city: r.city ?? '',
    propertyType: r.propertyType ?? '',
    listingType: r.listingType,
    status: 'active',
    images: r.images,
    latitude: r.latitude,
    longitude: r.longitude,
    listedAt: null,
    listAgentFullName: r.listAgentFullName ?? null,
    listOfficeName:    r.listOfficeName ?? null,
  }))

  const start = (page - 1) * PAGE_SIZE + 1
  const end   = Math.min(page * PAGE_SIZE, total)

  return (
    <div className="pt-20">
      {/* Search bar */}
      <div className="bg-charcoal-950 py-8">
        <Container>
          <div className="flex flex-wrap gap-3 items-end">
            <Input
              placeholder="Location, keyword, MLS#…"
              value={filters.keyword}
              onChange={e => setFilters(f => ({ ...f, keyword: e.target.value }))}
              className="min-w-[240px]"
            />
            <AutocompleteInput
              options={areaOptions}
              value={filters.city}
              onChange={v => setFilters(f => ({ ...f, city: v }))}
              placeholder="Area / City"
              className="w-44"
            />
<Select options={LISTING_TYPES as unknown as Array<{value:string;label:string}>} placeholder="Type" value={filters.listingType} onChange={e => setFilters(f => ({ ...f, listingType: e.target.value }))} className="w-36 bg-white" />
            <Select options={PROPERTY_CLASSES as unknown as Array<{value:string;label:string}>} placeholder="Class" value={filters.propertyClass} onChange={e => setFilters(f => ({ ...f, propertyClass: e.target.value, propertyType: '' }))} className="w-40 bg-white" />
            <Select options={propertyTypeOptions} placeholder="Property Type" value={filters.propertyType} onChange={e => setFilters(f => ({ ...f, propertyType: e.target.value }))} className="w-44 bg-white" />
            <Button variant="gold" onClick={() => {
              setActiveFilters(filters)
              // Write filters to URL so back navigation restores the same results
              const params = new URLSearchParams()
              Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v) })
              router.push(`/listings?${params.toString()}`, { scroll: false })
              const activeEntries = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== ''))
              if (Object.keys(activeEntries).length > 0) {
                track('search', undefined, activeEntries)
              }
            }}>Search</Button>
            <button onClick={() => setShowFilters(v => !v)} className="flex items-center gap-1.5 text-white/70 hover:text-white text-sm">
              <SlidersHorizontal size={16} /> More Filters
            </button>
          </div>
          {showFilters && (
            <div className="flex flex-wrap gap-3 mt-3">
              <Input type="number" placeholder="Min Price" value={filters.minPrice} onChange={e => setFilters(f => ({ ...f, minPrice: e.target.value }))} className="w-36" />
              <Input type="number" placeholder="Max Price" value={filters.maxPrice} onChange={e => setFilters(f => ({ ...f, maxPrice: e.target.value }))} className="w-36" />
              <Select options={[1,2,3,4,5].map(n => ({ value: String(n), label: `${n}+ Beds` }))} placeholder="Beds" value={filters.minBeds} onChange={e => setFilters(f => ({ ...f, minBeds: e.target.value }))} className="w-32 bg-white" />
              <Input placeholder="Postal Code" value={filters.postalCode} onChange={e => setFilters(f => ({ ...f, postalCode: e.target.value.toUpperCase() }))} className="w-36" />
            </div>
          )}
        </Container>
      </div>

      <Container className="py-8">
        {/* Results header */}
        <div className="flex items-center justify-between mb-6">
          <p className="text-charcoal-600">
            {total > 0
              ? <><strong className="text-charcoal-900">{start}–{end}</strong> of <strong className="text-charcoal-900">{total}</strong> properties</>
              : <><strong className="text-charcoal-900">{total}</strong> properties found</>
            }
          </p>
          <SaveSearchButton
            filters={Object.fromEntries(
              Object.entries(activeFilters).filter(([, v]) => v !== '')
            )}
          />
          <div className="flex gap-2">
            <button onClick={() => setView('grid')} className={`p-2 rounded-lg ${view === 'grid' ? 'bg-charcoal-900 text-white' : 'bg-charcoal-100 text-charcoal-500'}`}><List size={18} /></button>
            <button onClick={() => { setView('map'); track('map_interaction', undefined, { action: 'open_map' }) }} className={`p-2 rounded-lg ${view === 'map' ? 'bg-charcoal-900 text-white' : 'bg-charcoal-100 text-charcoal-500'}`}><Map size={18} /></button>
          </div>
        </div>

        {view === 'grid' ? (
          <PropertyGrid properties={properties} loading={loading} columns={3} />
        ) : (
          <ListingMap markers={properties.filter(p => p.latitude).map(p => ({ lat: p.latitude!, lng: p.longitude!, title: p.title, price: p.price }))} height="600px" />
        )}

        {/* More listings notice — shown on the last page of a non-brokerage search */}
        {hasActiveSearch(activeFilters) && page === totalPages && totalPages > 0 && !loading && (
          <div className="mt-10 rounded-2xl border border-gold-200 bg-gold-50 px-6 py-5 text-center">
            <p className="font-semibold text-charcoal-900">Looking for more options?</p>
            <p className="mt-1 text-sm text-charcoal-600">
              The MLS has additional listings beyond what&apos;s shown here. Reach out and I&apos;ll send you a full, curated list matched to your needs.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-3">
              <a href="/contact" className="inline-flex items-center gap-1.5 rounded-lg bg-charcoal-900 px-4 py-2 text-sm font-medium text-white hover:bg-charcoal-700 transition-colors">
                Contact Michael
              </a>
              <a href="tel:+14168888352" className="inline-flex items-center gap-1.5 rounded-lg border border-charcoal-300 px-4 py-2 text-sm font-medium text-charcoal-700 hover:bg-charcoal-50 transition-colors">
                (416) 888-8352
              </a>
            </div>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-10 flex items-center justify-center gap-2">
            <button
              onClick={() => setPage(p => p - 1)}
              disabled={page === 1}
              className="flex items-center gap-1 px-3 py-2 rounded-lg border border-charcoal-200 text-sm text-charcoal-700 hover:bg-charcoal-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={16} /> Prev
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
              .reduce<(number | '…')[]>((acc, p, i, arr) => {
                if (i > 0 && (p as number) - (arr[i - 1] as number) > 1) acc.push('…')
                acc.push(p)
                return acc
              }, [])
              .map((p, i) =>
                p === '…'
                  ? <span key={`ellipsis-${i}`} className="px-2 text-charcoal-400">…</span>
                  : <button
                      key={p}
                      onClick={() => setPage(p as number)}
                      className={`w-9 h-9 rounded-lg text-sm font-medium ${page === p ? 'bg-charcoal-900 text-white' : 'border border-charcoal-200 text-charcoal-700 hover:bg-charcoal-50'}`}
                    >
                      {p}
                    </button>
              )
            }

            <button
              onClick={() => setPage(p => p + 1)}
              disabled={page === totalPages}
              className="flex items-center gap-1 px-3 py-2 rounded-lg border border-charcoal-200 text-sm text-charcoal-700 hover:bg-charcoal-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next <ChevronRight size={16} />
            </button>
          </div>
        )}
      </Container>
      <MlsDisclaimer variant="idx" />
    </div>
  )
}

export default function ListingsPage() {
  return (
    <Suspense fallback={<div className="pt-20 text-center py-8">Loading listings...</div>}>
      <ListingsContent />
    </Suspense>
  )
}
