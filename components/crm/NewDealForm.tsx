'use client'

/**
 * NewDealForm
 *
 * Compact form rendered inside a modal. Creates a deal via POST /api/deals
 * and calls onCreated() with the new deal so the board can optimistically
 * add it without a full page reload.
 */

import { useState } from 'react'
import { Briefcase } from 'lucide-react'
import { Button } from '@/components/ui'

interface Stage   { id: string; name: string; color: string }
interface Contact { id: string; firstName: string; lastName: string; email: string | null }

interface NewDealFormProps {
  stages:        Stage[]
  defaultStageId?: string
  onCreated?:    (deal: unknown) => void
  onCancel?:     () => void
}

export function NewDealForm({ stages, defaultStageId, onCreated, onCancel }: NewDealFormProps) {
  const [title,         setTitle]         = useState('')
  const [stageId,       setStageId]       = useState(defaultStageId ?? stages[0]?.id ?? '')
  const [value,         setValue]         = useState('')
  const [probability,   setProbability]   = useState('50')
  const [expectedClose, setExpectedClose] = useState('')
  const [contactSearch, setContactSearch] = useState('')
  const [contacts,      setContacts]      = useState<Contact[]>([])
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  // Live contact search
  async function searchContacts(q: string) {
    setContactSearch(q)
    if (q.length < 2) { setContacts([]); return }
    const res  = await fetch(`/api/contacts?search=${encodeURIComponent(q)}&pageSize=8`)
    const json = await res.json()
    setContacts(json.data ?? [])
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) { setError('Title is required'); return }
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/deals', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          title:         title.trim(),
          stageId,
          value:         value         ? parseFloat(value)         : undefined,
          probability:   probability   ? parseInt(probability)     : 50,
          expectedClose: expectedClose ? expectedClose              : undefined,
          contactIds:    selectedContact ? [selectedContact.id]    : [],
        }),
      })
      if (!res.ok) throw new Error('Failed to create deal')
      const { data } = await res.json()
      onCreated?.(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'w-full rounded-lg border border-charcoal-200 bg-white px-3 py-2 text-sm text-charcoal-900 placeholder:text-charcoal-400 focus:outline-none focus:ring-2 focus:ring-charcoal-900'

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label className="text-xs text-charcoal-500 mb-1 block">Deal Title *</label>
        <input type="text" value={title} onChange={e => setTitle(e.target.value)}
          placeholder="e.g. 123 Maple St Purchase" className={inputCls} autoFocus />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-charcoal-500 mb-1 block">Stage</label>
          <select value={stageId} onChange={e => setStageId(e.target.value)} className={inputCls}>
            {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-charcoal-500 mb-1 block">Value (CAD)</label>
          <input type="number" min={0} value={value} onChange={e => setValue(e.target.value)}
            placeholder="0" className={inputCls} />
        </div>
        <div>
          <label className="text-xs text-charcoal-500 mb-1 block">Probability (%)</label>
          <input type="number" min={0} max={100} value={probability} onChange={e => setProbability(e.target.value)}
            className={inputCls} />
        </div>
        <div>
          <label className="text-xs text-charcoal-500 mb-1 block">Expected Close</label>
          <input type="date" value={expectedClose} onChange={e => setExpectedClose(e.target.value)}
            className={inputCls} />
        </div>
      </div>

      {/* Contact search */}
      <div className="relative">
        <label className="text-xs text-charcoal-500 mb-1 block">Contact (optional)</label>
        {selectedContact ? (
          <div className="flex items-center gap-2 rounded-lg border border-charcoal-200 bg-charcoal-50 px-3 py-2">
            <span className="text-sm text-charcoal-900 flex-1">
              {selectedContact.firstName} {selectedContact.lastName}
            </span>
            <button type="button" onClick={() => setSelectedContact(null)}
              className="text-xs text-charcoal-400 hover:text-red-500">✕</button>
          </div>
        ) : (
          <>
            <input type="text" value={contactSearch} onChange={e => searchContacts(e.target.value)}
              placeholder="Search contacts…" className={inputCls} />
            {contacts.length > 0 && (
              <div className="absolute z-10 w-full mt-1 rounded-xl border border-charcoal-200 bg-white shadow-lg overflow-hidden">
                {contacts.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => { setSelectedContact(c); setContacts([]); setContactSearch('') }}
                    className="w-full flex items-start gap-3 px-4 py-2.5 text-left hover:bg-charcoal-50 transition-colors"
                  >
                    <div>
                      <p className="text-sm font-medium text-charcoal-900">{c.firstName} {c.lastName}</p>
                      {c.email && <p className="text-xs text-charcoal-400">{c.email}</p>}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex gap-2 justify-end pt-1">
        {onCancel && (
          <Button type="button" variant="secondary" size="sm" onClick={onCancel}>Cancel</Button>
        )}
        <Button type="submit" variant="primary" size="sm" loading={saving} leftIcon={<Briefcase size={14} />}>
          Create Deal
        </Button>
      </div>
    </form>
  )
}
