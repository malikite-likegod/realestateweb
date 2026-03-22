'use client'

import { useState } from 'react'
import { Mail, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui'

interface Props {
  contactId:     string
  accountStatus: string | null
}

export function PortalInviteButton({ contactId, accountStatus }: Props) {
  const [loading, setSending] = useState(false)
  const [sent,    setSent]    = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  if (accountStatus === 'active') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
        <CheckCircle size={13} /> Portal Active
      </span>
    )
  }

  const label = accountStatus === 'invited' ? 'Resend Invitation' : 'Send Portal Invitation'

  async function handleClick() {
    setSending(true)
    setError(null)
    try {
      const res = await fetch(`/api/contacts/${contactId}/invite`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Failed to send'); return }
      setSent(true)
    } finally {
      setSending(false)
    }
  }

  if (sent) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
        <CheckCircle size={13} /> Invitation sent!
      </span>
    )
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="outline"
        size="sm"
        leftIcon={<Mail size={13} />}
        onClick={handleClick}
        disabled={loading}
      >
        {loading ? 'Sending…' : label}
      </Button>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
