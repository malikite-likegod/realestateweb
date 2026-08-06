'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Card } from '@/components/layout'
import { DEFAULT_ASSUMPTIONS } from '@/lib/mortgage'
import {
  DEFAULT_MAX_DISTANCE_KM,
  PAYMENT_MATCH_TOLERANCE_DOLLARS,
  RENT_VS_BUY_ASSUMPTIONS,
  calculateTotalMonthlyHousingCost,
  sumLeaseCosts,
} from '@/lib/rent-vs-buy'
import type { LeaseCostItem, RentVsBuySearchResponse } from '@/lib/rent-vs-buy'
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

const SEARCH_DEBOUNCE_MS = 500

export function RentVsBuyCalculator({ initialRate }: RentVsBuyCalculatorProps) {
  const [monthlyRent, setMonthlyRent] = useState(2_200)
  const [otherCosts, setOtherCosts] = useState<LeaseCostItem[]>([
    { id: makeCostItemId(), label: 'Utilities, parking, insurance & other costs', amountMonthly: 150 },
  ])
  const [city, setCity] = useState('')
  const [maxDistanceKm, setMaxDistanceKm] = useState(DEFAULT_MAX_DISTANCE_KM)

  const [searchResult, setSearchResult] = useState<RentVsBuySearchResponse | null>(null)
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState(false)

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

  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!city.trim() || totalMonthlyCost <= 0) {
      setSearchResult(null)
      setSearchLoading(false)
      setSearchError(false)
      return
    }

    const timer = setTimeout(() => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      setSearchLoading(true)
      setSearchError(false)

      const params = new URLSearchParams({
        city,
        maxDistanceKm: String(maxDistanceKm > 0 ? maxDistanceKm : DEFAULT_MAX_DISTANCE_KM),
        targetMonthlyPayment: String(totalMonthlyCost),
      })

      fetch(`/api/rent-vs-buy/search?${params}`, { signal: controller.signal })
        .then(res => {
          if (!res.ok) throw new Error('Search failed')
          return res.json() as Promise<RentVsBuySearchResponse>
        })
        .then(data => {
          setSearchResult(data)
          setSearchLoading(false)
        })
        .catch(err => {
          if (err.name === 'AbortError') return
          setSearchError(true)
          setSearchLoading(false)
        })
    }, SEARCH_DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [city, maxDistanceKm, totalMonthlyCost])

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
            <ListingResultsGrid searchResult={searchResult} loading={searchLoading} error={searchError} />
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
