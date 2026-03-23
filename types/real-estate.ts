export type PropertyType = 'detached' | 'semi' | 'condo' | 'townhouse' | 'commercial' | 'land'
export type ListingType = 'sale' | 'rent' | 'lease'
export type PropertyStatus = 'active' | 'sold' | 'expired' | 'draft'

export type PropertySearchFilters = {
  location?: string
  city?: string
  minPrice?: number
  maxPrice?: number
  minBeds?: number
  maxBeds?: number
  minBaths?: number
  propertyType?: PropertyType
  listingType?: ListingType
  minSqft?: number
  maxSqft?: number
  keyword?: string
  lat?: number
  lng?: number
  radiusKm?: number
  page?: number
  pageSize?: number
  sortBy?: 'price' | 'createdAt' | 'beds'
  sortDir?: 'asc' | 'desc'
}

export type PropertySummary = {
  id: string
  title: string
  price: number
  bedrooms: number | null
  bathrooms: number | null
  sqft: number | null
  address: string
  city: string
  propertyType: string
  listingType: string
  status: string
  images: string[]
  latitude: number | null
  longitude: number | null
  listedAt: Date | null
  listAgentFullName?: string | null
  listOfficeName?: string | null
}

export type IdxPropertySummary = {
  id: string
  idxId: string
  mlsNumber: string | null
  price: number | null
  bedrooms: number | null
  bathrooms: number | null
  address: string | null
  city: string | null
  images: string[]
  status: string
}
