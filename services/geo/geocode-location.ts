import { unstable_cache } from 'next/cache'

/**
 * Geocodes a free-text place name (e.g. "Mississauga") to coordinates, for search features
 * that need a distance-from-location filter. Distinct from services/reso/geocode.ts, which
 * backfills missing lat/lng on synced listings — this is a one-off lookup for user-typed input.
 */

const API_KEY = process.env.GOOGLE_MAPS_SERVER_KEY ?? process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? ''

async function fetchGeocode(query: string): Promise<{ lat: number; lng: number } | null> {
  if (!API_KEY || !query) return null
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(`${query}, Canada`)}&region=ca&key=${API_KEY}`
    const res = await fetch(url)
    const json = (await res.json()) as {
      status: string
      results: Array<{ geometry: { location: { lat: number; lng: number } } }>
    }
    if (json.status !== 'OK' || json.results.length === 0) return null
    return json.results[0].geometry.location
  } catch {
    return null
  }
}

/** Geocodes a location name. Results are cached for 24h since a given place name's coordinates don't change. */
export const geocodeLocation = unstable_cache(
  async (query: string) => fetchGeocode(query.trim().toLowerCase()),
  ['geocode-location'],
  { revalidate: 60 * 60 * 24 }
)
