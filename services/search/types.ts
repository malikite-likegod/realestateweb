export type SearchSource = 'manual' | 'reso' | 'all'

export type SearchFilters = {
  source?: SearchSource
  location?: string
  city?: string
  minPrice?: number
  maxPrice?: number
  minBeds?: number
  maxBeds?: number
  minBaths?: number
  propertyType?: string
  listingType?: string
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

export type SearchResult = {
  id: string
  listingKey?: string
  source: 'manual' | 'reso'
  title: string
  price: number | null
  bedrooms: number | null
  bathrooms: number | null
  sqft: number | null
  address: string | null
  city: string | null
  propertyType: string | null
  listingType: string
  images: string[]
  latitude: number | null
  longitude: number | null
}

export type SearchResponse = {
  results: SearchResult[]
  total: number
  page: number
  pageSize: number
  totalPages: number
  source: SearchSource
}
