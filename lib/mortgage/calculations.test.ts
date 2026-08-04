import { describe, expect, it } from 'vitest'
import {
  calculateCmhcPremium,
  calculateGdsRatio,
  calculateMaxAffordability,
  calculateMortgagePayment,
  calculateTdsRatio,
  estimateListingMortgagePayment,
  getCmhcPremiumRate,
  getMinimumDownPayment,
  getStressTestQualifyingRate,
} from './calculations'
import { CMHC_PREMIUM_TIERS, MIN_DOWN_PAYMENT_TIERS, STRESS_TEST } from './constants'
import type { AffordabilityInput } from './types'

describe('calculateMortgagePayment', () => {
  it('matches a known published example ($500,000 @ 5%, 25yr amortization)', () => {
    // Standard Canadian semi-annual-compounding example: ~$2,908/month
    const payment = calculateMortgagePayment(500_000, 0.05, 25)
    expect(payment).toBeGreaterThan(2_900)
    expect(payment).toBeLessThan(2_920)
  })

  it('returns 0 for a non-positive principal', () => {
    expect(calculateMortgagePayment(0, 0.05, 25)).toBe(0)
    expect(calculateMortgagePayment(-100, 0.05, 25)).toBe(0)
  })

  it('handles a 0% rate as a straight-line payment', () => {
    expect(calculateMortgagePayment(120_000, 0, 10)).toBeCloseTo(1_000, 5)
  })
})

describe('getMinimumDownPayment', () => {
  it('requires exactly 5% below $500,000', () => {
    const result = getMinimumDownPayment(400_000)
    expect(result.minDownPaymentPercent).toBeCloseTo(0.05, 6)
    expect(result.minDownPayment).toBeCloseTo(20_000, 2)
    expect(result.isInsurable).toBe(true)
  })

  it('is exactly 5% at the $500,000 boundary', () => {
    const result = getMinimumDownPayment(500_000)
    expect(result.minDownPaymentPercent).toBeCloseTo(0.05, 6)
    expect(result.minDownPayment).toBeCloseTo(25_000, 2)
  })

  it('blends 5%/10% between $500,000 and $1,500,000', () => {
    const result = getMinimumDownPayment(1_000_000)
    // 5% of 500k + 10% of 500k = 25,000 + 50,000 = 75,000
    expect(result.minDownPayment).toBeCloseTo(75_000, 2)
    expect(result.isInsurable).toBe(true)
  })

  it('flips to a flat 20% (not insurable) at exactly $1,500,000', () => {
    const result = getMinimumDownPayment(1_500_000)
    expect(result.minDownPaymentPercent).toBeCloseTo(0.2, 6)
    expect(result.minDownPayment).toBeCloseTo(300_000, 2)
    expect(result.isInsurable).toBe(false)
  })

  it('requires only ~$125,000 (tiered) just below $1,500,000', () => {
    const result = getMinimumDownPayment(1_499_999)
    expect(result.minDownPayment).toBeLessThan(200_000)
    expect(result.isInsurable).toBe(true)
  })
})

describe('getCmhcPremiumRate', () => {
  for (const tier of CMHC_PREMIUM_TIERS) {
    it(`returns ${tier.rate} at the ${tier.maxLtv} LTV boundary`, () => {
      expect(getCmhcPremiumRate(tier.maxLtv)).toBe(tier.rate)
    })
  }

  it('returns null above 95% LTV (not insurable)', () => {
    expect(getCmhcPremiumRate(0.96)).toBeNull()
  })
})

describe('calculateCmhcPremium', () => {
  it('includes a premium below 20% down', () => {
    const result = calculateCmhcPremium(475_000, 0.05)
    expect(result).not.toBeNull()
    expect(result!.premiumAmount).toBeGreaterThan(0)
  })

  it('excludes a premium at exactly 20% down', () => {
    expect(calculateCmhcPremium(400_000, 0.2)).toBeNull()
  })

  it('excludes a premium above 20% down', () => {
    expect(calculateCmhcPremium(300_000, 0.3)).toBeNull()
  })
})

describe('getStressTestQualifyingRate', () => {
  it('uses contract rate + buffer when that exceeds the floor', () => {
    expect(getStressTestQualifyingRate(0.06)).toBeCloseTo(0.08, 6)
  })

  it('uses the floor rate when contract rate + buffer is below it', () => {
    expect(getStressTestQualifyingRate(0.02)).toBeCloseTo(STRESS_TEST.floorRate, 6)
  })
})

