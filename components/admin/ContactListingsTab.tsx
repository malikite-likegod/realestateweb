'use client'
import { useEffect, useState } from 'react'
import { Card } from '@/components/layout'
import { CheckCircle2, Clock } from 'lucide-react'

interface PackageItem {
  id:         string
  listingKey: string
  views:      { viewedAt: string; durationSec: number | null }[]
}

interface Package {
  id:      string
  title:   string
  sentAt:  string | null
  message: string | null
  items:   PackageItem[]
}

interface SavedSearch {
  id:        string
  name:      string
  filters:   string
  createdAt: string
}

interface Props {
  contactId:   string
  contactName: string
}

export function ContactListingsTab({ contactId, contactName }: Props) {
  const [packages,      setPackages]      = useState<Package[]>([])
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([])
  const [expanded,      setExpanded]      = useState<Set<string>>(new Set())
  const [loading,       setLoading]       = useState(true)

  useEffect(() => {
    Promise.all([
      fetch(`/api/listing-packages?contactId=${contactId}`).then(r => r.json()),
      fetch(`/api/admin/contacts/${contactId}/saved-searches`).then(r => r.json()),
    ]).then(([pkgs, searches]) => {
      setPackages(pkgs.data ?? [])
      setSavedSearches(searches.data ?? [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [contactId])

  async function deleteSearch(id: string) {
    await fetch(`/api/admin/contacts/${contactId}/saved-searches/${id}`, { method: 'DELETE' })
    setSavedSearches(s => s.filter(x => x.id !== id))
  }

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  if (loading) return <p className="text-sm text-charcoal-400 p-4">Loading...</p>

  return (
    <div className="flex flex-col gap-6">
      {/* Browse & Send */}
      <div className="flex justify-end">
        <a
          href={`/admin/listings/browse?contactId=${contactId}&contactName=${encodeURIComponent(contactName)}`}
          className="inline-flex items-center gap-2 px-4 py-2 bg-gold-600 text-white rounded-md text-sm font-medium hover:bg-gold-700"
        >
          Browse &amp; Send Listings
        </a>
      </div>

      {/* Packages */}
      <Card>
        <h3 className="font-semibold text-charcoal-900 mb-4">Listing Packages Sent</h3>
        {packages.length === 0
          ? <p className="text-sm text-charcoal-400">No packages sent yet.</p>
          : packages.map(pkg => {
              const viewedCount = pkg.items.filter(i => i.views.length > 0).length
              const isExpanded  = expanded.has(pkg.id)
              return (
                <div key={pkg.id} className="border border-charcoal-100 rounded-lg mb-3">
                  <button
                    type="button"
                    className="w-full flex items-center justify-between p-4 text-left hover:bg-charcoal-50"
                    onClick={() => toggleExpand(pkg.id)}
                  >
                    <div>
                      <p className="font-medium text-charcoal-900">{pkg.title}</p>
                      <p className="text-xs text-charcoal-400">
                        {pkg.sentAt ? `Sent ${new Date(pkg.sentAt).toLocaleDateString()}` : 'Draft (not sent)'}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-charcoal-600">{viewedCount} / {pkg.items.length} viewed</span>
                      <span className="text-charcoal-400">{isExpanded ? '▲' : '▼'}</span>
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="px-4 pb-4 divide-y divide-charcoal-50">
                      {pkg.items.map(item => (
                        <div key={item.id} className="py-2 flex items-center justify-between text-sm">
                          <span className="text-charcoal-700 font-mono text-xs">{item.listingKey}</span>
                          {item.views.length > 0
                            ? <span className="flex items-center gap-1 text-green-600 text-xs">
                                <CheckCircle2 size={12} />
                                Viewed {new Date(item.views[0].viewedAt).toLocaleDateString()}
                                {item.views[0].durationSec ? ` · ${item.views[0].durationSec}s` : ''}
                              </span>
                            : <span className="flex items-center gap-1 text-charcoal-400 text-xs">
                                <Clock size={12} /> Not viewed
                              </span>
                          }
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })
        }
      </Card>

      {/* Saved Searches */}
      <Card>
        <h3 className="font-semibold text-charcoal-900 mb-4">Saved Searches</h3>
        {savedSearches.length === 0
          ? <p className="text-sm text-charcoal-400">No saved searches.</p>
          : savedSearches.map(s => {
              let filters: Record<string, string> = {}
              try { filters = JSON.parse(s.filters) } catch { /* ignore */ }
              const summary = Object.entries(filters).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join(' · ')
              return (
                <div key={s.id} className="flex items-center justify-between py-3 border-b border-charcoal-100 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-charcoal-900">{s.name}</p>
                    {summary && <p className="text-xs text-charcoal-400 mt-0.5">{summary}</p>}
                  </div>
                  <div className="flex gap-2">
                    <a
                      href={`/admin/listings/browse?contactId=${contactId}&contactName=${encodeURIComponent(contactName)}&${new URLSearchParams(filters)}`}
                      className="text-xs text-charcoal-500 hover:text-charcoal-900 underline"
                    >
                      Run
                    </a>
                    <button
                      type="button"
                      onClick={() => deleteSearch(s.id)}
                      className="text-xs text-red-400 hover:text-red-600"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )
            })
        }
      </Card>
    </div>
  )
}
