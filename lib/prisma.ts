import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

function buildDatasourceUrl(): string | undefined {
  const url = process.env.DATABASE_URL
  if (!url) return undefined

  // PostgreSQL on VPS — use a sensible pool size (default is num_cpus*2+1 = 5).
  // Only append params when no query string is present to avoid duplicates.
  if (url.includes('postgres') && !url.includes('?')) {
    return `${url}?connection_limit=10&pool_timeout=20`
  }

  return url
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    datasourceUrl: buildDatasourceUrl(),
  })

// Cache the client on globalThis in all environments to prevent multiple
// engine instances spinning up on hot-reload or concurrent requests.
globalForPrisma.prisma = prisma
