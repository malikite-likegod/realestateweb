'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Card } from '@/components/layout'
import { RangeSlider } from '@/components/ui'
import { formatPrice } from '@/lib/utils'
import { estimateListingMortgagePayment, getMinimumDownPayment } from '@/lib/mortgage'
import { MortgageDisclaimer } from './MortgageDisclaimer'
import { ArrowRight, Calculator } from 'lucide-react'

interface MortgagePaymentEstimateWidgetProps {
  listPrice: number
  /** Current rate (decimal, e.g. 0.0499), sourced from Settings → Mortgage Calculator. Falls back to a static default if unset. */
  contractRate?: number
}

export function MortgagePaymentEstimateWidget({ listPrice, contractRate }: MortgagePaymentEstimateWidgetProps) {
  const minDownPayment = useMemo(() => getMinimumDownPayment(listPrice), [listPrice])
  const minPercent = Math.round(minDownPayment.minDownPaymentPercent * 100)
  const defaultPercent = Math.max(minPercent, 20)

  const [downPaymentPercent, setDownPaymentPercent] = useState(defaultPercent)

  const estimate = useMemo(
    () => estimateListingMortgagePayment(listPrice, downPaymentPercent / 100, { contractRate }),
    [listPrice, downPaymentPercent, contractRate]
  )

  if (!listPrice || listPrice <= 0) return null

  return (
    <Card padding="lg">
      <div className="flex items-center gap-2 mb-4">
        <Calculator size={18} className="text-gold-600" />
        <h3 className="font-serif text-lg font-bold text-charcoal-900">Estimated Mortgage Payment</h3>
      </div>

      <RangeSlider
        label="Down Payment"
        value={downPaymentPercent}
        min={minPercent}
        max={50}
        step={1}
        onChange={setDownPaymentPercent}
        formatValue={v => `${v}% (${formatPrice(listPrice * (v / 100))})`}
        hint={minPercent > 5 ? `Minimum down payment for this price is ${minPercent}%.` : undefined}
      />

      <div className="mt-6 rounded-xl bg-charcoal-50 p-4">
        <p className="text-xs uppercase tracking-wide text-charcoal-500 mb-1">Estimated Monthly Payment</p>
        <p className="font-serif text-3xl font-bold text-charcoal-900">
          {formatPrice(estimate.monthlyPayment)}
          <span className="text-sm font-normal text-charcoal-500"> /mo</span>
        </p>
        <p className="mt-1 text-xs text-charcoal-500">Principal &amp; interest only — taxes and utilities not included.</p>
        {estimate.cmhcPremiumIncluded && (
          <p className="mt-2 text-xs text-charcoal-500">
            Includes an estimated CMHC insurance premium of {formatPrice(estimate.cmhcPremiumAmount)}, financed into the loan.
          </p>
        )}
      </div>

      <Link
        href={`/tools/affordability-calculator?price=${Math.round(listPrice)}`}
        className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-charcoal-900 hover:text-gold-600 transition-colors"
      >
        Get a full affordability estimate <ArrowRight size={15} />
      </Link>

      <MortgageDisclaimer className="mt-5" />
    </Card>
  )
}
