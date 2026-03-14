export interface IdxRawListing {
  listingID: string
  mlsNumber?: string
  listingStatus?: string
  propType?: string
  listingPrice?: number
  bedrooms?: number
  bathrooms?: number
  sqFt?: number
  address?: string
  city?: string
  stateOrProvince?: string
  postalCode?: string
  latitude?: number
  longitude?: number
  remarksConcat?: string
  photos?: string[]
  listDate?: string
}

export interface IdxSyncResult {
  added: number
  updated: number
  removed: number
  errors: string[]
  durationMs: number
}
