export type Province = 'ON' | 'BC' | 'AB' | 'SK' | 'MB' | 'QC' | 'NB' | 'NS' | 'PE' | 'NL' | 'YT' | 'NT' | 'NU'

export type CreditTier = 'good' | 'fair' | 'poor'

export interface DownPaymentTierBreakdown {
  portion: number
  rate: number
  amount: number
}

export interface MinimumDownPaymentResult {
  minDownPayment: number
  minDownPaymentPercent: number
  isInsurable: boolean
  tierBreakdown: DownPaymentTierBreakdown[]
}

export interface CmhcPremiumResult {
  ltvPercent: number
  premiumRate: number
  premiumAmount: number
  totalMortgageWithPremium: number
}

export interface LandTransferTaxResult {
  province: Province
  provincialTax: number
  municipalTax: number
  rebates: number
  netTax: number
  notes: string[]
}

export interface AffordabilityInput {
  province: Province
  grossAnnualIncome: number
  monthlyDebts: number
  downPayment: number
  creditTier: CreditTier
  contractRate: number
  amortizationYears: number
  propertyTaxAnnual?: number
  condoFeesMonthly?: number
  heatMonthly?: number
  isFirstTimeBuyer?: boolean
  isTorontoProperty?: boolean
}

export type AffordabilityLimitingFactor = 'GDS' | 'TDS' | 'minDownPayment' | 'notInsurable'

export interface AffordabilityResult {
  maxPurchasePrice: number
  maxMortgagePrincipal: number
  limitingFactor: AffordabilityLimitingFactor
  gdsRatio: number
  tdsRatio: number
  qualifyingRate: number
  contractRatePayment: number
  qualifyingRatePayment: number
  passesStressTest: boolean
  minDownPaymentRequired: MinimumDownPaymentResult
  cmhcPremium: CmhcPremiumResult | null
  landTransferTax: LandTransferTaxResult
}

export interface StressTestCheckResult {
  passes: boolean
  qualifyingRate: number
  qualifyingRatePayment: number
  contractRatePayment: number
  suggestions: string[]
}

export interface ListingMortgageEstimate {
  price: number
  downPaymentPercent: number
  downPaymentAmount: number
  loanAmount: number
  cmhcPremiumIncluded: boolean
  cmhcPremiumAmount: number
  totalFinancedAmount: number
  monthlyPayment: number
}
