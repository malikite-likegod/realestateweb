'use client'
import { useState } from 'react'
import { Button, Input } from '@/components/ui'
import type { BrowseFilterValues } from './BrowseFilters'

interface Props {
  filters:         BrowseFilterValues
  preContactId?:   string
  preContactName?: string
  onClose:         () => void
  onSaved:         () => void
}

export function SaveSearchSlideOver({ filters, preContactId, preContactName, onClose, onSaved }: Props) {
  const [contactId,     setContactId]     = useState(preContactId ?? '')
  const [contactName,   setContactName]   = useState(preContactName ?? '')
  const [searchQuery,   setSearchQuery]   = useState('')
  const [searchResults, setSearchResults] = useState<{ id: string; firstName: string | null; lastName: string | null }[]>([])
  const [name,    setName]    = useState('')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  async function searchContacts(q: string) {
    if (q.length < 2) return
    const res  = await fetch(`/api/contacts?search=${encodeURIComponent(q)}&pageSize=8`)
    const json = await res.json()
    setSearchResults(json.data ?? [])
  }

  async function handleSave() {
    if (!contactId) { setError('Please select a contact'); return }
    if (!name)      { setError('Please enter a name'); return }
    setLoading(true)
    setError('')
    const res = await fetch(`/api/admin/contacts/${contactId}/saved-searches`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ name, filters }),
    })
    const json = await res.json()
    setLoading(false)
    if (!res.ok) { setError(json.error ?? 'Failed to save'); return }
    onSaved()
  }

  const activeFilters = Object.entries(filters).filter(([, v]) => v)

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white h-full shadow-xl flex flex-col">
        <div className="p-6 border-b">
          <h2 className="text-lg font-semibold">Save Search for Contact</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
          {!preContactId && (
            <div>
              <Input
                label="Search Contact"
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); searchContacts(e.target.value) }}
                placeholder="Name or email..."
              />
              {searchResults.length > 0 && (
                <div className="border border-charcoal-200 rounded-md mt-1 divide-y">
                  {searchResults.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      className="w-full text-left px-3 py-2 hover:bg-charcoal-50 text-sm"
                      onClick={() => { setContactId(c.id); setContactName(`${c.firstName ?? ''} ${c.lastName ?? ''}`.trim()); setSearchResults([]) }}
                    >
                      {c.firstName} {c.lastName}
                    </button>
                  ))}
                </div>
              )}
              {contactName && <p className="text-sm text-green-600 mt-1">Selected: {contactName}</p>}
            </div>
          )}
          {preContactName && <p className="text-sm font-medium text-charcoal-700">For: {preContactName}</p>}
          {activeFilters.length > 0 && (
            <div className="p-3 bg-charcoal-50 rounded-md text-xs text-charcoal-600">
              <p className="font-medium mb-1">Current filters:</p>
              {activeFilters.map(([k, v]) => (
                <p key={k}>{k}: {v}</p>
              ))}
            </div>
          )}
          <Input label="Search Name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Toronto Condos under $700K" />
          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>
        <div className="p-6 border-t flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
          <Button variant="primary" onClick={handleSave} loading={loading} className="flex-1">Save Search</Button>
        </div>
      </div>
    </div>
  )
}
