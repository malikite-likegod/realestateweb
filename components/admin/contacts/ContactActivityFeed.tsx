'use client'

import { useState, useEffect, useCallback } from 'react'
import { Search, Home, FileText, MousePointer, Send, Activity } from 'lucide-react'
import { formatPrice } from '@/lib/utils'

interface PropertySnippet {
  id:              string
  listingKey:      string
  streetNumber:    string | null
  streetDirPrefix: string | null
  streetName:      string | null
  streetSuffix:    string | null
  streetDirSuffix: string | null
  unitNumber:      string | null
  city:            string
  listPrice:       number | null
  propertySubType: string | null
  media:           string | null
}

type FeedItem =
  | { kind: 'search';       occurredAt: string; query: Record<string, string>; results: number }
  | { kind: 'listing_view'; occurredAt: string; property: PropertySnippet | null; entityId: string }
  | { kind: 'page_view';    occurredAt: string; entityId: string | null; metadata: Record<string, unknown> | null }
  | { kind: 'form_submit';  occurredAt: string; metadata: Record<string, unknown> | null }
  | { kind: 'blog_read';    occurredAt: string; entityId: string | null }
  | { kind: 'other';        occurredAt: string; eventType: string; entityId: string | null }

interface Props { contactId: string }

function formatDateTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' at ' + d.toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit', hour12: true })
}

function getAddress(p: PropertySnippet): string {
  return [p.streetNumber, p.streetName, p.streetSuffix, p.streetDirPrefix, p.streetDirSuffix].filter(Boolean).join(' ') || p.listingKey
}

function getFirstImage(media: string | null): string {
  try {
    const items = JSON.parse(media ?? '[]') as { url: string }[]
    return items[0]?.url ?? '/images/minimal-light-placeholder.svg'
  } catch {
    return '/images/minimal-light-placeholder.svg'
  }
}

function friendlySearchLabel(query: Record<string, string>): string {
  const parts: string[] = []
  if (query.keyword)      parts.push(`"${query.keyword}"`)
  if (query.city)         parts.push(query.city)
  if (query.propertyType) parts.push(query.propertyType)
  if (query.listingType)  parts.push(query.listingType)
  if (query.minPrice || query.maxPrice) {
    const lo = query.minPrice ? `$${Number(query.minPrice).toLocaleString()}` : ''
    const hi = query.maxPrice ? `$${Number(query.maxPrice).toLocaleString()}` : ''
    if (lo && hi) parts.push(`${lo}–${hi}`)
    else if (lo)  parts.push(`from ${lo}`)
    else          parts.push(`up to ${hi}`)
  }
  if (query.minBeds) parts.push(`${query.minBeds}+ beds`)
  return parts.length ? parts.join(' · ') : 'All listings'
}

