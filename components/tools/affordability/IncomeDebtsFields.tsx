'use client'

import { Input, Select, Checkbox } from '@/components/ui'
import { PROVINCE_LABELS } from '@/lib/mortgage'
import type { CreditTier, Province } from '@/lib/mortgage'

const PROVINCE_OPTIONS = Object.entries(PROVINCE_LABELS).map(([value, label]) => ({ value, label }))

const CREDIT_TIER_OPTIONS = [
  { value: 'good', label: 'Good — 680+ credit score' },
  { value: 'fair', label: 'Fair — 600 to 679 credit score' },
  { value: 'poor', label: 'Below 600 credit score' },
]

interface IncomeDebtsFieldsProps {
  province: Province
  onProvinceChange: (province: Province) => void
  grossAnnualIncome: number
  onGrossAnnualIncomeChange: (value: number) => void
  monthlyDebts: number
  onMonthlyDebtsChange: (value: number) => void
  creditTier: CreditTier
  onCreditTierChange: (tier: CreditTier) => void
  isFirstTimeBuyer: boolean
  onIsFirstTimeBuyerChange: (value: boolean) => void
}

export function IncomeDebtsFields(props: IncomeDebtsFieldsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
      <Select
        label="Province"
        options={PROVINCE_OPTIONS}
        value={props.province}
        onChange={e => props.onProvinceChange(e.target.value as Province)}
      />
      <Select
        label="Credit Profile"
        options={CREDIT_TIER_OPTIONS}
        value={props.creditTier}
        onChange={e => props.onCreditTierChange(e.target.value as CreditTier)}
      />
      <Input
        label="Gross Annual Household Income"
        type="number"
        min={0}
        value={props.grossAnnualIncome || ''}
        onChange={e => props.onGrossAnnualIncomeChange(Number(e.target.value))}
        leftIcon={<span>$</span>}
      />
      <Input
        label="Total Monthly Debt Payments"
        type="number"
        min={0}
        value={props.monthlyDebts || ''}
        onChange={e => props.onMonthlyDebtsChange(Number(e.target.value))}
        leftIcon={<span>$</span>}
        hint="Car loans, credit cards, student loans, other mortgages, etc."
      />
      <div className="sm:col-span-2">
        <Checkbox
          label="I am a first-time home buyer"
          checked={props.isFirstTimeBuyer}
          onChange={e => props.onIsFirstTimeBuyerChange(e.target.checked)}
        />
      </div>
    </div>
  )
}
