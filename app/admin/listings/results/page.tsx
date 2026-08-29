'use client'

import { useState, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { Badge, Button, Input } from '@/components/ui'
import { formatPrice } from '@/lib/utils'

type ResultListing = {
  id:                    string
  listingKey:            string
  streetNumber:          string | null
  streetDirPrefix:       string | null
  streetName:            string | null
  streetSuffix:          string | null
  streetDirSuffix:       string | null
  unitNumber:            string | null
  city:                  string
  standardStatus:        string
  listPrice:             number | null
  listingContractDate:   string | null
  modificationTimestamp: string | null
  listOfficeName:        string | null
  propertyType:          string | null
}

type StatusCount = { status: string; count: number }

function formatAddress(l: ResultListing): string {
  return [l.streetNumber, l.streetName, l.streetSuffix, l.streetDirPrefix, l.streetDirSuffix, l.unitNumber].filter(Boolean).join(' ') || 'Address TBD'
}

// PropTx doesn't return real sold/closed data to this account (confirmed via a full-history
// rescan finding zero Closed records), so 'Closed' never appears here — statuses shown are all
// off-market reasons (Expired, Active Under Contract, etc.), plus 'Removed' for listings that
// vanished from every feed with no reason PropTx will give.
function statusBadgeVariant(status: string): 'warning' | 'default' {
  return status.toLowerCase().includes('expired') ? 'warning' : 'default'
}

// "Days on market" here means days between the original listing date and whenever PropTx last
// changed this record — there's no real close/end date available for these statuses.
function daysOnMarket(l: ResultListing): number | null {
  if (!l.listingContractDate || !l.modificationTimestamp) return null
  const days = Math.round((new Date(l.modificationTimestamp).getTime() - new Date(l.listingContractDate).getTime()) / 86_400_000)
  return days >= 0 ? days : null
}

export default function ListingResultsPage() {
  const [statusCounts, setStatusCounts] = useState<StatusCount[]>([])
  const [status,       setStatus]       = useState('')
  const [area,         setArea]         = useState('')
  const [officeOnly,   setOfficeOnly]   = useState(true)
  const [listings,     setListings]     = useState<ResultListing[]>([])
  const [page,         setPage]         = useState(1)
  const [totalPages,   setTotalPages]   = useState(0)
  const [total,        setTotal]        = useState(0)
  const [loading,      setLoading]      = useState(false)

  const fetchStatusCounts = useCallback(async (oo: boolean) => {
    const params = new URLSearchParams({ meta: 'statuses' })
    if (oo) params.set('officeOnly', 'true')
    try {
      const res  = await fetch(`/api/admin/listings/results?${params}`)
      const json = await res.json()
      setStatusCounts(json.statuses ?? [])
    } catch {
      // leave previous counts in place on network error
    }
  }, [])

  const fetchListings = useCallback(async (s: string, a: string, oo: boolean, p: number) => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(p) })
    if (s)  params.set('status', s)
    if (a)  params.set('area', a)
    if (oo) params.set('officeOnly', 'true')
    try {
      const res  = await fetch(`/api/admin/listings/results?${params}`)
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

  useEffect(() => {
    fetchStatusCounts(officeOnly)
    fetchListings(status, area, officeOnly, 1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleSearch() {
    setPage(1)
    fetchStatusCounts(officeOnly)
    fetchListings(status, area, officeOnly, 1)
  }

  function handleOfficeOnlyChange(v: boolean) {
    setOfficeOnly(v)
    setPage(1)
    fetchStatusCounts(v)
    fetchListings(status, area, v, 1)
  }

  return (
    <div className="flex flex-col h-screen">
      <div className="flex items-center justify-between px-6 py-4 border-b bg-white">
        <div>
          <h1 className="text-xl font-semibold text-charcoal-900">Listing Results</h1>
          {total > 0 && <p className="text-xs text-charcoal-400">{total.toLocaleString()} listings found</p>}
        </div>
        <a href="/admin/listings" className="text-sm text-charcoal-500 hover:text-charcoal-900">&#8592; Back to Listings</a>
      </div>

      <div className="px-6 py-4 border-b bg-white">
        {statusCounts.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            {statusCounts.map(s => (
              <div key={s.status} className="rounded-lg bg-charcoal-50 p-3 text-center">
                <p className="text-lg font-semibold text-charcoal-700">{s.count.toLocaleString()}</p>
                <p className="text-xs text-charcoal-400 mt-0.5">{s.status}</p>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-charcoal-500 mb-1">Status</label>
            <select
              className="rounded-lg border border-charcoal-200 bg-white px-3 py-2 text-sm text-charcoal-900 focus:outline-none focus:ring-2 focus:ring-charcoal-900"
              value={status}
              onChange={e => setStatus(e.target.value)}
            >
              <option value="">All statuses</option>
              {statusCounts.map(s => (
                <option key={s.status} value={s.status}>{s.status} ({s.count})</option>
              ))}
            </select>
          </div>
          <div className="w-48">
            <Input label="City" value={area} onChange={e => setArea(e.target.value)} placeholder="e.g. Toronto" />
          </div>
          <label className="flex items-center gap-2 text-sm text-charcoal-600 pb-2.5">
            <input type="checkbox" checked={officeOnly} onChange={e => handleOfficeOnlyChange(e.target.checked)} />
            My brokerage only
          </label>
          <Button variant="primary" onClick={handleSearch}>Search</Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <p className="p-8 text-center text-charcoal-400">Loading...</p>
        ) : listings.length === 0 ? (
          <p className="p-8 text-center text-charcoal-400">No results found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-charcoal-50 border-b border-charcoal-100 sticky top-0">
                <tr>
                  {['Address', 'Status', 'List Price', 'DOM', 'City', 'Office'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-charcoal-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-charcoal-100 bg-white">
                {listings.map(l => {
                  const dom = daysOnMarket(l)
                  return (
                    <tr key={l.id} className="hover:bg-charcoal-50 transition-colors">
                      <td className="px-4 py-3">
                        <Link href={`/admin/listings/browse/${l.id}`} className="font-medium text-charcoal-900 hover:underline">
                          {formatAddress(l)}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={statusBadgeVariant(l.standardStatus)}>{l.standardStatus}</Badge>
                      </td>
                      <td className="px-4 py-3 text-charcoal-600">{l.listPrice != null ? formatPrice(l.listPrice) : '—'}</td>
                      <td className="px-4 py-3 text-charcoal-500">{dom != null ? dom : '—'}</td>
                      <td className="px-4 py-3 text-charcoal-500">{l.city}</td>
                      <td className="px-4 py-3 text-charcoal-500">{l.listOfficeName ?? '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex justify-center gap-2 py-6">
            <Button
              variant="outline"
              disabled={page <= 1}
              onClick={() => { const p = page - 1; setPage(p); fetchListings(status, area, officeOnly, p) }}
            >
              Previous
            </Button>
            <span className="flex items-center text-sm text-charcoal-500">Page {page} of {totalPages}</span>
            <Button
              variant="outline"
              disabled={page >= totalPages}
              onClick={() => { const p = page + 1; setPage(p); fetchListings(status, area, officeOnly, p) }}
            >
              Next
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
