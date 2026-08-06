import { describe, expect, it } from 'vitest'
import { haversineDistanceKm } from './geo'

describe('haversineDistanceKm', () => {
  it('is 0 for identical coordinates', () => {
    expect(haversineDistanceKm({ lat: 43.6532, lng: -79.3832 }, { lat: 43.6532, lng: -79.3832 })).toBeCloseTo(0, 6)
  })

  it('matches the known Toronto–Mississauga distance (~23-25 km straight-line)', () => {
    const toronto = { lat: 43.6532, lng: -79.3832 }
    const mississauga = { lat: 43.5890, lng: -79.6441 }
    const distance = haversineDistanceKm(toronto, mississauga)
    expect(distance).toBeGreaterThan(20)
    expect(distance).toBeLessThan(28)
  })

  it('is symmetric', () => {
    const a = { lat: 43.6532, lng: -79.3832 }
    const b = { lat: 45.4215, lng: -75.6972 }
    expect(haversineDistanceKm(a, b)).toBeCloseTo(haversineDistanceKm(b, a), 9)
  })
})
