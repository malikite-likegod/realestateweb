import { PropertyService } from '@/lib/property-service'
import { getMortgageRate } from '@/lib/site-settings'
import { geocodeLocation } from '@/services/geo/geocode-location'
import { haversineDistanceKm } from '@/lib/geo'
import { MAX_SEARCH_RESULTS, RENT_VS_BUY_ASSUMPTIONS, estimateMonthlyPaymentForPrice, priceRangeForTargetPayment } from '@/lib/rent-vs-buy'
import type { RentVsBuyListing, RentVsBuySearchResponse } from '@/lib/rent-vs-buy'

export interface RentVsBuySearchParams {
  city: string
  maxDistanceKm: number
  targetMonthlyPayment: number
  toleranceDollars: number
}

function formatAddress(property: {
  streetNumber: string | null
  streetName: string | null
  streetSuffix: string | null
  streetDirPrefix: string | null
  streetDirSuffix: string | null
  unitNumber: string | null
  listingKey: string
}): string {
  const parts = [
    property.streetNumber,
    property.streetDirPrefix,
    property.streetName,
    property.streetSuffix,
    property.streetDirSuffix,
    property.unitNumber ? `#${property.unitNumber}` : null,
  ].filter(Boolean)
  return parts.length > 0 ? parts.join(' ') : property.listingKey
}

/**
 * Searches live for-sale MLS listings (ResoProperty, via PropertyService — no brokerage-only
 * filter, matching the site's own convention of showing all IDX-tier listings once a user has
 * actively searched, see app/(public)/listings/page.tsx) near `city` whose estimated monthly
 * mortgage payment is within `toleranceDollars` of `targetMonthlyPayment`.
 *
 * Distance filtering requires geocoding `city` first (there's no stored lat/lng for arbitrary
 * place names). If geocoding fails — no API key configured, or the place name doesn't resolve —
 * results fall back to city-name matching only, with `distanceAvailable: false` so the UI can
 * say so rather than showing a fabricated distance.
 */
export async function searchRentVsBuyListings(params: RentVsBuySearchParams): Promise<RentVsBuySearchResponse> {
  const { city, maxDistanceKm, targetMonthlyPayment, toleranceDollars } = params
  const trimmedCity = city.trim()

  if (!trimmedCity || targetMonthlyPayment <= 0) {
    return { listings: [], matchedCityName: trimmedCity, distanceAvailable: false }
  }

  const contractRate = await getMortgageRate()
  const assumptions = {
    downPaymentPercent: RENT_VS_BUY_ASSUMPTIONS.downPaymentPercent,
    amortizationYears: RENT_VS_BUY_ASSUMPTIONS.amortizationYears,
    contractRate,
  }

  const { minPrice, maxPrice } = priceRangeForTargetPayment(targetMonthlyPayment, toleranceDollars, assumptions)

  const [{ listings: candidates }, cityCoordinates] = await Promise.all([
    PropertyService.getProperties({
      city: trimmedCity,
      minPrice,
      maxPrice,
      listingType: 'sale',
      propertyClass: 'Residential',
      pageSize: 50,
    }),
    geocodeLocation(trimmedCity),
  ])

  const distanceAvailable = cityCoordinates != null

  const matched = candidates
    .filter(p => p.listPrice != null && p.listPrice > 0)
    .map(p => {
      const estimatedMonthlyPayment = estimateMonthlyPaymentForPrice(p.listPrice as number, assumptions)
      const distanceKm =
        distanceAvailable && p.latitude != null && p.longitude != null
          ? haversineDistanceKm(cityCoordinates!, { lat: p.latitude, lng: p.longitude })
          : null
      return { p, estimatedMonthlyPayment, distanceKm }
    })
    .filter(({ estimatedMonthlyPayment }) => Math.abs(estimatedMonthlyPayment - targetMonthlyPayment) <= toleranceDollars + 1)
    // Only exclude a listing when its distance is actually known to exceed the max —
    // most listings don't have their own lat/lng yet (board-wide sync is geocoded
    // gradually in the background), so requiring a known distance here would silently
    // drop nearly every result. Unknown-distance listings stay in, sorted last below,
    // same as when the city itself can't be geocoded at all.
    .filter(({ distanceKm }) => distanceKm == null || distanceKm <= maxDistanceKm)

  matched.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity))

  const listings: RentVsBuyListing[] = matched.slice(0, MAX_SEARCH_RESULTS).map(({ p, estimatedMonthlyPayment, distanceKm }) => ({
    id: p.id,
    listingKey: p.listingKey,
    address: formatAddress(p),
    neighbourhood: p.community ?? p.municipality ?? null,
    city: p.city,
    distanceKm: distanceKm != null ? Math.round(distanceKm * 10) / 10 : null,
    price: p.listPrice as number,
    beds: p.bedroomsTotal,
    baths: p.bathroomsTotalInteger,
    sqft: p.livingArea != null ? Math.round(p.livingArea) : null,
    estimatedMonthlyPayment,
  }))

  return { listings, matchedCityName: trimmedCity, distanceAvailable }
}
