'use client'

import { useState } from 'react'
import { PenSquare } from 'lucide-react'
import { ComposeEmailModal } from './ComposeEmailModal'

export function InboxComposeButton() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 bg-charcoal-900 text-white text-sm rounded-lg hover:bg-charcoal-700 transition-colors"
      >
        <PenSquare size={14} /> Compose
      </button>

      {open && <ComposeEmailModal onClose={() => setOpen(false)} />}
    </>
  )
}
