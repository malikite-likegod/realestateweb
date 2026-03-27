import { LRUCache } from 'lru-cache'

export interface RateLimitOptions {
  windowMs:  number
  max:       number
  keyPrefix: string
}

interface Entry { count: number; resetAt: number }

export function createRateLimit(options: RateLimitOptions) {
  const cache = new LRUCache<string, Entry>({ max: 10_000, ttl: options.windowMs })

  return {
    check(identifier: string): { allowed: boolean; retryAfterMs: number } {
      const key   = `${options.keyPrefix}:${identifier}`
      const now   = Date.now()
      const entry = cache.get(key) ?? { count: 0, resetAt: now + options.windowMs }

      if (now > entry.resetAt) {
        // Window expired — reset
        const fresh = { count: 1, resetAt: now + options.windowMs }
        cache.set(key, fresh)
        return { allowed: true, retryAfterMs: 0 }
      }

      if (entry.count >= options.max) {
        return { allowed: false, retryAfterMs: entry.resetAt - now }
      }

      cache.set(key, { count: entry.count + 1, resetAt: entry.resetAt })
      return { allowed: true, retryAfterMs: 0 }
    },
  }
}

export const publicSearchLimit = createRateLimit({ windowMs: 60_000,   max: 30, keyPrefix: 'pub'    })
export const portalLimit       = createRateLimit({ windowMs: 60_000,   max: 60, keyPrefix: 'vow'    })
export const loginLimit        = createRateLimit({ windowMs: 900_000,  max: 5,  keyPrefix: 'login'  })
export const authLimit         = createRateLimit({ windowMs: 900_000,  max: 5,  keyPrefix: 'auth'   })
export const forgotPassLimit   = createRateLimit({ windowMs: 3600_000, max: 3,  keyPrefix: 'forgot' })
