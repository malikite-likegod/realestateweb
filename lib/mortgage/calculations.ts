import { CMHC_PREMIUM_TIERS, CONDO_FEE_INCLUSION_RATE, DEFAULT_ASSUMPTIONS, GDS_TDS_LIMITS, MIN_DOWN_PAYMENT_TIERS, STRESS_TEST } from './constants'
import { calculateLandTransferTax } from './land-transfer-tax'
import type {
  AffordabilityInput,
  AffordabilityLimitingFactor,
  AffordabilityResult,
  CmhcPremiumResult,
  DownPaymentTierBreakdown,
  ListingMortgageEstimate,
  MinimumDownPaymentResult,
  StressTestCheckResult,
} from './types'

/**
 * Canadian mortgages compound semi-annually by law, unlike US mortgages which compound
 * monthly. Using a naive `annualRate / 12` monthly rate will silently produce the wrong
 * (US-style) payment — always go through this conversion first.
 */
export function annualRateToMonthlyRate(nominalAnnualRate: number): number {
  if (nominalAnnualRate === 0) return 0
  const semiAnnualRate = nominalAnnualRate / 2
  return Math.pow(1 + semiAnnualRate, 2 / 12) - 1
}

export function calculateMortgagePayment(principal: number, annualRate: number, amortizationYears: number): number {
  if (principal <= 0) return 0
  const monthlyRate = annualRateToMonthlyRate(annualRate)
  const n = amortizationYears * 12
  if (monthlyRate === 0) return principal / n
  return (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -n))
}

export function inverseAmortizationPrincipal(monthlyPayment: number, annualRate: number, amortizationYears: number): number {
  if (monthlyPayment <= 0) return 0
  const monthlyRate = annualRateToMonthlyRate(annualRate)
  const n = amortizationYears * 12
  if (monthlyRate === 0) return monthlyPayment * n
  return (monthlyPayment * (1 - Math.pow(1 + monthlyRate, -n))) / monthlyRate
}

export function calculateGdsRatio(monthlyHousingCosts: number, grossMonthlyIncome: number): number {
  if (grossMonthlyIncome <= 0) return Infinity
  return monthlyHousingCosts / grossMonthlyIncome
}

export function calculateTdsRatio(monthlyHousingCosts: number, monthlyOtherDebts: number, grossMonthlyIncome: number): number {
  if (grossMonthlyIncome <= 0) return Infinity
  return (monthlyHousingCosts + monthlyOtherDebts) / grossMonthlyIncome
}

export function getStressTestQualifyingRate(
  contractRate: number,
  floorRate: number = STRESS_TEST.floorRate,
  buffer: number = STRESS_TEST.buffer
): number {
  return Math.max(contractRate + buffer, floorRate)
}

export function getMinimumDownPayment(purchasePrice: number): MinimumDownPaymentResult {
  const [tier1, tier2, tier3] = MIN_DOWN_PAYMENT_TIERS

  if (purchasePrice >= tier2.upTo) {
    const amount = purchasePrice * tier3.rate
    return {
      minDownPayment: amount,
      minDownPaymentPercent: tier3.rate,
      isInsurable: false,
      tierBreakdown: [{ portion: purchasePrice, rate: tier3.rate, amount }],
    }
  }

  const tierBreakdown: DownPaymentTierBreakdown[] = []
  const firstPortion = Math.min(purchasePrice, tier1.upTo)
  let total = firstPortion * tier1.rate
  tierBreakdown.push({ portion: firstPortion, rate: tier1.rate, amount: firstPortion * tier1.rate })

  if (purchasePrice > tier1.upTo) {
    const secondPortion = purchasePrice - tier1.upTo
    const secondAmount = secondPortion * tier2.rate
    total += secondAmount
    tierBreakdown.push({ portion: secondPortion, rate: tier2.rate, amount: secondAmount })
  }

  return {
    minDownPayment: total,
    minDownPaymentPercent: purchasePrice > 0 ? total / purchasePrice : tier1.rate,
    isInsurable: true,
    tierBreakdown,
  }
}

/** `ltv` is loan-to-value as a fraction (e.g. 0.90 for 10% down). Returns null above 95% LTV (not insurable). */
export function getCmhcPremiumRate(ltv: number): number | null {
  for (const tier of CMHC_PREMIUM_TIERS) {
    if (ltv <= tier.maxLtv) return tier.rate
  }
  return null
}

export function calculateCmhcPremium(loanAmount: number, downPaymentPercent: number): CmhcPremiumResult | null {
  if (downPaymentPercent >= 0.2 || loanAmount <= 0) return null
  const ltv = 1 - downPaymentPercent
  const rate = getCmhcPremiumRate(ltv)
  if (rate == null) return null
  const premiumAmount = loanAmount * rate
  return { ltvPercent: ltv, premiumRate: rate, premiumAmount, totalMortgageWithPremium: loanAmount + premiumAmount }
}

