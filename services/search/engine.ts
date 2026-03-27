import { prisma } from '@/lib/prisma'
import { parseJsonSafe } from '@/lib/utils'
import { buildPropertyWhere, buildOrderBy } from './filters'
import { getBrokerageFilter } from '@/lib/site-settings'
import type { SearchFilters, SearchResult, SearchResponse } from './types'

export async function searchProperties(filters: SearchFilters, sessionId?: string, contactId?: string): Promise<SearchResponse> {
  const page = Math.max(1, filters.page ?? 1)
  const pageSize = Math.min(200, Math.max(1, filters.pageSize ?? 12))
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

  if (source === 'reso' || source === 'all') {
    const { PropertyService } = await import('@/lib/property-service')
    const { officeKey, officeName } = await getBrokerageFilter()
    const resoResult = await PropertyService.getProperties({
      city:         filters.city,
      minPrice:     filters.minPrice,
      maxPrice:     filters.maxPrice,
      minBeds:      filters.minBeds,
      minBaths:     filters.minBaths,
      propertyType: filters.propertyType,
      officeKey,
      officeName,
      page:         source === 'all' ? 1    : page,
      pageSize:     source === 'all' ? 9999 : pageSize,
    })

    const resoResults: SearchResult[] = resoResult.listings.map(p => ({
      id:          p.id,
      listingKey:  p.listingKey,
      source:      'reso' as const,
      title:       [p.streetNumber, p.streetName, p.streetSuffix, p.unitNumber ? `#${p.unitNumber}` : null].filter(Boolean).join(' ') || p.listingKey,
      price:       p.listPrice,
      bedrooms:    p.bedroomsTotal,
      bathrooms:   p.bathroomsTotalInteger,
      sqft:        p.livingArea ? Math.round(p.livingArea) : null,
      address:     [p.streetNumber, p.streetName, p.streetSuffix].filter(Boolean).join(' '),
      city:        p.city,
      propertyType: p.propertySubType,
      listingType:  (p.transactionType ?? '').toLowerCase().includes('lease') ? 'lease' : 'sale',
      images:       p.media ? (JSON.parse(p.media) as { url: string }[]).map(m => m.url) : [],
      latitude:     p.latitude,
      longitude:    p.longitude,
      listAgentFullName: p.listAgentFullName ?? null,
      listOfficeName:    p.listOfficeName ?? null,
    }))

    results = [...results, ...resoResults]
    total  += resoResult.total
  }

  // If combined: deduplicate by address, then paginate in memory
  if (source === 'all') {
    const seen = new Set<string>()
    results = results.filter(r => {
      const key = `${r.city ?? ''}:${r.address ?? ''}`.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
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
