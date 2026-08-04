import { describe, expect, it } from 'vitest'
import { calculateLandTransferTax } from './land-transfer-tax'
import type { Province } from './types'

describe('calculateLandTransferTax — Ontario', () => {
  it('matches the known marginal-bracket result for $300,000 (non-Toronto)', () => {
    const result = calculateLandTransferTax(300_000, 'ON')
    // 0.5% * 55k + 1% * 195k + 1.5% * 50k = 275 + 1950 + 750 = 2975
    expect(result.provincialTax).toBeCloseTo(2_975, 0)
    expect(result.municipalTax).toBe(0)
    expect(result.netTax).toBeCloseTo(2_975, 0)
  })

  it('adds the Toronto municipal LTT on top of the provincial tax', () => {
    const result = calculateLandTransferTax(300_000, 'ON', { isTorontoProperty: true })
    expect(result.municipalTax).toBeGreaterThan(0)
    expect(result.netTax).toBeCloseTo(result.provincialTax + result.municipalTax, 2)
  })

  it('applies both provincial and municipal first-time-buyer rebates in Toronto', () => {
    const withoutRebate = calculateLandTransferTax(300_000, 'ON', { isTorontoProperty: true })
    const withRebate = calculateLandTransferTax(300_000, 'ON', { isTorontoProperty: true, isFirstTimeBuyer: true })
    expect(withRebate.rebates).toBeGreaterThan(0)
    expect(withRebate.netTax).toBeLessThan(withoutRebate.netTax)
  })
})

describe('calculateLandTransferTax — BC', () => {
  it('fully exempts a first-time buyer below the exemption threshold', () => {
    const result = calculateLandTransferTax(500_000, 'BC', { isFirstTimeBuyer: true })
    expect(result.netTax).toBeCloseTo(0, 2)
  })

  it('charges full tax for a non-first-time-buyer at the same price', () => {
    const result = calculateLandTransferTax(500_000, 'BC')
    expect(result.netTax).toBeGreaterThan(0)
  })
})

describe('calculateLandTransferTax — every province returns a coherent result', () => {
  const provinces: Province[] = ['ON', 'BC', 'AB', 'SK', 'MB', 'QC', 'NB', 'NS', 'PE', 'NL', 'YT', 'NT', 'NU']

  for (const province of provinces) {
    it(`${province}: net tax is non-negative and notes are present`, () => {
      const result = calculateLandTransferTax(650_000, province)
      expect(result.netTax).toBeGreaterThanOrEqual(0)
      expect(result.notes.length).toBeGreaterThan(0)
    })
  }

  it('provinces with no land transfer tax charge only a nominal fee well under a real LTT (< 1% of price)', () => {
    const nominalFeeProvinces: Province[] = ['AB', 'SK', 'NL', 'YT', 'NT', 'NU']
    for (const province of nominalFeeProvinces) {
      const result = calculateLandTransferTax(650_000, province)
      expect(result.netTax).toBeLessThan(650_000 * 0.01)
    }
  })
})
