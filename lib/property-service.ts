import { prisma } from '@/lib/prisma'
import { withCache } from '@/lib/cache'
import type { ResoProperty } from '@prisma/client'
import { fetchPropertyOnDemand } from '@/services/reso/sync'

export interface PropertyFilters {
  city?:         string
  minPrice?:     number
  maxPrice?:     number
  minBeds?:      number
  minBaths?:     number
  propertyType?: string
  status?:       string   // default: 'Active'
  page?:         number   // default: 1
  pageSize?:     number   // default: 20
}

export interface PropertyListResult {
  listings:   ResoProperty[]
  total:      number
  page:       number
  pageSize:   number
  totalPages: number
}

function buildCacheKey(filters: PropertyFilters): string {
  const parts = Object.entries(filters)
    .filter(([, v]) => v != null)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
  return `properties:${parts.join(':')}`
}

function buildWhere(filters: PropertyFilters) {
  const where: Record<string, unknown> = {
    standardStatus: filters.status ?? 'Active',
  }
  if (filters.city) {
    // SQLite does not support mode: 'insensitive'; PostgreSQL/MySQL require it.
    const isRelationalDB = !process.env.DATABASE_URL?.startsWith('file:')
    where.city = isRelationalDB
      ? { contains: filters.city, mode: 'insensitive' }
      : { contains: filters.city }
  }
  if (filters.minPrice != null || filters.maxPrice != null) {
    where.listPrice = {
      ...(filters.minPrice != null ? { gte: filters.minPrice } : {}),
      ...(filters.maxPrice != null ? { lte: filters.maxPrice } : {}),
    }
  }
  if (filters.minBeds  != null) where.bedroomsTotal         = { gte: filters.minBeds }
  if (filters.minBaths != null) where.bathroomsTotalInteger = { gte: filters.minBaths }
  if (filters.propertyType)     where.propertySubType       = { contains: filters.propertyType }
  return where
}

export const PropertyService = {
  async getProperties(filters: PropertyFilters = {}): Promise<PropertyListResult> {
    const page     = Math.max(1, filters.page     ?? 1)
    const pageSize = Math.min(50, Math.max(1, filters.pageSize ?? 20))
    const skip     = (page - 1) * pageSize
    const cacheKey = buildCacheKey({ ...filters, page, pageSize })

    return withCache(cacheKey, 60, async () => {
      const where = buildWhere(filters)
      const [total, listings] = await Promise.all([
        prisma.resoProperty.count({ where }),
        prisma.resoProperty.findMany({
          where,
          orderBy: { listingContractDate: 'desc' },
          skip,
          take: pageSize,
        }),
      ])
      return { listings, total, page, pageSize, totalPages: Math.ceil(total / pageSize) }
    })
  },

  async getProperty(key: string): Promise<ResoProperty | null> {
    // `key` may be a listingKey (e.g. "TRREB-1001234") or a cuid `id`.
    // Try listingKey first (the canonical identifier for RESO properties),
    // then fall back to id for backwards compatibility.
    // If still not found, attempt on-demand fetch from AMPRE so listings
    // outside the brokerage sync are available when linked directly.
    return withCache(`property:${key}`, 60, async () => {
      const byListingKey = await prisma.resoProperty.findUnique({ where: { listingKey: key } })
      if (byListingKey) return byListingKey

      const byId = await prisma.resoProperty.findUnique({ where: { id: key } })
      if (byId) return byId

      // On-demand: treat `key` as a listingKey and fetch from AMPRE
      const fetched = await fetchPropertyOnDemand(key)
      if (fetched) return prisma.resoProperty.findUnique({ where: { listingKey: key } })

      return null
    })
  },
}
