'use client'

import { useMemo, useState } from 'react'
import { Card } from '@/components/layout'
import { DEFAULT_ASSUMPTIONS } from '@/lib/mortgage'
import {
  DEFAULT_MAX_DISTANCE_KM,
  PAYMENT_MATCH_TOLERANCE_DOLLARS,
  RENT_VS_BUY_ASSUMPTIONS,
  calculateTotalMonthlyHousingCost,
  searchListingsNearTarget,
  sumLeaseCosts,
} from '@/lib/rent-vs-buy'
import type { LeaseCostItem } from '@/lib/rent-vs-buy'
import { RentCostFields } from './rent-vs-buy/RentCostFields'
import { CostSummaryPanel } from './rent-vs-buy/CostSummaryPanel'
import { ListingResultsGrid } from './rent-vs-buy/ListingResultsGrid'
import { RentVsBuyDisclaimer } from './RentVsBuyDisclaimer'

interface RentVsBuyCalculatorProps {
  /** Current rate (decimal, e.g. 0.0499), sourced from Settings → Mortgage Calculator. Falls back to a static default if unset. */
  initialRate?: number
}

let costItemCounter = 0
function makeCostItemId() {
  costItemCounter += 1
  return `cost-${Date.now()}-${costItemCounter}`
}

export function RentVsBuyCalculator({ initialRate }: RentVsBuyCalculatorProps) {
  const [monthlyRent, setMonthlyRent] = useState(2_200)
  const [otherCosts, setOtherCosts] = useState<LeaseCostItem[]>([
    { id: makeCostItemId(), label: 'Utilities, parking, insurance & other costs', amountMonthly: 150 },
  ])
  const [city, setCity] = useState('')
  const [maxDistanceKm, setMaxDistanceKm] = useState(DEFAULT_MAX_DISTANCE_KM)

  const contractRate = initialRate ?? DEFAULT_ASSUMPTIONS.contractRate

  const assumptions = useMemo(
    () => ({
      downPaymentPercent: RENT_VS_BUY_ASSUMPTIONS.downPaymentPercent,
      amortizationYears: RENT_VS_BUY_ASSUMPTIONS.amortizationYears,
      contractRate,
    }),
    [contractRate]
  )

  const otherCostsTotal = useMemo(() => sumLeaseCosts(otherCosts), [otherCosts])
  const totalMonthlyCost = useMemo(() => calculateTotalMonthlyHousingCost(monthlyRent, otherCosts), [monthlyRent, otherCosts])

  const searchResult = useMemo(() => {
    if (!city.trim() || totalMonthlyCost <= 0) return null
    return searchListingsNearTarget({
      city,
      maxDistanceKm: maxDistanceKm > 0 ? maxDistanceKm : DEFAULT_MAX_DISTANCE_KM,
      targetMonthlyPayment: totalMonthlyCost,
      toleranceDollars: PAYMENT_MATCH_TOLERANCE_DOLLARS,
      assumptions,
    })
  }, [city, maxDistanceKm, totalMonthlyCost, assumptions])

  const handleAddCostItem = () => setOtherCosts(items => [...items, { id: makeCostItemId(), label: '', amountMonthly: 0 }])
  const handleRemoveCostItem = (id: string) => setOtherCosts(items => items.filter(item => item.id !== id))
  const handleCostItemChange = (id: string, patch: Partial<LeaseCostItem>) =>
    setOtherCosts(items => items.map(item => (item.id === id ? { ...item, ...patch } : item)))

  return (
    <div className="space-y-8">
      <RentVsBuyDisclaimer />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        <div className="lg:col-span-2 space-y-8">
          <Card padding="lg">
            <RentCostFields
              monthlyRent={monthlyRent}
              onMonthlyRentChange={setMonthlyRent}
              otherCosts={otherCosts}
              onAddCostItem={handleAddCostItem}
              onRemoveCostItem={handleRemoveCostItem}
              onCostItemChange={handleCostItemChange}
              city={city}
              onCityChange={setCity}
              maxDistanceKm={maxDistanceKm}
              onMaxDistanceKmChange={setMaxDistanceKm}
            />
          </Card>

          <div>
            <h3 className="font-serif text-lg font-bold text-charcoal-900 mb-3">
              {searchResult && searchResult.listings.length > 0
                ? `Homes Near ${searchResult.matchedCityName} in Your Budget`
                : 'Homes In Your Budget'}
            </h3>
            <ListingResultsGrid searchResult={searchResult} />
          </div>
        </div>

        <div className="lg:sticky lg:top-24">
          <CostSummaryPanel
            monthlyRent={monthlyRent}
            otherCostsTotal={otherCostsTotal}
            totalMonthlyCost={totalMonthlyCost}
            toleranceDollars={PAYMENT_MATCH_TOLERANCE_DOLLARS}
            assumptions={assumptions}
          />
        </div>
      </div>
    </div>
  )
}
