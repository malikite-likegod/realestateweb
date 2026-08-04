import type { CreditTier, Province } from './types'

/**
 * ⚠️ RATES & THRESHOLDS — CURRENT AS OF AUGUST 2026. VERIFY BEFORE PRODUCTION USE. ⚠️
 *
 * Every number in this file is a federal/provincial/municipal rule (OSFI stress test,
 * CMHC insurance premiums, GDS/TDS lending guidelines, land transfer tax brackets) that
 * changes periodically and is NOT derived from code. When these rules change, update the
 * values in THIS FILE ONLY — lib/mortgage/calculations.ts and land-transfer-tax.ts should
 * never need to change just because a rate moved.
 *
 * This is not legal or financial advice and has not been reviewed by a mortgage broker,
 * lawyer, or accountant. Several provincial figures below are deliberately simplified
 * (see inline notes) — most notably Quebec's "welcome tax" (Montreal and many other
 * municipalities set their own higher brackets) and Nova Scotia's deed transfer tax
 * (fully municipal). Verify all figures against current CMHC / OSFI / provincial sources.
 */

export const STRESS_TEST = {
  /** Federal (OSFI B-20) qualifying rate = max(contract rate + buffer, floorRate) */
  buffer: 0.02,
  floorRate: 0.0525,
} as const

export const GDS_TDS_LIMITS: Record<CreditTier, { gds: number; tds: number } | null> = {
  good: { gds: 0.39, tds: 0.44 },
  fair: { gds: 0.35, tds: 0.42 },
  // Below ~600 credit score, standard insured/conventional lending guidelines don't apply —
  // treated as a hard stop in the UI rather than a numeric ratio.
  poor: null,
}

/** Percentage of monthly condo fees counted toward GDS/TDS — standard lender convention. */
export const CONDO_FEE_INCLUSION_RATE = 0.5

export const MIN_DOWN_PAYMENT_TIERS = [
  { upTo: 500_000, rate: 0.05 },
  { upTo: 1_500_000, rate: 0.10 },
  { upTo: Infinity, rate: 0.20, insurable: false },
] as const

/** Mortgage default insurance (CMHC/Sagen/Canada Guaranty) premium by max loan-to-value. */
export const CMHC_PREMIUM_TIERS = [
  { maxLtv: 0.65, rate: 0.006 },
  { maxLtv: 0.75, rate: 0.017 },
  { maxLtv: 0.80, rate: 0.024 },
  { maxLtv: 0.85, rate: 0.028 },
  { maxLtv: 0.90, rate: 0.031 },
  { maxLtv: 0.95, rate: 0.040 },
] as const
// Note: provincial sales tax on the premium (e.g. ON 8%, QC 9.975%, SK 6% — payable upfront,
// not financeable) is a known v1 simplification and is NOT included in premiumAmount below.

export const DEFAULT_ASSUMPTIONS = {
  /** Illustrative posted rate — NOT a live rate feed. */
  contractRate: 0.0499,
  amortizationYears: 25,
  creditTier: 'good' as CreditTier,
}

interface LttBracket {
  upTo: number
  rate: number
}

export interface ProvinceLttConfig {
  provincialBrackets: LttBracket[]
  torontoMunicipalBrackets?: LttBracket[]
  firstTimeBuyer?: {
    provincialRebateMax?: number
    municipalRebateMax?: number
    /** Full exemption below this price (BC/PE style threshold exemption) */
    exemptionThreshold?: number
    /** Phase-out ceiling above the exemption threshold (BC style partial exemption) */
    exemptionPhaseOutCeiling?: number
  }
  notes: string[]
}

/**
 * Marginal tax brackets: `upTo` is the upper bound of that bracket (Infinity for the top
 * bracket). Land transfer tax is calculated marginally across brackets, like income tax.
 */
