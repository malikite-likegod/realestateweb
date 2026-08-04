'use client'

import { useState } from 'react'
import { Card } from '@/components/layout'
import { Input, Button } from '@/components/ui'
import { Percent } from 'lucide-react'

interface Props {
  initialRatePercent: string
}

export function MortgageRateSettingsCard({ initialRatePercent }: Props) {
  const [ratePercent, setRatePercent] = useState(initialRatePercent)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function save() {
    setSaving(true)
    setSaved(false)
    await fetch('/api/admin/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mortgage_current_rate_percent: ratePercent }),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <Card>
      <div className="flex items-center gap-2 mb-2">
        <Percent size={18} className="text-gold-500 shrink-0" />
        <h3 className="font-semibold text-charcoal-900">Mortgage Calculator — Current Rate</h3>
      </div>
      <p className="text-sm text-charcoal-500 mb-4">
        Sets the default interest rate shown on the public affordability calculator and the
        listing-page payment estimate — update this whenever rates move. Visitors can still
        edit the rate themselves on the full calculator; this is just the starting value.
      </p>
      <div className="flex items-end gap-3">
        <Input
          label="Current Rate"
          type="number"
          min={0}
          step={0.01}
          value={ratePercent}
          onChange={e => setRatePercent(e.target.value)}
          rightIcon={<span>%</span>}
        />
        <Button variant="primary" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save'}
        </Button>
      </div>
    </Card>
  )
}