describe('calculateGdsRatio / calculateTdsRatio', () => {
  it('computes simple ratios', () => {
    expect(calculateGdsRatio(2_000, 8_000)).toBeCloseTo(0.25, 6)
    expect(calculateTdsRatio(2_000, 500, 8_000)).toBeCloseTo(0.3125, 6)
  })
})

describe('calculateMaxAffordability', () => {
  const basePersona: AffordabilityInput = {
    province: 'AB',
    grossAnnualIncome: 120_000,
    monthlyDebts: 300,
    downPayment: 60_000,
    creditTier: 'good',
    contractRate: 0.05,
    amortizationYears: 25,
  }

  it('produces a plausible, self-consistent result for a realistic persona', () => {
    const result = calculateMaxAffordability(basePersona)
    expect(result.maxPurchasePrice).toBeGreaterThan(100_000)
    expect(result.maxMortgagePrincipal).toBeGreaterThan(0)
    expect(result.gdsRatio).toBeLessThanOrEqual(0.39 + 1e-6)
    expect(result.tdsRatio).toBeLessThanOrEqual(0.44 + 1e-6)
  })

  it('is monotonic: raising monthly debts lowers max purchase price', () => {
    const low = calculateMaxAffordability(basePersona)
    const high = calculateMaxAffordability({ ...basePersona, monthlyDebts: 2_000 })
    expect(high.maxPurchasePrice).toBeLessThan(low.maxPurchasePrice)
  })

  it('is monotonic: raising the down payment raises max purchase price', () => {
    const low = calculateMaxAffordability(basePersona)
    const high = calculateMaxAffordability({ ...basePersona, downPayment: 200_000 })
    expect(high.maxPurchasePrice).toBeGreaterThan(low.maxPurchasePrice)
  })

  it('is monotonic: a higher contract rate (raising the qualifying rate) lowers max purchase price', () => {
    const low = calculateMaxAffordability(basePersona)
    const high = calculateMaxAffordability({ ...basePersona, contractRate: 0.08 })
    expect(high.maxPurchasePrice).toBeLessThan(low.maxPurchasePrice)
  })

  it('returns a zeroed result for the poor credit tier', () => {
    const result = calculateMaxAffordability({ ...basePersona, creditTier: 'poor' })
    expect(result.maxPurchasePrice).toBe(0)
    expect(result.limitingFactor).toBe('notInsurable')
  })

  it('returns a near-zero result when the buyer has no down payment at all', () => {
    const result = calculateMaxAffordability({ ...basePersona, downPayment: 0 })
    expect(result.maxPurchasePrice).toBeLessThanOrEqual(1)
  })
})

describe('estimateListingMortgagePayment', () => {
  it('includes a CMHC premium below 20% down', () => {
    const result = estimateListingMortgagePayment(600_000, 0.05)
    expect(result.cmhcPremiumIncluded).toBe(true)
    expect(result.cmhcPremiumAmount).toBeGreaterThan(0)
    expect(result.totalFinancedAmount).toBeGreaterThan(result.loanAmount)
  })

  it('excludes a CMHC premium at exactly 20% down', () => {
    const result = estimateListingMortgagePayment(600_000, 0.2)
    expect(result.cmhcPremiumIncluded).toBe(false)
    expect(result.totalFinancedAmount).toBeCloseTo(result.loanAmount, 2)
  })
})

describe('MIN_DOWN_PAYMENT_TIERS sanity', () => {
  it('has no gaps or overlaps between tier boundaries', () => {
    for (let i = 1; i < MIN_DOWN_PAYMENT_TIERS.length; i++) {
      expect(MIN_DOWN_PAYMENT_TIERS[i].upTo).toBeGreaterThan(MIN_DOWN_PAYMENT_TIERS[i - 1].upTo)
    }
    expect(MIN_DOWN_PAYMENT_TIERS[MIN_DOWN_PAYMENT_TIERS.length - 1].upTo).toBe(Infinity)
  })
})

describe('CMHC_PREMIUM_TIERS sanity', () => {
  it('is sorted ascending by LTV with no gaps or overlaps', () => {
    for (let i = 1; i < CMHC_PREMIUM_TIERS.length; i++) {
      expect(CMHC_PREMIUM_TIERS[i].maxLtv).toBeGreaterThan(CMHC_PREMIUM_TIERS[i - 1].maxLtv)
      expect(CMHC_PREMIUM_TIERS[i].rate).toBeGreaterThan(CMHC_PREMIUM_TIERS[i - 1].rate)
    }
  })
})
