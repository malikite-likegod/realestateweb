'use client'
import { useState, useRef } from 'react'
import { Button, Input, Textarea } from '@/components/ui'

interface Props {
  listingKeys:     string[]
  preContactId?:   string
  preContactName?: string
  onClose:         () => void
  onSent:          () => void
}

export function SendToContactSlideOver({ listingKeys, preContactId, preContactName, onClose, onSent }: Props) {
  const [contactId,     setContactId]     = useState(preContactId ?? '')
  const [contactName,   setContactName]   = useState(preContactName ?? '')
  const [searchQuery,   setSearchQuery]   = useState('')
  const [searchResults, setSearchResults] = useState<{ id: string; firstName: string | null; lastName: string | null; email: string | null }[]>([])
  const [title,   setTitle]   = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  async function searchContacts(q: string) {
    if (q.length < 2) return
    const res  = await fetch(`/api/contacts?search=${encodeURIComponent(q)}&pageSize=8`)
    const json = await res.json()
    setSearchResults(json.data ?? [])
  }

  function handleSearchInput(q: string) {
    setSearchQuery(q)
    if (contactName) setContactName('') // clear previous selection when typing again
    if (q.length < 2) { setSearchResults([]); return }
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => searchContacts(q), 300)
  }

  async function handleSend() {
    if (!contactId) { setError('Please select a contact'); return }
    if (!title)     { setError('Please enter a title'); return }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/listing-packages', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ contactId, title, message, listingKeys, send: true }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Failed to send'); return }
      onSent()
    } catch {
      setError('Network error — please try again')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white h-full shadow-xl flex flex-col">
        <div className="p-6 border-b">
          <h2 className="text-lg font-semibold">Send {listingKeys.length} Listing{listingKeys.length !== 1 ? 's' : ''} to Contact</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
          {!preContactId && (
            <div>
              <Input
                label="Search Contact"
                value={searchQuery}
                onChange={e => handleSearchInput(e.target.value)}
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
                      {c.firstName} {c.lastName} <span className="text-charcoal-400">{c.email}</span>
                    </button>
                  ))}
                </div>
              )}
              {contactName && <p className="text-sm text-green-600 mt-1">Selected: {contactName}</p>}
            </div>
          )}
          {preContactName && <p className="text-sm font-medium text-charcoal-700">Sending to: {preContactName}</p>}
          <Input label="Package Title" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Homes matching your criteria" />
          <Textarea label="Message (optional)" value={message} onChange={e => setMessage(e.target.value)} rows={4} placeholder="Hi Sarah, here are a few homes I think you'll love..." />
          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>
        <div className="p-6 border-t flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
          <Button variant="gold" onClick={handleSend} loading={loading} className="flex-1">Send Email</Button>
        </div>
      </div>
    </div>
  )
}
