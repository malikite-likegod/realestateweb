import { NextResponse } from 'next/server'
import { searchProperties } from '@/services/search/engine'
import type { SearchFilters } from '@/services/search/types'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)

  const filters: SearchFilters = {
    source:       (searchParams.get('source') ?? 'all') as SearchFilters['source'],
    location:     searchParams.get('location') ?? undefined,
    city:         searchParams.get('city') ?? undefined,
    keyword:      searchParams.get('keyword') ?? undefined,
    propertyType: searchParams.get('propertyType') ?? undefined,
    listingType:  searchParams.get('listingType') ?? undefined,
    minPrice:     searchParams.get('minPrice') ? Number(searchParams.get('minPrice')) : undefined,
    maxPrice:     searchParams.get('maxPrice') ? Number(searchParams.get('maxPrice')) : undefined,
    minBeds:      searchParams.get('minBeds') ? Number(searchParams.get('minBeds')) : undefined,
    minBaths:     searchParams.get('minBaths') ? Number(searchParams.get('minBaths')) : undefined,
    minSqft:      searchParams.get('minSqft') ? Number(searchParams.get('minSqft')) : undefined,
    maxSqft:      searchParams.get('maxSqft') ? Number(searchParams.get('maxSqft')) : undefined,
    lat:          searchParams.get('lat') ? Number(searchParams.get('lat')) : undefined,
    lng:          searchParams.get('lng') ? Number(searchParams.get('lng')) : undefined,
    radiusKm:     searchParams.get('radiusKm') ? Number(searchParams.get('radiusKm')) : undefined,
    page:         searchParams.get('page') ? Number(searchParams.get('page')) : 1,
    pageSize:     searchParams.get('pageSize') ? Number(searchParams.get('pageSize')) : 12,
    sortBy:       (searchParams.get('sortBy') ?? undefined) as SearchFilters['sortBy'],
    sortDir:      (searchParams.get('sortDir') ?? undefined) as SearchFilters['sortDir'],
  }

  const sessionId = request.headers.get('x-session-id') ?? undefined
  const result = await searchProperties(filters, sessionId)

  return NextResponse.json(result)
}
