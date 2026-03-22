'use client'

import { useState } from 'react'
import { Heart } from 'lucide-react'

interface Props { listingId: string; initialSaved: boolean }

export function SaveButton({ listingId, initialSaved }: Props) {
  const [saved,   setSaved]   = useState(initialSaved)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  async function toggle() {
    setLoading(true)
    setError(null)
    try {
      let res: Response
      if (saved) {
        res = await fetch(`/api/portal/saved/${listingId}`, { method: 'DELETE' })
      } else {
        res = await fetch('/api/portal/saved', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ listingId }),
        })
      }
      if (!res.ok) { setError('Failed'); return }
      setSaved(!saved)
    } catch {
      setError('Failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center">
      <button
        onClick={toggle}
        disabled={loading}
        className={`p-2 rounded-full transition-colors ${saved ? 'text-red-500 bg-red-50' : 'text-gray-400 hover:text-red-400 bg-gray-50'}`}
        title={saved ? 'Unsave' : 'Save'}
      >
        <Heart size={16} fill={saved ? 'currentColor' : 'none'} />
      </button>
      {error && <span className="text-xs text-red-500">!</span>}
    </div>
  )
}
