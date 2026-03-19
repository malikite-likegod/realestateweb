'use client'

import { useState } from 'react'
import { Bookmark, BookmarkCheck } from 'lucide-react'

interface Props {
  filters:     Record<string, string>
  searchName?: string
}

export function SaveSearchButton({ filters, searchName }: Props) {
  const [saved,   setSaved]   = useState(false)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  async function handleSave() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/saved-searches', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name: searchName, filters }),
      })
      if (res.status === 401) {
        setError('Verify your email first to save searches.')
        return
      }
      if (!res.ok) throw new Error('Save failed')
      setSaved(true)
    } catch {
      setError('Could not save search. Try again.')
    } finally {
      setLoading(false)
    }
  }

  if (saved) {
    return (
      <span className="flex items-center gap-1.5 text-sm text-gold-600 font-medium">
        <BookmarkCheck size={16} /> Search saved
      </span>
    )
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        onClick={handleSave}
        disabled={loading}
        className="flex items-center gap-1.5 text-sm text-charcoal-500 hover:text-gold-600 transition-colors disabled:opacity-50"
      >
        <Bookmark size={16} /> {loading ? 'Saving…' : 'Save this search'}
      </button>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
