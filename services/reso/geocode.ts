/**
 * Geocodes ResoProperty records that are missing lat/lng using the
 * Google Maps Geocoding API. Called by the background runner.
 *
 * Processes up to BATCH_SIZE listings per run to avoid rate limits.
 */

import { prisma } from '@/lib/prisma'

const BATCH_SIZE = 25
// Use server-side key if available, fall back to public key
const API_KEY    = process.env.GOOGLE_MAPS_SERVER_KEY ?? process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? ''

async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  if (!API_KEY) return null
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${API_KEY}`
    const res  = await fetch(url)
    const json = await res.json() as {
      status: string
      results: Array<{ geometry: { location: { lat: number; lng: number } } }>
    }
    if (json.status !== 'OK' || json.results.length === 0) return null
    return json.results[0].geometry.location
  } catch {
    return null
  }
}

export async function geocodeMissingProperties(): Promise<void> {
  if (!API_KEY) return

  const listings = (await prisma.resoProperty.findMany({
    where: { latitude: null },
    select: {
      id:              true,
      streetNumber:    true,
      streetName:      true,
      streetSuffix:    true,
      city:            true,
      stateOrProvince: true,
      postalCode:      true,
    },
    take: BATCH_SIZE * 4, // over-fetch since we filter below
  })).filter(l => l.streetNumber && l.city).slice(0, BATCH_SIZE)

  if (listings.length === 0) return

  await Promise.all(
    listings.map(async listing => {
      const parts = [
        listing.streetNumber,
        listing.streetName,
        listing.streetSuffix,
        listing.city,
        listing.stateOrProvince,
        listing.postalCode,
        'Canada',
      ].filter(Boolean)

      const address = parts.join(' ')
      const coords  = await geocodeAddress(address)
      if (!coords) return

      await prisma.resoProperty.update({
        where: { id: listing.id },
        data:  { latitude: coords.lat, longitude: coords.lng },
      }).catch(() => null)
    })
  )
}
