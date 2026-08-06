import { describe, expect, it } from 'vitest'
import { calculateTotalMonthlyHousingCost, estimateMonthlyPaymentForPrice, priceForTargetMonthlyPayment, sumLeaseCosts } from './calculations'
import { searchListingsNearTarget } from './mock-listings'
import { PAYMENT_MATCH_TOLERANCE_DOLLARS } from './constants'
import type { RentVsBuyAssumptions } from './types'

const ASSUMPTIONS: RentVsBuyAssumptions = { downPaymentPercent: 0.05, contractRate: 0.0499, amortizationYears: 25 }

describe('sumLeaseCosts / calculateTotalMonthlyHousingCost', () => {
  it('sums multiple lease cost line items', () => {
    const total = sumLeaseCosts([
      { id: '1', label: 'Parking', amountMonthly: 100 },
      { id: '2', label: 'Insurance', amountMonthly: 30 },
    ])
    expect(total).toBe(130)
  })

  it('ignores non-finite amounts', () => {
    const total = sumLeaseCosts([{ id: '1', label: 'Bad', amountMonthly: NaN }])
    expect(total).toBe(0)
  })

  it('adds rent plus other costs, treating negative rent as 0', () => {
    expect(calculateTotalMonthlyHousingCost(2000, [{ id: '1', label: 'Parking', amountMonthly: 150 }])).toBe(2150)
    expect(calculateTotalMonthlyHousingCost(-500, [])).toBe(0)
  })
})

describe('priceForTargetMonthlyPayment', () => {
  it('is the inverse of estimateMonthlyPaymentForPrice', () => {
    const price = priceForTargetMonthlyPayment(2500, ASSUMPTIONS)
    const payment = estimateMonthlyPaymentForPrice(price, ASSUMPTIONS)
    expect(payment).toBeCloseTo(2500, 0)
  })

  it('returns 0 for a non-positive target payment', () => {
    expect(priceForTargetMonthlyPayment(0, ASSUMPTIONS)).toBe(0)
    expect(priceForTargetMonthlyPayment(-100, ASSUMPTIONS)).toBe(0)
  })
})

describe('searchListingsNearTarget', () => {
  it('returns listings whose estimated payment is within tolerance of the target', () => {
    const result = searchListingsNearTarget({
      city: 'Mississauga',
      maxDistanceKm: 25,
      targetMonthlyPayment: 3200,
      toleranceDollars: PAYMENT_MATCH_TOLERANCE_DOLLARS,
      assumptions: ASSUMPTIONS,
    })

    expect(result.listings.length).toBeGreaterThanOrEqual(3)
    expect(result.cityRecognized).toBe(true)
    expect(result.matchedCityName).toBe('Mississauga')
    for (const listing of result.listings) {
      expect(listing.estimatedMonthlyPayment).toBeGreaterThanOrEqual(3200 - PAYMENT_MATCH_TOLERANCE_DOLLARS - 1)
      expect(listing.estimatedMonthlyPayment).toBeLessThanOrEqual(3200 + PAYMENT_MATCH_TOLERANCE_DOLLARS + 1)
      expect(listing.distanceKm).toBeGreaterThanOrEqual(0)
      expect(listing.distanceKm).toBeLessThanOrEqual(25)
    }
  })

  it('is deterministic for the same inputs', () => {
    const params = { city: 'Barrie', maxDistanceKm: 25, targetMonthlyPayment: 2800, toleranceDollars: 100, assumptions: ASSUMPTIONS }
    const first = searchListingsNearTarget(params)
    const second = searchListingsNearTarget(params)
    expect(first.listings.map(l => l.id)).toEqual(second.listings.map(l => l.id))
  })

  it('falls back to a generic benchmark for an unrecognized city without crashing', () => {
    const result = searchListingsNearTarget({
      city: 'Nowheresville',
      maxDistanceKm: 25,
      targetMonthlyPayment: 2500,
      toleranceDollars: 100,
      assumptions: ASSUMPTIONS,
    })
    expect(result.cityRecognized).toBe(false)
    expect(result.listings.length).toBeGreaterThan(0)
  })

  it('returns no listings when the target payment is zero', () => {
    const result = searchListingsNearTarget({
      city: 'Toronto',
      maxDistanceKm: 25,
      targetMonthlyPayment: 0,
      toleranceDollars: 100,
      assumptions: ASSUMPTIONS,
    })
    expect(result.listings).toEqual([])
  })
})
