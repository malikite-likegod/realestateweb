import type { SearchFilters } from './types'
import type { Prisma } from '@prisma/client'

export function buildPropertyWhere(f: SearchFilters): Prisma.PropertyWhereInput {
  const where: Prisma.PropertyWhereInput = { status: 'active' }

  if (f.city) where.city = { contains: f.city }
  if (f.location) {
    where.OR = [
      { city: { contains: f.location } },
      { address: { contains: f.location } },
      { postalCode: { contains: f.location } },
    ]
  }
  if (f.minPrice != null || f.maxPrice != null) {
    where.price = { gte: f.minPrice, lte: f.maxPrice }
  }
  if (f.minBeds != null) where.bedrooms = { gte: f.minBeds }
  if (f.minBaths != null) where.bathrooms = { gte: f.minBaths }
  if (f.propertyType) where.propertyType = f.propertyType
  if (f.listingType) where.listingType = f.listingType
  if (f.minSqft != null || f.maxSqft != null) {
    where.sqft = { gte: f.minSqft, lte: f.maxSqft }
  }
  if (f.keyword) {
    where.OR = [
      ...(where.OR ?? []),
      { title: { contains: f.keyword } },
      { description: { contains: f.keyword } },
      { address: { contains: f.keyword } },
    ]
  }

  return where
}

export function buildIdxWhere(f: SearchFilters): Prisma.IdxPropertyWhereInput {
  const where: Prisma.IdxPropertyWhereInput = { status: 'active' }

  if (f.city) where.city = { contains: f.city }
  if (f.location) {
    where.OR = [
      { city: { contains: f.location } },
      { address: { contains: f.location } },
      { postalCode: { contains: f.location } },
    ]
  }
  if (f.minPrice != null || f.maxPrice != null) {
    where.price = { gte: f.minPrice, lte: f.maxPrice }
  }
  if (f.minBeds != null) where.bedrooms = { gte: f.minBeds }
  if (f.minBaths != null) where.bathrooms = { gte: f.minBaths }
  if (f.propertyType) where.propertyType = { contains: f.propertyType }
  if (f.keyword) {
    where.OR = [
      ...(where.OR ?? []),
      { address: { contains: f.keyword } },
      { description: { contains: f.keyword } },
    ]
  }

  return where
}

export function buildOrderBy(sortBy?: string, sortDir?: string): Prisma.PropertyOrderByWithRelationInput {
  const dir = (sortDir ?? 'desc') as 'asc' | 'desc'
  switch (sortBy) {
    case 'price':     return { price: dir }
    case 'beds':      return { bedrooms: dir }
    case 'createdAt': return { createdAt: dir }
    default:          return { createdAt: 'desc' }
  }
}
