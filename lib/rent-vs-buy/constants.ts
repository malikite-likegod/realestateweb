/**
 * A listing "matches" when its estimated monthly mortgage payment falls within this many
 * dollars of the user's current total monthly housing cost (rent + other lease costs).
 */
export const PAYMENT_MATCH_TOLERANCE_DOLLARS = 100

export const DEFAULT_MAX_DISTANCE_KM = 25

/**
 * Fixed assumptions for the rent-vs-buy payment estimate. This is a teaser tool, not the full
 * affordability calculator (see lib/mortgage) — no income/debt inputs, so a single representative
 * down payment % and amortization are assumed rather than solved for. The interest rate is NOT
 * hardcoded here; it's sourced the same way as the rest of the Tools section, via
 * lib/site-settings.ts#getMortgageRate (falls back to lib/mortgage's DEFAULT_ASSUMPTIONS.contractRate).
 */
export const RENT_VS_BUY_ASSUMPTIONS = {
  downPaymentPercent: 0.05,
  amortizationYears: 25,
} as const

/** Cap on how many matching listings the search returns — this is a teaser, not a full results page. */
export const MAX_SEARCH_RESULTS = 6
