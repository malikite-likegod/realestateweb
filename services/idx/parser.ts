import type { IdxRawListing } from './types'
import type { Prisma } from '@prisma/client'

export function parseIdxListing(raw: IdxRawListing): Prisma.IdxPropertyCreateInput {
  return {
    idxId:       raw.listingID,
    mlsNumber:   raw.mlsNumber ?? null,
    status:      raw.listingStatus?.toLowerCase() ?? 'active',
    propertyType: raw.propType ?? null,
    listingType:  'sale',
    price:        raw.listingPrice ?? null,
    bedrooms:     raw.bedrooms ?? null,
    bathrooms:    raw.bathrooms ?? null,
    sqft:         raw.sqFt ?? null,
    address:      raw.address ?? null,
    city:         raw.city ?? null,
    province:     raw.stateOrProvince ?? 'ON',
    postalCode:   raw.postalCode ?? null,
    latitude:     raw.latitude ?? null,
    longitude:    raw.longitude ?? null,
    description:  raw.remarksConcat ?? null,
    images:       raw.photos ? JSON.stringify(raw.photos) : null,
    listedAt:     raw.listDate ? new Date(raw.listDate) : null,
    lastSyncedAt: new Date(),
    rawData:      JSON.stringify(raw),
  }
}