function ItemRow({ item }: { item: FeedItem }) {
  if (item.kind === 'listing_view') {
    const p = item.property
    return (
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-500">
          <Home size={15} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-charcoal-900 leading-snug">
            Viewed listing
            {p ? <> — <span className="font-normal text-charcoal-700">{getAddress(p)}, {p.city}</span></> : null}
          </p>
          {p && (
            <p className="text-xs text-charcoal-500 mt-0.5">
              {formatPrice(p.listPrice ?? 0)}
              {p.propertySubType ? ` · ${p.propertySubType}` : ''}
            </p>
          )}
          {p && (
            <div className="mt-1.5 flex items-center gap-2">
              <img
                src={getFirstImage(p.media)}
                alt={getAddress(p)}
                className="h-10 w-14 rounded-md object-cover border border-charcoal-100"
              />
              <a
                href={`/admin/listings?highlight=${item.entityId}`}
                className="text-xs text-gold-600 hover:underline"
              >
                View listing →
              </a>
            </div>
          )}
          <p className="text-xs text-charcoal-400 mt-1">{formatDateTime(item.occurredAt)}</p>
        </div>
      </div>
    )
  }

  if (item.kind === 'search') {
    const label = friendlySearchLabel(item.query)
    return (
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gold-50 text-gold-600">
          <Search size={15} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-charcoal-900 leading-snug">
            Searched — <span className="font-normal text-charcoal-700">{label}</span>
          </p>
          <p className="text-xs text-charcoal-500 mt-0.5">
            {item.results > 0 ? `${item.results} result${item.results !== 1 ? 's' : ''}` : 'No results'}
          </p>
          <p className="text-xs text-charcoal-400 mt-1">{formatDateTime(item.occurredAt)}</p>
        </div>
      </div>
    )
  }

  if (item.kind === 'page_view') {
    const path = (item.metadata?.path as string) ?? item.entityId ?? 'Unknown page'
    return (
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-charcoal-100 text-charcoal-500">
          <MousePointer size={15} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-charcoal-900 leading-snug">
            Visited page — <span className="font-normal text-charcoal-600 truncate">{path}</span>
          </p>
          <p className="text-xs text-charcoal-400 mt-1">{formatDateTime(item.occurredAt)}</p>
        </div>
      </div>
    )
  }

  if (item.kind === 'blog_read') {
    return (
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-purple-50 text-purple-500">
          <FileText size={15} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-charcoal-900 leading-snug">
            Read blog post
            {item.entityId ? <> — <span className="font-normal text-charcoal-600">{item.entityId}</span></> : null}
          </p>
          <p className="text-xs text-charcoal-400 mt-1">{formatDateTime(item.occurredAt)}</p>
        </div>
      </div>
    )
  }

  if (item.kind === 'form_submit') {
    const form = (item.metadata?.form as string) ?? 'form'
    return (
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-50 text-green-600">
          <Send size={15} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-charcoal-900 leading-snug">
            Submitted {form}
          </p>
          <p className="text-xs text-charcoal-400 mt-1">{formatDateTime(item.occurredAt)}</p>
        </div>
      </div>
    )
  }

  // 'other'
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-charcoal-100 text-charcoal-400">
        <Activity size={15} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-charcoal-900 leading-snug capitalize">
          {item.eventType.replace(/_/g, ' ')}
        </p>
        <p className="text-xs text-charcoal-400 mt-1">{formatDateTime(item.occurredAt)}</p>
      </div>
    </div>
  )
}

const KIND_LABELS: Record<string, string> = {
  all:          'All',
  listing_view: 'Listing Views',
  search:       'Searches',
  page_view:    'Page Views',
  form_submit:  'Form Submits',
  blog_read:    'Blog Reads',
}

export function ContactActivityFeed({ contactId }: Props) {
  const [items,   setItems]   = useState<FeedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter,  setFilter]  = useState<string>('all')

  const load = useCallback(async () => {
    setLoading(true)
    const res  = await fetch(`/api/contacts/${contactId}/activity`)
    const data = await res.json()
    setItems(data.items ?? [])
    setLoading(false)
  }, [contactId])

  useEffect(() => { load() }, [load])

  const displayed = filter === 'all' ? items : items.filter(i => i.kind === filter)

  // Count per kind for filter badges
  const counts: Record<string, number> = { all: items.length }
  for (const i of items) counts[i.kind] = (counts[i.kind] ?? 0) + 1

  return (
    <div>
      {/* Filter pills */}
      <div className="flex flex-wrap gap-2 mb-4">
        {Object.entries(KIND_LABELS).map(([k, label]) => (
          counts[k] == null && k !== 'all' ? null : (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                filter === k
                  ? 'bg-charcoal-900 text-white'
                  : 'bg-charcoal-100 text-charcoal-500 hover:bg-charcoal-200'
              }`}
            >
              {label}
              {counts[k] != null && <span className="ml-1 opacity-70">({counts[k]})</span>}
            </button>
          )
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-charcoal-400 text-center py-8">Loading activity…</p>
      ) : displayed.length === 0 ? (
        <p className="text-sm text-charcoal-400 text-center py-8">No activity recorded yet</p>
      ) : (
        <div className="flex flex-col divide-y divide-charcoal-50">
          {displayed.map((item, idx) => (
            <div key={idx} className="py-3 first:pt-0 last:pb-0">
              <ItemRow item={item} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
