/**
 * Rate limiting — Redis-backed with in-memory LRU fallback.
 *
 * When REDIS_URL is set the limiter uses Redis INCR + PEXPIRE so counters
 * survive process restarts and work correctly across multiple app instances.
 *
 * Without REDIS_URL the LRU cache is used — perfectly fine for a single
 * container deployment; counters reset on restart.
 */

import { LRUCache } from 'lru-cache'

export interface RateLimitOptions {
  windowMs:  number
  max:       number
  keyPrefix: string
}

// ── Redis client (lazy singleton) ────────────────────────────────────────────

let _redis: import('ioredis').Redis | null = null
let _redisUnavailable = false

function getRedis(): import('ioredis').Redis | null {
  if (_redisUnavailable) return null
  if (_redis) return _redis
  if (!process.env.REDIS_URL) return null

  try {
    // Dynamic require so the module is not loaded at all when REDIS_URL is absent
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Redis } = require('ioredis') as typeof import('ioredis')
    _redis = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      connectTimeout:       2000,
      lazyConnect:          true,
      enableOfflineQueue:   false,
    })
    _redis.on('error', () => {
      // Mark unavailable on connection error so we fall back to in-memory
      // without spamming logs on every request.
      _redisUnavailable = true
      _redis = null
    })
    return _redis
  } catch {
    _redisUnavailable = true
    return null
  }
}

// ── Factory ──────────────────────────────────────────────────────────────────

interface Entry { count: number; resetAt: number }

export function createRateLimit(options: RateLimitOptions) {
  // In-memory fallback (always created; used when Redis is unavailable)
  const cache = new LRUCache<string, Entry>({ max: 10_000, ttl: options.windowMs })

  async function checkRedis(identifier: string): Promise<{ allowed: boolean; retryAfterMs: number }> {
    const redis = getRedis()
    if (!redis) return checkMemory(identifier)

    const key = `rl:${options.keyPrefix}:${identifier}`
    try {
      const count = await redis.incr(key)
      if (count === 1) {
        // First hit in this window — set expiry
        await redis.pexpire(key, options.windowMs)
      }
      if (count > options.max) {
        const ttlMs = await redis.pttl(key)
        return { allowed: false, retryAfterMs: Math.max(ttlMs, 0) }
      }
      return { allowed: true, retryAfterMs: 0 }
    } catch {
      // Redis error mid-request — fall back to memory for this call
      return checkMemory(identifier)
    }
  }

  function checkMemory(identifier: string): { allowed: boolean; retryAfterMs: number } {
    const key   = `${options.keyPrefix}:${identifier}`
    const now   = Date.now()
    const entry = cache.get(key) ?? { count: 0, resetAt: now + options.windowMs }

    if (now > entry.resetAt) {
      const fresh = { count: 1, resetAt: now + options.windowMs }
      cache.set(key, fresh)
      return { allowed: true, retryAfterMs: 0 }
    }

    if (entry.count >= options.max) {
      return { allowed: false, retryAfterMs: entry.resetAt - now }
    }

    cache.set(key, { count: entry.count + 1, resetAt: entry.resetAt })
    return { allowed: true, retryAfterMs: 0 }
  }

  return {
    check: checkRedis,
  }
}

export const publicSearchLimit = createRateLimit({ windowMs: 60_000,   max: 30, keyPrefix: 'pub'    })
export const portalLimit       = createRateLimit({ windowMs: 60_000,   max: 60, keyPrefix: 'vow'    })
export const loginLimit        = createRateLimit({ windowMs: 900_000,  max: 5,  keyPrefix: 'login'  })
export const authLimit         = createRateLimit({ windowMs: 900_000,  max: 5,  keyPrefix: 'auth'   })
export const forgotPassLimit   = createRateLimit({ windowMs: 3600_000, max: 3,  keyPrefix: 'forgot' })
// AI endpoints — expensive per-call (OpenAI/Anthropic); 20 req/min per API key
export const aiLimit           = createRateLimit({ windowMs: 60_000,   max: 20, keyPrefix: 'ai'     })
// Public contact form / lead capture — 5 submissions per hour per IP
export const publicLeadLimit   = createRateLimit({ windowMs: 3600_000, max: 5,  keyPrefix: 'lead'   })
