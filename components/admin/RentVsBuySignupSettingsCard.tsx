'use client'

import { useState } from 'react'
import { Card } from '@/components/layout'
import { Button, Input } from '@/components/ui'

interface Props {
  initialUses:    number
  initialEnabled: boolean
}

export function RentVsBuySignupSettingsCard({ initialUses, initialEnabled }: Props) {
  const [uses,    setUses]    = useState(String(initialUses))
  const [enabled, setEnabled] = useState(initialEnabled)
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)

  async function handleSave() {
    setSaving(true)
    await fetch('/api/admin/settings', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        rent_vs_buy_signup_prompt_uses:    uses,
        rent_vs_buy_signup_prompt_enabled: String(enabled),
      }),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <Card>
      <h3 className="font-semibold text-charcoal-900 mb-1">Rent vs Buy Signup Prompt</h3>
      <p className="text-sm text-charcoal-400 mb-4">
        After a visitor searches the Rent vs Buy tool this many times, show a dismissible prompt inviting them to sign up for a fuller list of matching properties.
      </p>

      <div className="flex flex-col gap-4">
        {/* Toggle */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-charcoal-900">Enable prompt</p>
            <p className="text-xs text-charcoal-400">When off, visitors are never prompted</p>
          </div>
          <button
            type="button"
            onClick={() => setEnabled(e => !e)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              enabled ? 'bg-gold-500' : 'bg-charcoal-200'
            }`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
              enabled ? 'translate-x-6' : 'translate-x-1'
            }`} />
          </button>
        </div>

        {/* Uses threshold */}
        <Input
          label="Tool uses before prompting"
          type="number"
          min={1}
          value={uses}
          onChange={e => setUses(e.target.value)}
        />

        <Button
          variant="primary"
          className="self-start"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving…' : saved ? 'Saved!' : 'Save'}
        </Button>
      </div>
    </Card>
  )
}
