'use client'

import { Input, Select, Checkbox } from '@/components/ui'

const AMORTIZATION_OPTIONS = [
  { value: '15', label: '15 years' },
  { value: '20', label: '20 years' },
  { value: '25', label: '25 years' },
  { value: '30', label: '30 years' },
]

interface PropertyDownPaymentFieldsProps {
  purchasePrice: number
  onPurchasePriceChange: (value: number) => void
  isPurchasePriceOverridden: boolean
  onResetPurchasePrice: () => void
  downPayment: number
  onDownPaymentChange: (value: number) => void
  contractRatePercent: number
  onContractRatePercentChange: (value: number) => void
  amortizationYears: number
  onAmortizationYearsChange: (value: number) => void
  propertyTaxAnnual: number
  onPropertyTaxAnnualChange: (value: number) => void
  condoFeesMonthly: number
  onCondoFeesMonthlyChange: (value: number) => void
  heatMonthly: number
  onHeatMonthlyChange: (value: number) => void
  showTorontoOption: boolean
  isTorontoProperty: boolean
  onIsTorontoPropertyChange: (value: boolean) => void
}

export function PropertyDownPaymentFields(props: PropertyDownPaymentFieldsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
      <div className="sm:col-span-2">
        <Input
          label="Purchase Price"
          type="number"
          min={0}
          value={Math.round(props.purchasePrice) || ''}
          onChange={e => props.onPurchasePriceChange(Number(e.target.value))}
          leftIcon={<span>$</span>}
          hint={
            props.isPurchasePriceOverridden
              ? undefined
              : "Defaults to your estimated maximum affordability — edit it to check a specific home's price."
          }
        />
        {props.isPurchasePriceOverridden && (
          <button
            type="button"
            onClick={props.onResetPurchasePrice}
            className="mt-1.5 text-xs font-medium text-gold-600 hover:text-gold-700 transition-colors"
          >
            Reset to my estimated maximum affordability
          </button>
        )}
      </div>
      <Input
        label="Down Payment Available"
        type="number"
        min={0}
        value={props.downPayment || ''}
        onChange={e => props.onDownPaymentChange(Number(e.target.value))}
        leftIcon={<span>$</span>}
      />
      <Input
        label="Mortgage Rate"
        type="number"
        min={0}
        step={0.01}
        value={props.contractRatePercent || ''}
        onChange={e => props.onContractRatePercentChange(Number(e.target.value))}
        rightIcon={<span>%</span>}
        hint="Pre-filled with today's posted rate — edit it if you've been quoted a different rate."
      />
      <Select
        label="Amortization Period"
        options={AMORTIZATION_OPTIONS}
        value={String(props.amortizationYears)}
        onChange={e => props.onAmortizationYearsChange(Number(e.target.value))}
      />
      <Input
        label="Estimated Annual Property Tax"
        type="number"
        min={0}
        value={props.propertyTaxAnnual || ''}
        onChange={e => props.onPropertyTaxAnnualChange(Number(e.target.value))}
        leftIcon={<span>$</span>}
      />
      <Input
        label="Monthly Condo Fees (if any)"
        type="number"
        min={0}
        value={props.condoFeesMonthly || ''}
        onChange={e => props.onCondoFeesMonthlyChange(Number(e.target.value))}
        leftIcon={<span>$</span>}
      />
      <Input
        label="Estimated Monthly Heat"
        type="number"
        min={0}
        value={props.heatMonthly || ''}
        onChange={e => props.onHeatMonthlyChange(Number(e.target.value))}
        leftIcon={<span>$</span>}
      />
      {props.showTorontoOption && (
        <div className="sm:col-span-2">
          <Checkbox
            label="Property is within the City of Toronto (adds Toronto's municipal land transfer tax)"
            checked={props.isTorontoProperty}
            onChange={e => props.onIsTorontoPropertyChange(e.target.checked)}
          />
        </div>
      )}
    </div>
  )
}
