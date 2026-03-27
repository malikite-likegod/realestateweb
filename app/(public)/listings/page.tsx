'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Container } from '@/components/layout'
import { PropertyGrid } from '@/components/real-estate'
import { ListingMap } from '@/components/real-estate'
import { Button, Select, Input } from '@/components/ui'
import { PROPERTY_TYPES, LISTING_TYPES } from '@/lib/constants'
import { Map, List, SlidersHorizontal, ChevronLeft, ChevronRight } from 'lucide-react'
import type { SearchResult } from '@/services/search/types'
import { SaveSearchButton } from '@/components/public/SaveSearchButton'
import { MlsDisclaimer } from '@/components/mls/MlsDisclaimer'

const PAGE_SIZE        = 50
const SEARCH_PAGE_SIZE = 100

function hasActiveSearch(f: { keyword: string; city: string; minPrice: string; maxPrice: string; minBeds: string; propertyType: string; listingType: string }) {
  return Object.values(f).some(v => v !== '')
}

function ListingsContent() {
  const searchParams = useSearchParams()
  const [results, setResults] = useState<SearchResult[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'grid' | 'map'>('grid')
  const [showFilters, setShowFilters] = useState(false)

  const [filters, setFilters] = useState({
    keyword:      searchParams.get('keyword') ?? '',
    city:         searchParams.get('city') ?? '',
    minPrice:     searchParams.get('minPrice') ?? '',
    maxPrice:     searchParams.get('maxPrice') ?? '',
    minBeds:      searchParams.get('minBeds') ?? '',
    propertyType: searchParams.get('propertyType') ?? '',
    listingType:  searchParams.get('listingType') ?? '',
  })

  const [activeFilters, setActiveFilters] = useState(filters)

  const fetchResults = useCallback(async (currentFilters: typeof filters, currentPage: number) => {
    setLoading(true)
    const searching = hasActiveSearch(currentFilters)
    const params = new URLSearchParams()
    Object.entries(currentFilters).forEach(([k, v]) => { if (v) params.set(k, v) })
    params.set('source', 'reso')
    if (searching) {
      params.set('brokerageOnly', 'false')
      params.set('pageSize', String(SEARCH_PAGE_SIZE))
      params.set('page', '1')
    } else {
      params.set('brokerageOnly', 'true')
      params.set('pageSize', String(PAGE_SIZE))
      params.set('page', String(currentPage))
    }
    const res = await fetch(`/api/search?${params}`)
    const data = await res.json()
    setResults(data.results ?? [])
    setTotal(data.total ?? 0)
    setTotalPages(searching ? 1 : (data.totalPages ?? 1))
    setLoading(false)
  }, [])

  useEffect(() => {
    setPage(1)
    fetchResults(activeFilters, 1)
  }, [fetchResults, activeFilters])

  useEffect(() => {
    fetchResults(activeFilters, page)
    window.scrollTo({ top: 0, behavior: 'smooth' })
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
            <Input placeholder="City" value={filters.city} onChange={e => setFilters(f => ({ ...f, city: e.target.value }))} className="w-36" />
            <Select options={LISTING_TYPES as unknown as Array<{value:string;label:string}>} placeholder="Type" value={filters.listingType} onChange={e => setFilters(f => ({ ...f, listingType: e.target.value }))} className="w-36 bg-white" />
            <Select options={PROPERTY_TYPES as unknown as Array<{value:string;label:string}>} placeholder="Property" value={filters.propertyType} onChange={e => setFilters(f => ({ ...f, propertyType: e.target.value }))} className="w-40 bg-white" />
            <Button variant="gold" onClick={() => setActiveFilters(filters)}>Search</Button>
            <button onClick={() => setShowFilters(v => !v)} className="flex items-center gap-1.5 text-white/70 hover:text-white text-sm">
              <SlidersHorizontal size={16} /> More Filters
            </button>
          </div>
          {showFilters && (
            <div className="flex flex-wrap gap-3 mt-3">
              <Input type="number" placeholder="Min Price" value={filters.minPrice} onChange={e => setFilters(f => ({ ...f, minPrice: e.target.value }))} className="w-36" />
              <Input type="number" placeholder="Max Price" value={filters.maxPrice} onChange={e => setFilters(f => ({ ...f, maxPrice: e.target.value }))} className="w-36" />
              <Select options={[1,2,3,4,5].map(n => ({ value: String(n), label: `${n}+ Beds` }))} placeholder="Beds" value={filters.minBeds} onChange={e => setFilters(f => ({ ...f, minBeds: e.target.value }))} className="w-32 bg-white" />
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
            <button onClick={() => setView('map')} className={`p-2 rounded-lg ${view === 'map' ? 'bg-charcoal-900 text-white' : 'bg-charcoal-100 text-charcoal-500'}`}><Map size={18} /></button>
          </div>
        </div>

        {view === 'grid' ? (
          <PropertyGrid properties={properties} loading={loading} columns={3} />
        ) : (
          <ListingMap markers={properties.filter(p => p.latitude).map(p => ({ lat: p.latitude!, lng: p.longitude!, title: p.title, price: p.price }))} height="600px" />
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
