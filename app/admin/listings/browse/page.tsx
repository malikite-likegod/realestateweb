'use client'
import { useState, useCallback, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { BrowseFilters, EMPTY_FILTERS, type BrowseFilterValues } from '@/components/admin/listing-browser/BrowseFilters'
import { BrowseGrid } from '@/components/admin/listing-browser/BrowseGrid'
import { SelectionBar } from '@/components/admin/listing-browser/SelectionBar'
import { SendToContactSlideOver } from '@/components/admin/listing-browser/SendToContactSlideOver'
import { SaveSearchSlideOver } from '@/components/admin/listing-browser/SaveSearchSlideOver'
import { Button } from '@/components/ui'
import type { ResoListing } from '@/components/admin/listing-browser/types'

const emptyFilters: BrowseFilterValues = EMPTY_FILTERS

function BrowsePageInner() {
  const searchParams   = useSearchParams()
  const preContactId   = searchParams.get('contactId')   ?? undefined
  const preContactName = searchParams.get('contactName') ?? undefined

  const [filters,    setFilters]    = useState<BrowseFilterValues>(emptyFilters)
  const [listings,   setListings]   = useState<ResoListing[]>([])
  const [page,       setPage]       = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [total,      setTotal]      = useState(0)
  const [loading,    setLoading]    = useState(false)
  const [selected,   setSelected]   = useState<Set<string>>(new Set())
  const [showSend,   setShowSend]   = useState(false)
  const [showSearch, setShowSearch] = useState(false)

  // Auto-fill city from contact profile when contactId is present
  useEffect(() => {
    if (!preContactId) return
    fetch(`/api/admin/contacts/${preContactId}/profile`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.city) {
          setFilters(f => ({ ...f, city: data.city }))
        }
      })
      .catch(() => {})
  }, [preContactId])

  const fetchListings = useCallback(async (f: BrowseFilterValues, p: number) => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(p) })
    if (f.city)         params.set('city',         f.city)
    if (f.community)    params.set('community',    f.community)
    if (f.propertyType) params.set('propertyType', f.propertyType)
    if (f.listingType)  params.set('listingType',  f.listingType)
    if (f.minPrice)     params.set('minPrice',     f.minPrice)
    if (f.maxPrice)     params.set('maxPrice',     f.maxPrice)
    if (f.minBeds)      params.set('minBeds',      f.minBeds)
    if (f.minBaths)     params.set('minBaths',     f.minBaths)
    if (f.minGarage)    params.set('minGarage',    f.minGarage)
    if (f.minSqft)      params.set('minSqft',      f.minSqft)
    if (f.maxSqft)      params.set('maxSqft',      f.maxSqft)
    try {
      const res  = await fetch(`/api/admin/listings/browse?${params}`)
      const json = await res.json()
      setListings(json.data ?? [])
      setTotalPages(json.totalPages ?? 0)
      setTotal(json.total ?? 0)
    } catch {
      // network error — leave previous results in place
    } finally {
      setLoading(false)
    }
  }, [])

  // Auto-load on mount
  useEffect(() => {
    fetchListings(emptyFilters, 1)
  }, [fetchListings])

  function handleSearch() {
    setPage(1)
    fetchListings(filters, 1)
  }

  function toggleListing(key: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  return (
    <div className="flex flex-col h-screen">
      <div className="flex items-center justify-between px-6 py-4 border-b bg-white">
        <div>
          <h1 className="text-xl font-semibold text-charcoal-900">Browse MLS Listings</h1>
          {preContactName && <p className="text-sm text-charcoal-500">Sending to: {preContactName}</p>}
          {total > 0 && <p className="text-xs text-charcoal-400">{total.toLocaleString()} listings found</p>}
        </div>
        <a href="/admin/listings" className="text-sm text-charcoal-500 hover:text-charcoal-900">&#8592; Back to Listings</a>
      </div>

      <BrowseFilters filters={filters} onChange={setFilters} onSearch={handleSearch} />

      <div className="flex-1 overflow-y-auto pb-24">
        {loading
          ? <p className="p-8 text-center text-charcoal-400">Searching...</p>
          : <BrowseGrid listings={listings} selected={selected} onToggle={toggleListing} />
        }
        {totalPages > 1 && (
          <div className="flex justify-center gap-2 py-6">
            <Button
              variant="outline"
              disabled={page <= 1}
              onClick={() => { const p = page - 1; setPage(p); fetchListings(filters, p) }}
            >
              Previous
            </Button>
            <span className="flex items-center text-sm text-charcoal-500">Page {page} of {totalPages}</span>
            <Button
              variant="outline"
              disabled={page >= totalPages}
              onClick={() => { const p = page + 1; setPage(p); fetchListings(filters, p) }}
            >
              Next
            </Button>
          </div>
        )}
      </div>

      <SelectionBar
        count={selected.size}
        onSend={() => setShowSend(true)}
        onSaveSearch={() => setShowSearch(true)}
        onClear={() => setSelected(new Set())}
      />

      {showSend && (
        <SendToContactSlideOver
          listingKeys={[...selected]}
          preContactId={preContactId}
          preContactName={preContactName}
          onClose={() => setShowSend(false)}
          onSent={() => { setShowSend(false); setSelected(new Set()) }}
        />
      )}

      {showSearch && (
        <SaveSearchSlideOver
          filters={filters}
          preContactId={preContactId}
          preContactName={preContactName}
          onClose={() => setShowSearch(false)}
          onSaved={() => setShowSearch(false)}
        />
      )}
    </div>
  )
}

export default function BrowsePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-charcoal-400">Loading...</div>}>
      <BrowsePageInner />
    </Suspense>
  )
}
