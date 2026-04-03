'use client'

import { useState } from 'react'
import { Card } from '@/components/layout'
import { Button, useToast } from '@/components/ui'

interface Props {
  initialName: string
}

export function AgentMlsNameCard({ initialName }: Props) {
  const { toast } = useToast()
  const [name,   setName]   = useState(initialName)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/settings', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ listing_agent_mls_name: name.trim() }),
      })
      if (!res.ok) throw new Error('Failed to save')
      toast('success', 'MLS agent name saved')
    } catch {
      toast('error', 'Failed to save', 'Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <h3 className="font-semibold text-charcoal-900 mb-1">Your MLS Agent Name</h3>
      <p className="text-sm text-charcoal-400 mb-4">
        Enter your name exactly as it appears on MLS listings. The Active Listings widget on
        the dashboard will count only listings where you are the listing agent.
      </p>
      <div className="flex gap-3 items-end">
        <div className="flex-1 flex flex-col gap-1.5">
          <label className="text-sm font-medium text-charcoal-700">Name on MLS</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Michael Taylor"
            className="w-full rounded-lg border border-charcoal-200 bg-white px-3 py-2.5 text-sm text-charcoal-900 placeholder:text-charcoal-400 focus:outline-none focus:ring-2 focus:ring-charcoal-900"
          />
        </div>
        <Button variant="primary" onClick={handleSave} loading={saving}>
          Save
        </Button>
      </div>
    </Card>
  )
}
