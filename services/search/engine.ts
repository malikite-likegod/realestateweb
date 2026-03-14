import { prisma } from '@/lib/prisma'
import { parseJsonSafe } from '@/lib/utils'
import { buildPropertyWhere, buildIdxWhere, buildOrderBy } from './filters'
import type { SearchFilters, SearchResult, SearchResponse } from './types'

export async function searchProperties(filters: SearchFilters, sessionId?: string, contactId?: string): Promise<SearchResponse> {
  const page = Math.max(1, filters.page ?? 1)
  const pageSize = Math.min(50, Math.max(1, filters.pageSize ?? 12))
  const skip = (page - 1) * pageSize
  const source = filters.source ?? 'all'

  let results: SearchResult[] = []
  let total = 0

  if (source === 'manual' || source === 'all') {
    const where = buildPropertyWhere(filters)
    const orderBy = buildOrderBy(filters.sortBy, filters.sortDir)

    const [manualTotal, properties] = await Promise.all([
      prisma.property.count({ where }),
      prisma.property.findMany({ where, orderBy, skip: source === 'all' ? 0 : skip, take: source === 'all' ? 9999 : pageSize }),
    ])

    const manualResults: SearchResult[] = properties.map(p => ({
      id: p.id,
      source: 'manual',
      title: p.title,
      price: p.price,
      bedrooms: p.bedrooms,
      bathrooms: p.bathrooms,
      sqft: p.sqft,
      address: p.address,
      city: p.city,
      propertyType: p.propertyType,
      listingType: p.listingType,
      images: parseJsonSafe<string[]>(p.images, []),
      latitude: p.latitude,
      longitude: p.longitude,
    }))

    results = [...results, ...manualResults]
    total += manualTotal
  }

  if (source === 'idx' || source === 'all') {
    const idxWhere = buildIdxWhere(filters)

    const [idxTotal, idxListings] = await Promise.all([
      prisma.idxProperty.count({ where: idxWhere }),
      prisma.idxProperty.findMany({ where: idxWhere, skip: source === 'all' ? 0 : skip, take: source === 'all' ? 9999 : pageSize }),
    ])

    const idxResults: SearchResult[] = idxListings.map(p => ({
      id: p.id,
      source: 'idx',
      title: `${p.address ?? ''}, ${p.city ?? ''}`,
      price: p.price,
      bedrooms: p.bedrooms,
      bathrooms: p.bathrooms,
      sqft: p.sqft,
      address: p.address,
      city: p.city,
      propertyType: p.propertyType,
      listingType: p.listingType,
      images: parseJsonSafe<string[]>(p.images, []),
      latitude: p.latitude,
      longitude: p.longitude,
    }))

    results = [...results, ...idxResults]
    total += idxTotal
  }

  // If combined, sort and paginate in memory
  if (source === 'all') {
    total = results.length
    results = results.slice(skip, skip + pageSize)
  }

  // Log search
  try {
    await prisma.propertySearchLog.create({
      data: {
        sessionId: sessionId ?? null,
        contactId: contactId ?? null,
        query: JSON.stringify(filters),
        results: total,
      },
    })
  } catch { /* non-critical */ }

  return {
    results,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
    source,
  }
}
