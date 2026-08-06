import { estimateListingMortgagePayment } from '@/lib/mortgage'
import type { LeaseCostItem, RentVsBuyAssumptions } from './types'

export function sumLeaseCosts(items: LeaseCostItem[]): number {
  return items.reduce((sum, item) => sum + (Number.isFinite(item.amountMonthly) ? item.amountMonthly : 0), 0)
}

export function calculateTotalMonthlyHousingCost(monthlyRent: number, otherCosts: LeaseCostItem[]): number {
  const rent = Number.isFinite(monthlyRent) ? Math.max(monthlyRent, 0) : 0
  return rent + sumLeaseCosts(otherCosts)
}

export function estimateMonthlyPaymentForPrice(price: number, assumptions: RentVsBuyAssumptions): number {
  if (price <= 0) return 0
  return estimateListingMortgagePayment(price, assumptions.downPaymentPercent, {
    contractRate: assumptions.contractRate,
    amortizationYears: assumptions.amortizationYears,
  }).monthlyPayment
}

/**
 * Inverse of estimateMonthlyPaymentForPrice: finds the purchase price whose estimated monthly
 * payment equals targetPayment, under the given assumptions. Solved with a bounded binary search
 * (rather than closed-form algebra) so it stays correct even if estimateListingMortgagePayment's
 * CMHC-premium tiering changes later — mirrors the approach used in lib/mortgage's
 * calculateMaxAffordability for the same reason.
 */
export function priceForTargetMonthlyPayment(targetPayment: number, assumptions: RentVsBuyAssumptions): number {
  if (targetPayment <= 0) return 0

  let lo = 0
  let hi = 5_000_000
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2
    const payment = estimateMonthlyPaymentForPrice(mid, assumptions)
    if (payment < targetPayment) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

/**
 * The price range whose estimated payment falls within `toleranceDollars` of `targetPayment`.
 * Down payment % is fixed, so loan-to-value (and therefore CMHC premium tier) doesn't change
 * with price, making the payment strictly increasing in price — this range is a valid bound to
 * query a listings price filter with, not just an approximation.
 */
export function priceRangeForTargetPayment(
  targetPayment: number,
  toleranceDollars: number,
  assumptions: RentVsBuyAssumptions
): { minPrice: number; maxPrice: number } {
  const minPrice = priceForTargetMonthlyPayment(Math.max(targetPayment - toleranceDollars, 1), assumptions)
  const maxPrice = priceForTargetMonthlyPayment(targetPayment + toleranceDollars, assumptions)
  return { minPrice, maxPrice }
}