export const LAND_TRANSFER_TAX: Record<Province, ProvinceLttConfig> = {
  ON: {
    provincialBrackets: [
      { upTo: 55_000, rate: 0.005 },
      { upTo: 250_000, rate: 0.01 },
      { upTo: 400_000, rate: 0.015 },
      { upTo: 2_000_000, rate: 0.02 },
      { upTo: Infinity, rate: 0.025 },
    ],
    torontoMunicipalBrackets: [
      { upTo: 55_000, rate: 0.005 },
      { upTo: 250_000, rate: 0.01 },
      { upTo: 400_000, rate: 0.015 },
      { upTo: 2_000_000, rate: 0.02 },
      { upTo: 3_000_000, rate: 0.025 },
      { upTo: 4_000_000, rate: 0.035 },
      { upTo: 5_000_000, rate: 0.045 },
      { upTo: 10_000_000, rate: 0.055 },
      { upTo: 20_000_000, rate: 0.065 },
      { upTo: Infinity, rate: 0.075 },
    ],
    firstTimeBuyer: { provincialRebateMax: 4_000, municipalRebateMax: 4_475 },
    notes: [
      'Toronto properties pay both provincial LTT and an additional municipal (MLTT) tax.',
      'First-time buyer rebates shown are capped amounts, not full exemptions above the cap.',
    ],
  },
  BC: {
    provincialBrackets: [
      { upTo: 200_000, rate: 0.01 },
      { upTo: 2_000_000, rate: 0.02 },
      { upTo: 3_000_000, rate: 0.03 },
      { upTo: Infinity, rate: 0.05 },
    ],
    firstTimeBuyer: { exemptionThreshold: 835_000, exemptionPhaseOutCeiling: 860_000 },
    notes: [
      'The 5% top-bracket rate applies only to the portion of the residential price above $3,000,000.',
      'First-time buyer exemption phases out linearly between the threshold and ceiling shown — verify current thresholds, these change periodically.',
    ],
  },
  MB: {
    provincialBrackets: [
      { upTo: 30_000, rate: 0 },
      { upTo: 90_000, rate: 0.005 },
      { upTo: 150_000, rate: 0.01 },
      { upTo: 200_000, rate: 0.015 },
      { upTo: Infinity, rate: 0.02 },
    ],
    notes: ['Manitoba has no first-time buyer land transfer tax rebate program.'],
  },
  QC: {
    provincialBrackets: [
      { upTo: 53_200, rate: 0.005 },
      { upTo: 266_200, rate: 0.01 },
      { upTo: Infinity, rate: 0.015 },
    ],
    notes: [
      'This is the base provincial "welcome tax" (droit de mutation) formula only. Montreal and ' +
        'many other Quebec municipalities set their own higher brackets (Montreal reaches 3.5%+ on ' +
        'higher-value properties) — treat this as a lower-bound estimate for Quebec, not a precise figure.',
    ],
  },
  NS: {
    provincialBrackets: [{ upTo: Infinity, rate: 0.015 }],
    notes: [
      'Nova Scotia deed transfer tax is set entirely by the municipality (commonly 0.5%–1.5%). ' +
        'This estimate uses the Halifax Regional Municipality rate of 1.5% as a default — actual rate depends on the specific municipality.',
    ],
  },
  NB: {
    provincialBrackets: [{ upTo: Infinity, rate: 0.01 }],
    notes: ['New Brunswick real property transfer tax is ~1% of the greater of purchase price or assessed value; this estimate uses purchase price.'],
  },
  PE: {
    provincialBrackets: [{ upTo: Infinity, rate: 0.01 }],
    firstTimeBuyer: { exemptionThreshold: 200_000 },
    notes: [
      'PEI real property transfer tax is ~1% of the greater of purchase price or assessed value; this estimate uses purchase price.',
      'First-time buyers are exempt below the threshold shown — verify current threshold.',
    ],
  },
  AB: { provincialBrackets: [], notes: ['Alberta has no land transfer tax — only a small title registration fee (see closing cost estimate).'] },
  SK: { provincialBrackets: [], notes: ['Saskatchewan has no land transfer tax — only a title transfer fee (see closing cost estimate).'] },
  NL: { provincialBrackets: [], notes: ['Newfoundland & Labrador has no land transfer tax — only a nominal deed registration fee (see closing cost estimate).'] },
  YT: { provincialBrackets: [], notes: ['Yukon has no land transfer tax — only a nominal land titles registration fee (see closing cost estimate).'] },
  NT: { provincialBrackets: [], notes: ['Northwest Territories has no land transfer tax — only a nominal land titles registration fee (see closing cost estimate).'] },
  NU: { provincialBrackets: [], notes: ['Nunavut has no land transfer tax — only a nominal land titles registration fee (see closing cost estimate).'] },
}

/** Provinces with no true land transfer tax — nominal registration fee only. */
export const NOMINAL_FEE_PROVINCES: Province[] = ['AB', 'SK', 'NL', 'YT', 'NT', 'NU']

export const PROVINCE_LABELS: Record<Province, string> = {
  ON: 'Ontario',
  BC: 'British Columbia',
  AB: 'Alberta',
  SK: 'Saskatchewan',
  MB: 'Manitoba',
  QC: 'Quebec',
  NB: 'New Brunswick',
  NS: 'Nova Scotia',
  PE: 'Prince Edward Island',
  NL: 'Newfoundland and Labrador',
  YT: 'Yukon',
  NT: 'Northwest Territories',
  NU: 'Nunavut',
}
