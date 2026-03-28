'use client'

import { useState } from 'react'
import { Heart } from 'lucide-react'

interface Props {
  propertyId:   string
  initialSaved: boolean
}

export function PortalSaveButton({ propertyId, initialSaved }: Props) {
  const [saved,   setSaved]   = useState(initialSaved)
  const [loading, setLoading] = useState(false)

  async function toggle(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setLoading(true)
    if (saved) {
      await fetch(`/api/portal/reso-saved/${propertyId}`, { method: 'DELETE' })
      setSaved(false)
    } else {
      await fetch('/api/portal/reso-saved', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ resoPropertyId: propertyId }),
      })
      setSaved(true)
    }
    setLoading(false)
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      title={saved ? 'Remove from saved' : 'Save listing'}
      className={`shrink-0 p-1.5 rounded-full transition-colors disabled:opacity-50 ${
        saved ? 'text-red-500 hover:text-red-600' : 'text-gray-300 hover:text-red-400'
      }`}
    >
      <Heart size={18} fill={saved ? 'currentColor' : 'none'} />
    </button>
  )
}
