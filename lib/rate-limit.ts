/**
 * Rate limiting — in-memory LRU, Edge-runtime compatible.
 *
 * This file is imported by middleware (Edge runtime) so it must contain
 * ZERO Node.js-only dependencies. Redis wiring lives in lib/rate-limit-redis.ts
 * which is Node.js-only and never imported by middleware.
 *
 * For a single-container deployment the in-memory limiter is sufficient.
 * To enable Redis-backed limiting (survives restarts, works across instances)
 * set REDIS_URL — the upgrade is transparent via the shared limiter instances.
 */

import { LRUCache } from 'lru-cache'

export interface RateLimitOptions {
  windowMs:  number
  max:       number
  keyPrefix: string
}

interface Entry { count: number; resetAt: number }

export interface RateLimiter {
  // Async so Redis-backed and in-memory implementations are interchangeable
  check(identifier: string): Promise<{ allowed: boolean; retryAfterMs: number }>
  // Allows the Redis module to swap in a Redis-backed check at startup
  _setCheck(fn: (id: string) => Promise<{ allowed: boolean; retryAfterMs: number }>): void
}

export function createRateLimit(options: RateLimitOptions): RateLimiter {
  const cache = new LRUCache<string, Entry>({ max: 10_000, ttl: options.windowMs })

  function checkMemory(identifier: string): { allowed: boolean; retryAfterMs: number } {
    const key   = `${options.keyPrefix}:${identifier}`
    const now   = Date.now()
    const entry = cache.get(key) ?? { count: 0, resetAt: now + options.windowMs }

    if (now > entry.resetAt) {
      cache.set(key, { count: 1, resetAt: now + options.windowMs })
      return { allowed: true, retryAfterMs: 0 }
    }
    if (entry.count >= options.max) {
      return { allowed: false, retryAfterMs: entry.resetAt - now }
    }
    cache.set(key, { count: entry.count + 1, resetAt: entry.resetAt })
    return { allowed: true, retryAfterMs: 0 }
  }

  // Default check is in-memory; can be overridden by rate-limit-redis.ts
  let _check: (id: string) => Promise<{ allowed: boolean; retryAfterMs: number }> =
    async (id) => checkMemory(id)

  return {
    check: (id) => _check(id),
    _setCheck: (fn) => { _check = fn },
  }
}

export const publicSearchLimit = createRateLimit({ windowMs: 60_000,   max: 30, keyPrefix: 'pub'    })
export const portalLimit       = createRateLimit({ windowMs: 60_000,   max: 60, keyPrefix: 'vow'    })
export const loginLimit        = createRateLimit({ windowMs: 900_000,  max: 5,  keyPrefix: 'login'  })
export const authLimit         = createRateLimit({ windowMs: 900_000,  max: 5,  keyPrefix: 'auth'   })
export const forgotPassLimit   = createRateLimit({ windowMs: 3600_000, max: 3,  keyPrefix: 'forgot' })
export const aiLimit           = createRateLimit({ windowMs: 60_000,   max: 20, keyPrefix: 'ai'     })
export const publicLeadLimit   = createRateLimit({ windowMs: 3600_000, max: 5,  keyPrefix: 'lead'   })