export function estimateMonthlyHousingCosts(opts: {
  propertyTaxAnnual?: number
  condoFeesMonthly?: number
  heatMonthly?: number
}): number {
  const propertyTaxMonthly = (opts.propertyTaxAnnual ?? 0) / 12
  const condoContribution = (opts.condoFeesMonthly ?? 0) * CONDO_FEE_INCLUSION_RATE
  const heat = opts.heatMonthly ?? 0
  return propertyTaxMonthly + condoContribution + heat
}

interface PriceEvaluation {
  downPaymentPercent: number
  minDown: MinimumDownPaymentResult
  cmhcPremium: CmhcPremiumResult | null
  totalLoan: number
  qualifyingPayment: number
  otherHousingCosts: number
  totalHousing: number
  gdsOk: boolean
  tdsOk: boolean
  downOk: boolean
  feasible: boolean
}

function evaluatePriceFeasibility(
  price: number,
  input: AffordabilityInput,
  qualifyingRate: number,
  maxHousingFromGds: number,
  maxTotalFromTds: number
): PriceEvaluation {
  const minDown = getMinimumDownPayment(price)
  const downPaymentPercent = price > 0 ? input.downPayment / price : 0
  const loanBeforeInsurance = Math.max(price - input.downPayment, 0)
  const cmhcPremium = calculateCmhcPremium(loanBeforeInsurance, downPaymentPercent)
  const totalLoan = cmhcPremium ? cmhcPremium.totalMortgageWithPremium : loanBeforeInsurance
  const qualifyingPayment = calculateMortgagePayment(totalLoan, qualifyingRate, input.amortizationYears)
  const otherHousingCosts = estimateMonthlyHousingCosts({
    propertyTaxAnnual: input.propertyTaxAnnual,
    condoFeesMonthly: input.condoFeesMonthly,
    heatMonthly: input.heatMonthly,
  })
  const totalHousing = qualifyingPayment + otherHousingCosts

  const gdsOk = totalHousing <= maxHousingFromGds
  const tdsOk = totalHousing + input.monthlyDebts <= maxTotalFromTds
  const downOk = downPaymentPercent >= minDown.minDownPaymentPercent - 1e-9

  return { downPaymentPercent, minDown, cmhcPremium, totalLoan, qualifyingPayment, otherHousingCosts, totalHousing, gdsOk, tdsOk, downOk, feasible: gdsOk && tdsOk && downOk }
}

function emptyAffordabilityResult(input: AffordabilityInput, qualifyingRate: number): AffordabilityResult {
  return {
    maxPurchasePrice: 0,
    maxMortgagePrincipal: 0,
    limitingFactor: 'notInsurable',
    gdsRatio: 0,
    tdsRatio: 0,
    qualifyingRate,
    contractRatePayment: 0,
    qualifyingRatePayment: 0,
    passesStressTest: false,
    minDownPaymentRequired: getMinimumDownPayment(0),
    cmhcPremium: null,
    landTransferTax: calculateLandTransferTax(0, input.province, { isFirstTimeBuyer: input.isFirstTimeBuyer, isTorontoProperty: input.isTorontoProperty }),
  }
}

/**
 * Solves for the maximum affordable purchase price. Because max price -> minimum down
 * payment tier -> loan-to-value -> CMHC premium -> effective principal is circular (each
 * depends on the others), this uses a bounded binary search over candidate purchase prices
 * rather than closed-form algebra — far less error-prone to implement and verify than
 * hand-deriving the inverse across tiered rules.
 */
export function calculateMaxAffordability(input: AffordabilityInput): AffordabilityResult {
  const qualifyingRate = getStressTestQualifyingRate(input.contractRate)
  const gdsTds = GDS_TDS_LIMITS[input.creditTier]

  if (!gdsTds) {
    return emptyAffordabilityResult(input, qualifyingRate)
  }

  const grossMonthlyIncome = input.grossAnnualIncome / 12
  const maxHousingFromGds = grossMonthlyIncome * gdsTds.gds
  const maxTotalFromTds = grossMonthlyIncome * gdsTds.tds

  const evaluate = (price: number) => evaluatePriceFeasibility(price, input, qualifyingRate, maxHousingFromGds, maxTotalFromTds)

  const lowerBound = 1
  if (!evaluate(lowerBound).feasible) {
    return emptyAffordabilityResult(input, qualifyingRate)
  }

  let lo = lowerBound
  let hi = 10_000_000
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2
    if (evaluate(mid).feasible) lo = mid
    else hi = mid
  }

  const maxPurchasePrice = lo
  const final = evaluate(maxPurchasePrice)

  const gdsRatio = grossMonthlyIncome > 0 ? final.totalHousing / grossMonthlyIncome : 0
  const tdsRatio = grossMonthlyIncome > 0 ? (final.totalHousing + input.monthlyDebts) / grossMonthlyIncome : 0

  let limitingFactor: AffordabilityLimitingFactor
  if (Math.abs(final.downPaymentPercent - final.minDown.minDownPaymentPercent) < 0.0005) {
    limitingFactor = 'minDownPayment'
  } else if (gdsTds.tds - tdsRatio < gdsTds.gds - gdsRatio) {
    limitingFactor = 'TDS'
  } else {
    limitingFactor = 'GDS'
  }

  const contractRatePayment = calculateMortgagePayment(final.totalLoan, input.contractRate, input.amortizationYears)
  const landTransferTax = calculateLandTransferTax(maxPurchasePrice, input.province, {
    isFirstTimeBuyer: input.isFirstTimeBuyer,
    isTorontoProperty: input.isTorontoProperty,
  })

  return {
    maxPurchasePrice,
    maxMortgagePrincipal: final.totalLoan,
    limitingFactor,
    gdsRatio,
    tdsRatio,
    qualifyingRate,
    contractRatePayment,
    qualifyingRatePayment: final.qualifyingPayment,
    passesStressTest: true,
    minDownPaymentRequired: final.minDown,
    cmhcPremium: final.cmhcPremium,
    landTransferTax,
  }
}

