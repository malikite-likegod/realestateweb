import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    datasourceUrl: process.env.DATABASE_URL
      ? process.env.DATABASE_URL.includes('mysql')
        // Limit connection pool on shared hosting to prevent engine panics
        ? process.env.DATABASE_URL.includes('?')
          ? process.env.DATABASE_URL
          : `${process.env.DATABASE_URL}?connection_limit=3&pool_timeout=10`
        : process.env.DATABASE_URL
      : undefined,
  })

// Cache the client on globalThis in all environments to prevent multiple
// engine instances spinning up on hot-reload or concurrent requests.
globalForPrisma.prisma = prisma
