import { MAX_SEARCH_RESULTS } from './constants'
import { estimateMonthlyPaymentForPrice, priceForTargetMonthlyPayment } from './calculations'
import type { ListingSearchParams, ListingSearchResult, ListingWithEstimate } from './types'

/**
 * MOCK DATA LAYER — no live MLS search-by-city-and-radius exists yet (see lib/property-service.ts,
 * which only supports a plain substring match on `city`, and there's no geocoding/distance helper
 * anywhere in the codebase). This module fabricates deterministic, realistic-looking listings
 * instead. It's written to the same call shape a real implementation would use — a single
 * `searchListingsNearTarget(params)` entry point returning `ListingWithEstimate[]` — so swapping
 * it out later means replacing this file's internals, not the calling components.
 *
 * A real implementation would: geocode `city` to lat/lng, query ResoProperty/PropertyService
 * within `maxDistanceKm` (haversine against stored latitude/longitude), then filter by running
 * each candidate's list price through estimateMonthlyPaymentForPrice and keeping the ones inside
 * the tolerance band.
 */

interface CityBenchmark {
  displayName: string
  /** Typical resale price for a modest home in this market — anchors generated listing prices. */
  benchmarkPrice: number
  neighbourhoods: string[]
}

// Approximate representative resale benchmarks for the brokerage's Ontario market area.
// These are illustrative, not live comps — see the module-level disclaimer above.
const CITY_BENCHMARKS: Record<string, CityBenchmark> = {
  toronto: { displayName: 'Toronto', benchmarkPrice: 1_050_000, neighbourhoods: ['The Beaches', 'Leslieville', 'High Park', 'North York', 'Scarborough', 'Etobicoke'] },
  mississauga: { displayName: 'Mississauga', benchmarkPrice: 950_000, neighbourhoods: ['Port Credit', 'Streetsville', 'Erin Mills', 'Meadowvale', 'City Centre'] },
  brampton: { displayName: 'Brampton', benchmarkPrice: 850_000, neighbourhoods: ['Bram East', 'Fletcher’s Meadow', 'Springdale', 'Downtown Brampton'] },
  hamilton: { displayName: 'Hamilton', benchmarkPrice: 700_000, neighbourhoods: ['Ancaster', 'Dundas', 'Stoney Creek', 'Westdale', 'Downtown Hamilton'] },
  ottawa: { displayName: 'Ottawa', benchmarkPrice: 720_000, neighbourhoods: ['Barrhaven', 'Kanata', 'The Glebe', 'Orleans', 'Westboro'] },
  london: { displayName: 'London', benchmarkPrice: 620_000, neighbourhoods: ['Byron', 'Old North', 'Masonville', 'Westmount'] },
  kitchener: { displayName: 'Kitchener', benchmarkPrice: 680_000, neighbourhoods: ['Forest Heights', 'Doon', 'Downtown Kitchener'] },
  waterloo: { displayName: 'Waterloo', benchmarkPrice: 720_000, neighbourhoods: ['Uptown Waterloo', 'Beechwood', 'Columbia Forest'] },
  windsor: { displayName: 'Windsor', benchmarkPrice: 550_000, neighbourhoods: ['Walkerville', 'South Windsor', 'Riverside'] },
  barrie: { displayName: 'Barrie', benchmarkPrice: 680_000, neighbourhoods: ['Ardagh', 'Holly', 'South Shore', 'Innishore'] },
  oshawa: { displayName: 'Oshawa', benchmarkPrice: 700_000, neighbourhoods: ['Eastdale', 'McLaughlin', 'Northglen'] },
  vaughan: { displayName: 'Vaughan', benchmarkPrice: 1_150_000, neighbourhoods: ['Maple', 'Woodbridge', 'Thornhill'] },
  markham: { displayName: 'Markham', benchmarkPrice: 1_150_000, neighbourhoods: ['Unionville', 'Cornell', 'Cathedraltown'] },
  'richmond hill': { displayName: 'Richmond Hill', benchmarkPrice: 1_200_000, neighbourhoods: ['Oak Ridges', 'Mill Pond', 'Bayview Hill'] },
  guelph: { displayName: 'Guelph', benchmarkPrice: 730_000, neighbourhoods: ['Kortright Hills', 'Old University', 'Westminster Woods'] },
  kingston: { displayName: 'Kingston', benchmarkPrice: 600_000, neighbourhoods: ['Kingscourt', 'Woodhaven', 'Downtown Kingston'] },
  'st. catharines': { displayName: 'St. Catharines', benchmarkPrice: 600_000, neighbourhoods: ['Port Dalhousie', 'Western Hill', 'Glenridge'] },
  burlington: { displayName: 'Burlington', benchmarkPrice: 950_000, neighbourhoods: ['Aldershot', 'Roseland', 'Millcroft'] },
  oakville: { displayName: 'Oakville', benchmarkPrice: 1_250_000, neighbourhoods: ['Old Oakville', 'Glen Abbey', 'River Oaks'] },
}

