import { describe, expect, it } from 'vitest'
import {
  calculateTotalMonthlyHousingCost,
  estimateMonthlyPaymentForPrice,
  priceForTargetMonthlyPayment,
  priceRangeForTargetPayment,
  sumLeaseCosts,
} from './calculations'
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

describe('priceRangeForTargetPayment', () => {
  it('brackets a price range whose payments fall within tolerance', () => {
    const { minPrice, maxPrice } = priceRangeForTargetPayment(3200, 100, ASSUMPTIONS)
    expect(minPrice).toBeLessThan(maxPrice)
    expect(estimateMonthlyPaymentForPrice(minPrice, ASSUMPTIONS)).toBeCloseTo(3100, 0)
    expect(estimateMonthlyPaymentForPrice(maxPrice, ASSUMPTIONS)).toBeCloseTo(3300, 0)
  })

  it('every price inside the range estimates a payment within tolerance', () => {
    const { minPrice, maxPrice } = priceRangeForTargetPayment(2800, 100, ASSUMPTIONS)
    for (const fraction of [0, 0.25, 0.5, 0.75, 1]) {
      const price = minPrice + (maxPrice - minPrice) * fraction
      const payment = estimateMonthlyPaymentForPrice(price, ASSUMPTIONS)
      expect(payment).toBeGreaterThanOrEqual(2800 - 100 - 1)
      expect(payment).toBeLessThanOrEqual(2800 + 100 + 1)
    }
  })
})
