import { describe, expect, it } from 'vitest'
import { TRREB_DISTRICTS, getDisplayCity, resolveDistrictSearchTerm } from './trreb-districts'

describe('TRREB_DISTRICTS', () => {
  it('has all 35 Toronto codes', () => {
    expect(TRREB_DISTRICTS.length).toBe(35)
  })

  it('every code resolves via bare-code lookup', () => {
    for (const d of TRREB_DISTRICTS) {
      expect(resolveDistrictSearchTerm(d.code)?.code).toBe(d.code)
    }
  })
})

describe('getDisplayCity', () => {
  it('translates known TRREB codes across all three prefixes', () => {
    expect(getDisplayCity('Toronto C01')).toBe('Downtown West (Toronto)')
    expect(getDisplayCity('Toronto E02')).toBe('The Beaches & East Danforth (Toronto)')
    expect(getDisplayCity('Toronto W06')).toBe('Mimico & Long Branch (Toronto)')
  })

  it('is case-insensitive on the raw city value', () => {
    expect(getDisplayCity('toronto c01')).toBe('Downtown West (Toronto)')
  })

  it('passes through non-Toronto cities unchanged', () => {
    expect(getDisplayCity('Mississauga')).toBe('Mississauga')
    expect(getDisplayCity('Vaughan')).toBe('Vaughan')
  })

  it('passes through malformed/unknown input unchanged', () => {
    expect(getDisplayCity('')).toBe('')
    expect(getDisplayCity('Toronto C99')).toBe('Toronto C99')
  })
})

describe('resolveDistrictSearchTerm', () => {
  it('resolves every variant of "Downtown West" to C01', () => {
    const variants = ['Downtown West', 'downtown west toronto', 'Downtown West (Toronto)', 'C01', 'c01', '  C01  ']
    for (const v of variants) {
      const result = resolveDistrictSearchTerm(v)
      expect(result?.code).toBe('C01')
      expect(result?.cityValue).toBe('Toronto C01')
    }
  })

  it('resolves every variant of "Mimico" to W06', () => {
    const variants = ['Mimico', 'Mimico & Long Branch', 'Mimico and Long Branch', 'Mimico & Long Branch Toronto', 'Mimico & Long Branch (Toronto)', 'W06']
    for (const v of variants) {
      const result = resolveDistrictSearchTerm(v)
      expect(result?.code).toBe('W06')
      expect(result?.cityValue).toBe('Toronto W06')
    }
  })

  it('is idempotent on an already-canonical cityValue', () => {
    expect(resolveDistrictSearchTerm('Toronto C01')?.cityValue).toBe('Toronto C01')
  })

  it('does not guess on ambiguous segments shared by multiple districts', () => {
    // "Weston" is a segment of both W03 ("Weston & Keelesdale") and W04 ("York & Weston")
    expect(resolveDistrictSearchTerm('Weston')).toBeUndefined()
    // "North York West" is both C06's full name and a segment of W05 ("Downsview & North York West")
    expect(resolveDistrictSearchTerm('North York West')).toBeUndefined()
  })

  it('returns undefined for unrelated or empty input', () => {
    expect(resolveDistrictSearchTerm('Mississauga')).toBeUndefined()
    expect(resolveDistrictSearchTerm('pizza')).toBeUndefined()
    expect(resolveDistrictSearchTerm('Toronto')).toBeUndefined()
    expect(resolveDistrictSearchTerm('')).toBeUndefined()
  })
})
