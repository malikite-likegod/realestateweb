'use client'

import { useEffect, useState } from 'react'
import { AutocompleteInput, Input } from '@/components/ui'
import { Plus, X } from 'lucide-react'
import type { LeaseCostItem } from '@/lib/rent-vs-buy'

interface RentCostFieldsProps {
  monthlyRent: number
  onMonthlyRentChange: (value: number) => void
  otherCosts: LeaseCostItem[]
  onAddCostItem: () => void
  onRemoveCostItem: (id: string) => void
  onCostItemChange: (id: string, patch: Partial<LeaseCostItem>) => void
  city: string
  onCityChange: (value: string) => void
  maxDistanceKm: number
  onMaxDistanceKmChange: (value: number) => void
}

export function RentCostFields(props: RentCostFieldsProps) {
  const [cityOptions, setCityOptions] = useState<string[]>([])

  useEffect(() => {
    fetch('/api/search/geo?level=areas')
      .then(r => r.json())
      .then((data: string[]) => setCityOptions(data))
      .catch(() => {})
  }, [])

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <Input
          label="Monthly Rent"
          type="number"
          min={0}
          value={props.monthlyRent || ''}
          onChange={e => props.onMonthlyRentChange(Number(e.target.value))}
          leftIcon={<span>$</span>}
        />
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-charcoal-700">City or Town</label>
          <AutocompleteInput
            options={cityOptions}
            value={props.city}
            onChange={props.onCityChange}
            placeholder="e.g. Mississauga"
          />
          <p className="text-xs text-charcoal-500">Where you currently live — we&apos;ll look for homes nearby.</p>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-charcoal-700">Other Monthly Lease Costs</label>
          <button
            type="button"
            onClick={props.onAddCostItem}
            className="inline-flex items-center gap-1 text-xs font-semibold text-gold-600 hover:text-gold-700 transition-colors"
          >
            <Plus size={14} /> Add another cost
          </button>
        </div>
        <p className="text-xs text-charcoal-500 mb-3">Utilities, parking, renter&apos;s insurance, pet rent, storage, etc.</p>
        <div className="space-y-3">
          {props.otherCosts.map(item => (
            <div key={item.id} className="flex items-start gap-2">
              <div className="flex-1">
                <Input
                  placeholder="e.g. Parking"
                  value={item.label}
                  onChange={e => props.onCostItemChange(item.id, { label: e.target.value })}
                />
              </div>
              <div className="w-28 shrink-0">
                <Input
                  type="number"
                  min={0}
                  placeholder="0"
                  value={item.amountMonthly || ''}
                  onChange={e => props.onCostItemChange(item.id, { amountMonthly: Number(e.target.value) })}
                  leftIcon={<span>$</span>}
                />
              </div>
              <button
                type="button"
                onClick={() => props.onRemoveCostItem(item.id)}
                className="mt-2.5 shrink-0 text-charcoal-400 hover:text-red-600 transition-colors"
                aria-label="Remove this cost"
              >
                <X size={18} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="sm:w-1/2">
        <Input
          label="Maximum Distance From Your City"
          type="number"
          min={1}
          max={200}
          value={props.maxDistanceKm || ''}
          onChange={e => props.onMaxDistanceKmChange(Number(e.target.value))}
          rightIcon={<span>km</span>}
          hint="Defaults to 25 km — widen this if you're open to a longer commute."
        />
      </div>
    </div>
  )
}