/** Checks whether a buyer qualifies (GDS/TDS + minimum down payment) at a specific target price. */
export function checkStressTestPass(input: AffordabilityInput, targetPrice: number): StressTestCheckResult {
  const qualifyingRate = getStressTestQualifyingRate(input.contractRate)
  const downPaymentPercent = targetPrice > 0 ? input.downPayment / targetPrice : 0
  const loanBeforeInsurance = Math.max(targetPrice - input.downPayment, 0)
  const cmhcPremium = calculateCmhcPremium(loanBeforeInsurance, downPaymentPercent)
  const totalLoan = cmhcPremium ? cmhcPremium.totalMortgageWithPremium : loanBeforeInsurance
  const qualifyingRatePayment = calculateMortgagePayment(totalLoan, qualifyingRate, input.amortizationYears)
  const contractRatePayment = calculateMortgagePayment(totalLoan, input.contractRate, input.amortizationYears)

  const gdsTds = GDS_TDS_LIMITS[input.creditTier]
  const suggestions: string[] = []

  if (!gdsTds) {
    return {
      passes: false,
      qualifyingRate,
      qualifyingRatePayment,
      contractRatePayment,
      suggestions: ['This credit tier is not typically eligible for standard insured or conventional financing — speak with a mortgage broker about alternative lending options.'],
    }
  }

  let passes = true
  const grossMonthlyIncome = input.grossAnnualIncome / 12
  const otherHousingCosts = estimateMonthlyHousingCosts({
    propertyTaxAnnual: input.propertyTaxAnnual,
    condoFeesMonthly: input.condoFeesMonthly,
    heatMonthly: input.heatMonthly,
  })
  const totalHousing = qualifyingRatePayment + otherHousingCosts

  const minDown = getMinimumDownPayment(targetPrice)
  if (downPaymentPercent < minDown.minDownPaymentPercent - 1e-9) {
    passes = false
    const shortfall = Math.max(minDown.minDownPayment - input.downPayment, 0)
    suggestions.push(`Increase your down payment by approximately $${Math.ceil(shortfall).toLocaleString()} to meet the minimum required for this price.`)
  }

  const gdsRatio = calculateGdsRatio(totalHousing, grossMonthlyIncome)
  if (gdsRatio > gdsTds.gds) {
    passes = false
    const neededIncome = (totalHousing / gdsTds.gds) * 12
    suggestions.push(`Your gross annual income would need to be at least approximately $${Math.ceil(neededIncome).toLocaleString()} to meet housing-cost guidelines at this price.`)
  }

  const tdsRatio = calculateTdsRatio(totalHousing, input.monthlyDebts, grossMonthlyIncome)
  if (tdsRatio > gdsTds.tds) {
    passes = false
    const neededIncome = ((totalHousing + input.monthlyDebts) / gdsTds.tds) * 12
    suggestions.push(`Your gross annual income would need to be at least approximately $${Math.ceil(neededIncome).toLocaleString()}, or your monthly debts reduced, to meet total-debt-service guidelines at this price.`)
  }

  return { passes, qualifyingRate, qualifyingRatePayment, contractRatePayment, suggestions }
}

/**
 * Simplified estimate for the customer-facing listing widget — fixed rate/amortization
 * assumptions, no income/debt inputs. Not the full affordability tool.
 */
export function estimateListingMortgagePayment(
  price: number,
  downPaymentPercent: number,
  opts?: { contractRate?: number; amortizationYears?: number }
): ListingMortgageEstimate {
  const contractRate = opts?.contractRate ?? DEFAULT_ASSUMPTIONS.contractRate
  const amortizationYears = opts?.amortizationYears ?? DEFAULT_ASSUMPTIONS.amortizationYears
  const downPaymentAmount = price * downPaymentPercent
  const loanAmount = Math.max(price - downPaymentAmount, 0)
  const cmhcPremium = calculateCmhcPremium(loanAmount, downPaymentPercent)
  const totalFinancedAmount = cmhcPremium ? cmhcPremium.totalMortgageWithPremium : loanAmount
  const monthlyPayment = calculateMortgagePayment(totalFinancedAmount, contractRate, amortizationYears)

  return {
    price,
    downPaymentPercent,
    downPaymentAmount,
    loanAmount,
    cmhcPremiumIncluded: cmhcPremium != null,
    cmhcPremiumAmount: cmhcPremium?.premiumAmount ?? 0,
    totalFinancedAmount,
    monthlyPayment,
  }
}
