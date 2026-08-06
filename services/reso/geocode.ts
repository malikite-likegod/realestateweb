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
      error_message?: string
      results: Array<{ geometry: { location: { lat: number; lng: number } } }>
    }
    if (json.status !== 'OK' || json.results.length === 0) {
      console.warn(`[geocode] "${address}" -> ${json.status}${json.error_message ? `: ${json.error_message}` : ''}`)
      return null
    }
    return json.results[0].geometry.location
  } catch (err) {
    console.error(`[geocode] Fetch failed for "${address}":`, err)
    return null
  }
}

export async function geocodeMissingProperties(): Promise<void> {
  if (!API_KEY) {
    console.warn('[geocode] Skipped — no GOOGLE_MAPS_SERVER_KEY or NEXT_PUBLIC_GOOGLE_MAPS_KEY configured')
    return
  }

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

  let succeeded = 0
  let failed    = 0

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
      if (!coords) { failed++; return }

      await prisma.resoProperty.update({
        where: { id: listing.id },
        data:  { latitude: coords.lat, longitude: coords.lng },
      }).then(() => { succeeded++ }).catch(err => {
        failed++
        console.error(`[geocode] DB update failed for ${listing.id}:`, err)
      })
    })
  )

  console.log(`[geocode] Batch complete — ${succeeded} geocoded, ${failed} failed (of ${listings.length} attempted)`)
}
