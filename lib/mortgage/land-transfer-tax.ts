import { LAND_TRANSFER_TAX, NOMINAL_FEE_PROVINCES } from './constants'
import type { LandTransferTaxResult, Province } from './types'

function calculateMarginalTax(price: number, brackets: readonly { upTo: number; rate: number }[]): number {
  let tax = 0
  let lowerBound = 0
  for (const bracket of brackets) {
    if (price <= lowerBound) break
    const taxableInBracket = Math.min(price, bracket.upTo) - lowerBound
    tax += taxableInBracket * bracket.rate
    lowerBound = bracket.upTo
    if (price <= bracket.upTo) break
  }
  return tax
}

/**
 * Provinces with no true land transfer tax charge only a small, near-flat title/deed
 * registration fee. These are approximations of real fee schedules, not a tax.
 */
function calculateNominalRegistrationFee(price: number, province: Province): number {
  switch (province) {
    case 'AB':
      return 50 + Math.ceil(price / 5_000) * 1
    case 'SK':
      return Math.max(price - 500, 0) * 0.003
    case 'NL':
      return price <= 500 ? 100 : 100 + Math.max(price - 500, 0) * 0.004
    case 'YT':
    case 'NT':
    case 'NU':
      return 100
    default:
      return 0
  }
}

function calculateFirstTimeBuyerRebate(
  province: Province,
  price: number,
  provincialTax: number,
  municipalTax: number,
  isFirstTimeBuyer: boolean | undefined
): number {
  if (!isFirstTimeBuyer) return 0
  const config = LAND_TRANSFER_TAX[province].firstTimeBuyer
  if (!config) return 0

  if (config.provincialRebateMax != null || config.municipalRebateMax != null) {
    const provincialRebate = Math.min(provincialTax, config.provincialRebateMax ?? 0)
    const municipalRebate = Math.min(municipalTax, config.municipalRebateMax ?? 0)
    return provincialRebate + municipalRebate
  }

  if (config.exemptionThreshold != null) {
    if (price <= config.exemptionThreshold) return provincialTax + municipalTax
    if (config.exemptionPhaseOutCeiling != null && price < config.exemptionPhaseOutCeiling) {
      const range = config.exemptionPhaseOutCeiling - config.exemptionThreshold
      const proportion = 1 - (price - config.exemptionThreshold) / range
      return (provincialTax + municipalTax) * proportion
    }
    return 0
  }

  return 0
}

/**
 * Estimates land transfer tax (or, for provinces with no such tax, a nominal registration
 * fee) for a purchase. Always returns `notes` describing simplifications/caveats for that
 * province — surface these in the UI rather than presenting the number as precise.
 */
export function calculateLandTransferTax(
  price: number,
  province: Province,
  opts: { isFirstTimeBuyer?: boolean; isTorontoProperty?: boolean } = {}
): LandTransferTaxResult {
  const config = LAND_TRANSFER_TAX[province]
  const notes = [...config.notes]

  if (NOMINAL_FEE_PROVINCES.includes(province)) {
    const fee = calculateNominalRegistrationFee(price, province)
    return { province, provincialTax: fee, municipalTax: 0, rebates: 0, netTax: fee, notes }
  }

  const provincialTax = calculateMarginalTax(price, config.provincialBrackets)
  const municipalTax =
    province === 'ON' && opts.isTorontoProperty && config.torontoMunicipalBrackets
      ? calculateMarginalTax(price, config.torontoMunicipalBrackets)
      : 0

  const rebates = calculateFirstTimeBuyerRebate(province, price, provincialTax, municipalTax, opts.isFirstTimeBuyer)
  const netTax = Math.max(provincialTax + municipalTax - rebates, 0)

  return { province, provincialTax, municipalTax, rebates, netTax, notes }
}