const GENERIC_BENCHMARK: Omit<CityBenchmark, 'displayName'> = {
  benchmarkPrice: 650_000,
  neighbourhoods: ['Downtown', 'Uptown', 'West End', 'East End', 'North End', 'Old Town'],
}

const STREET_NAMES = ['Maple', 'Oak', 'Elm', 'King', 'Queen', 'Victoria', 'Birch', 'Cedar', 'Willow', 'Lakeview', 'Hillcrest', 'Sunset', 'Harbour', 'Pine', 'Bayview']
const STREET_TYPES = ['St', 'Ave', 'Rd', 'Dr', 'Cres', 'Blvd', 'Ct']

function titleCase(text: string): string {
  return text
    .trim()
    .split(/\s+/)
    .map(word => (word.length > 0 ? word[0].toUpperCase() + word.slice(1).toLowerCase() : word))
    .join(' ')
}

/** Deterministic PRNG (mulberry32) seeded from a string so the same inputs always produce the same mock listings. */
function seededRandom(seed: string): () => number {
  let h = 1779033703 ^ seed.length
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  return function next() {
    h = Math.imul(h ^ (h >>> 16), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    h ^= h >>> 16
    return (h >>> 0) / 4294967296
  }
}

function findCityBenchmark(cityInput: string): CityBenchmark & { recognized: boolean } {
  const normalized = cityInput.trim().toLowerCase()
  if (!normalized) {
    return { displayName: '', recognized: false, ...GENERIC_BENCHMARK }
  }
  for (const [key, benchmark] of Object.entries(CITY_BENCHMARKS)) {
    if (normalized === key || normalized.includes(key) || key.includes(normalized)) {
      return { ...benchmark, recognized: true }
    }
  }
  return { displayName: titleCase(cityInput), recognized: false, ...GENERIC_BENCHMARK }
}

/**
 * Generates a small set of mock listings whose estimated monthly mortgage payment falls inside
 * `[targetMonthlyPayment - toleranceDollars, targetMonthlyPayment + toleranceDollars]` and whose
 * distance from the given city is within `maxDistanceKm`. Results are deterministic for a given
 * set of inputs (same city/target/distance always returns the same listings).
 */
export function searchListingsNearTarget(params: ListingSearchParams): ListingSearchResult {
  const { city, maxDistanceKm, targetMonthlyPayment, toleranceDollars, assumptions } = params
  const benchmark = findCityBenchmark(city)
  const matchedCityName = benchmark.displayName || titleCase(city)

  if (targetMonthlyPayment <= 0) {
    return { listings: [], matchedCityName, cityRecognized: benchmark.recognized }
  }

  const centerPrice = priceForTargetMonthlyPayment(targetMonthlyPayment, assumptions)
  if (centerPrice <= 0) {
    return { listings: [], matchedCityName, cityRecognized: benchmark.recognized }
  }

  const rng = seededRandom(`${city.trim().toLowerCase()}|${Math.round(targetMonthlyPayment)}|${maxDistanceKm}`)
  const listings: ListingWithEstimate[] = []

  for (let i = 0; i < MAX_SEARCH_RESULTS; i++) {
    // Jitter the *target payment* (not the price) within the tolerance band, then invert back to
    // a price. This guarantees every generated listing lands inside the tolerance by construction,
    // rather than generating a price and hoping its payment happens to match.
    const paymentJitter = (rng() * 2 - 1) * toleranceDollars * 0.92
    const candidatePayment = Math.max(targetMonthlyPayment + paymentJitter, 1)
    const rawPrice = priceForTargetMonthlyPayment(candidatePayment, assumptions)
    const price = Math.max(Math.round(rawPrice / 1000) * 1000, 1000)
    const estimatedMonthlyPayment = estimateMonthlyPaymentForPrice(price, assumptions)

    const distanceKm = maxDistanceKm <= 0 ? 0 : Math.round(rng() * maxDistanceKm * 10) / 10

    const beds = price > benchmark.benchmarkPrice * 1.15 ? 4 : price > benchmark.benchmarkPrice * 0.8 ? 3 : 2
    const baths = Math.max(1, Math.min(beds, 1 + Math.round(rng() * 2)))
    const sqft = Math.round(650 + beds * 350 + rng() * 300)

    const streetNumber = 10 + Math.floor(rng() * 989)
    const streetName = STREET_NAMES[Math.floor(rng() * STREET_NAMES.length)]
    const streetType = STREET_TYPES[Math.floor(rng() * STREET_TYPES.length)]
    const neighbourhood = benchmark.neighbourhoods[Math.floor(rng() * benchmark.neighbourhoods.length)]

    listings.push({
      id: `mock-${i}-${price}`,
      address: `${streetNumber} ${streetName} ${streetType}`,
      neighbourhood,
      city: matchedCityName,
      distanceKm,
      price,
      beds,
      baths,
      sqft,
      estimatedMonthlyPayment,
    })
  }

  listings.sort((a, b) => a.distanceKm - b.distanceKm)

  return { listings, matchedCityName, cityRecognized: benchmark.recognized }
}
