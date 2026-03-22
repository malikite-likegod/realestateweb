'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Container } from '@/components/layout'
import { PropertyGrid } from '@/components/real-estate'
import { ListingMap } from '@/components/real-estate'
import { Button, Select, Input } from '@/components/ui'
import { PROPERTY_TYPES, LISTING_TYPES } from '@/lib/constants'
import { Map, List, SlidersHorizontal } from 'lucide-react'
import type { SearchResult } from '@/services/search/types'
import { SaveSearchButton } from '@/components/public/SaveSearchButton'

function ListingsContent() {
  const searchParams = useSearchParams()
  const [results, setResults] = useState<SearchResult[]>([])
  const [total, setTotal] = useState(0)
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

  const fetchResults = useCallback(async (currentFilters: typeof filters) => {
    setLoading(true)
    const params = new URLSearchParams()
    Object.entries(currentFilters).forEach(([k, v]) => { if (v) params.set(k, v) })
    const res = await fetch(`/api/search?${params}`)
    const data = await res.json()
    setResults(data.results ?? [])
    setTotal(data.total ?? 0)
    setLoading(false)
  }, [])

  useEffect(() => { fetchResults(activeFilters) }, [fetchResults, activeFilters])

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
  }))

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
          <p className="text-charcoal-600"><strong className="text-charcoal-900">{total}</strong> properties found</p>
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
      </Container>
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
