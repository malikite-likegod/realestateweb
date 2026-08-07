/**
 * Geocodes ResoProperty records that are missing lat/lng using the
 * Google Maps Geocoding API.
 *
 * The synced table covers the whole board (300k+ listings), far more than
 * anyone will ever browse on this site, so a blind background sweep would
 * take days to reach the listings visitors actually look at. Two paths:
 *   - geocodePropertyOnDemand(): called the first time a listing's detail
 *     page is viewed, so it gets coordinates within that request.
 *   - geocodeMissingProperties(): background batch, called by the runner.
 *     Prioritizes our own brokerage's listings, then falls back to the
 *     newest board-wide listings — never grinds through the full backlog
 *     in arbitrary order.
 */

import { prisma } from '@/lib/prisma'
import { getBrokerageFilter } from '@/lib/site-settings'

const BATCH_SIZE = 25
// Use server-side key if available, fall back to public key
const API_KEY    = process.env.GOOGLE_MAPS_SERVER_KEY ?? process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? ''

export interface GeocodableAddress {
  streetNumber:    string | null
  streetName:      string | null
  streetSuffix:    string | null
  city:            string
  stateOrProvince: string
  postalCode:      string | null
}

const ADDRESS_SELECT = {
  id:              true,
  streetNumber:    true,
  streetName:      true,
  streetSuffix:    true,
  city:            true,
  stateOrProvince: true,
  postalCode:      true,
} as const

function buildAddressString(listing: GeocodableAddress): string | null {
  if (!listing.streetNumber || !listing.city) return null
  return [
    listing.streetNumber,
    listing.streetName,
    listing.streetSuffix,
    listing.city,
    listing.stateOrProvince,
    listing.postalCode,
    'Canada',
  ].filter(Boolean).join(' ')
}

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

/**
 * Geocodes a single listing on-demand (e.g. the first time its detail page
 * is viewed) and persists the result. Cheap no-op if it already has coords
 * or lacks enough address data to geocode.
 */
export async function geocodePropertyOnDemand(listing: GeocodableAddress & { id: string }): Promise<{ lat: number; lng: number } | null> {
  if (!API_KEY) return null
  const address = buildAddressString(listing)
  if (!address) return null

  const coords = await geocodeAddress(address)
  if (!coords) return null

  await prisma.resoProperty.update({
    where: { id: listing.id },
    data:  { latitude: coords.lat, longitude: coords.lng },
  }).catch(err => console.error(`[geocode] DB update failed for ${listing.id}:`, err))

  return coords
}

export async function geocodeMissingProperties(): Promise<void> {
  if (!API_KEY) {
    console.warn('[geocode] Skipped — no GOOGLE_MAPS_SERVER_KEY or NEXT_PUBLIC_GOOGLE_MAPS_KEY configured')
    return
  }

  const { officeKey, officeName } = await getBrokerageFilter().catch(() => ({ officeKey: null, officeName: null }))

  // Pass 1: our own brokerage's listings — what visitors to this site actually see.
  let listings: Array<{ id: string } & GeocodableAddress> = []
  if (officeKey || officeName) {
    const ownWhere = officeKey
      ? { listOfficeKey: officeKey }
      : { listOfficeName: { equals: officeName!, mode: 'insensitive' as const } }
    listings = (await prisma.resoProperty.findMany({
      where:  { latitude: null, ...ownWhere },
      select: ADDRESS_SELECT,
      take:   BATCH_SIZE * 4, // over-fetch since we filter below
    })).filter(l => l.streetNumber && l.city).slice(0, BATCH_SIZE)
  }

  // Pass 2: fill any remaining capacity from the board-wide backlog, newest first.
  if (listings.length < BATCH_SIZE) {
    const remaining = BATCH_SIZE - listings.length
    const rest = (await prisma.resoProperty.findMany({
      where:   { latitude: null, id: { notIn: listings.map(l => l.id) } },
      select:  ADDRESS_SELECT,
      orderBy: { listingContractDate: 'desc' },
      take:    remaining * 4,
    })).filter(l => l.streetNumber && l.city).slice(0, remaining)
    listings = [...listings, ...rest]
  }

  if (listings.length === 0) return

  let succeeded = 0
  let failed    = 0

  await Promise.all(
    listings.map(async listing => {
      const address = buildAddressString(listing)
      const coords  = address ? await geocodeAddress(address) : null
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
