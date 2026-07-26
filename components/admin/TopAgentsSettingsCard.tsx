'use client'

import { useState } from 'react'
import { Card } from '@/components/layout'
import { Button, Input, Select, Checkbox, useToast } from '@/components/ui'

interface Props {
  initialPriceMin:      string
  initialPriceMax:      string
  initialPropertyTypes: string[]
  initialLookbackMonths: string
  availablePropertyTypes: string[]
}

const LOOKBACK_OPTIONS = [
  { value: '3',  label: 'Last 3 months' },
  { value: '6',  label: 'Last 6 months' },
  { value: '12', label: 'Last 12 months' },
  { value: '24', label: 'Last 24 months' },
]

export function TopAgentsSettingsCard({
  initialPriceMin,
  initialPriceMax,
  initialPropertyTypes,
  initialLookbackMonths,
  availablePropertyTypes,
}: Props) {
  const { toast } = useToast()
  const [priceMin,       setPriceMin]       = useState(initialPriceMin)
  const [priceMax,       setPriceMax]       = useState(initialPriceMax)
  const [propertyTypes,  setPropertyTypes]  = useState<string[]>(initialPropertyTypes)
  const [lookbackMonths, setLookbackMonths] = useState(initialLookbackMonths)
  const [saving,         setSaving]         = useState(false)

  function toggleType(type: string) {
    setPropertyTypes(prev => prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type])
  }

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/settings', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          top_agents_price_min:       priceMin.trim(),
          top_agents_price_max:       priceMax.trim(),
          top_agents_property_types:  propertyTypes.join(','),
          top_agents_lookback_months: lookbackMonths,
        }),
      })
      if (!res.ok) throw new Error('Failed to save')
      toast('success', 'Top Agents settings saved')
    } catch {
      toast('error', 'Failed to save', 'Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <h3 className="font-semibold text-charcoal-900 mb-1">Top Agents Leaderboard</h3>
      <p className="text-sm text-charcoal-400 mb-4">
        Controls the &ldquo;Top Agents&rdquo; dashboard widget, which ranks listing agents by
        listing count (any status — a listing keeps counting after it&rsquo;s no longer active)
        within the list-price range and property types below. Useful for researching which
        agents are generating the most leads in a market segment.
      </p>

      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Min price"
            hint="Full dollar amount, e.g. 500000 for $500K"
            type="number"
            min={0}
            placeholder="No minimum"
            value={priceMin}
            onChange={e => setPriceMin(e.target.value)}
          />
          <Input
            label="Max price"
            hint="Full dollar amount, e.g. 1000000 for $1M"
            type="number"
            min={0}
            placeholder="No maximum"
            value={priceMax}
            onChange={e => setPriceMax(e.target.value)}
          />
        </div>

        <Select
          label="Lookback window"
          hint="Active listings always count, regardless of age. This only limits how far back a no-longer-active listing can still count."
          options={LOOKBACK_OPTIONS}
          value={lookbackMonths}
          onChange={e => setLookbackMonths(e.target.value)}
        />

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-charcoal-700">Property types</label>
          {availablePropertyTypes.length === 0 ? (
            <p className="text-xs text-charcoal-400">
              No property types found yet — sync closed listings first.
            </p>
          ) : (
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {availablePropertyTypes.map(type => (
                <Checkbox
                  key={type}
                  label={type}
                  checked={propertyTypes.includes(type)}
                  onChange={() => toggleType(type)}
                />
              ))}
            </div>
          )}
          <p className="text-xs text-charcoal-400 mt-0.5">Leave all unchecked to include every property type.</p>
        </div>

        <Button variant="primary" onClick={handleSave} loading={saving} className="self-start">
          Save
        </Button>
      </div>
    </Card>
  )
}
