/**
 * Redis-backed rate limiting upgrade — Node.js runtime only.
 *
 * Import this file from instrumentation.ts (or any server-only entry point)
 * to upgrade the shared rate limiter instances to use Redis when REDIS_URL
 * is set. If Redis is unavailable the limiters fall back to in-memory silently.
 *
 * This file must NEVER be imported by middleware.ts (Edge runtime).
 */

import 'server-only'
import Redis from 'ioredis'
import {
  publicSearchLimit, portalLimit, loginLimit, authLimit,
  forgotPassLimit, aiLimit, publicLeadLimit,
  type RateLimiter, type RateLimitOptions,
} from './rate-limit'

let client: Redis | null = null
let unavailable = false

function getClient(): Redis | null {
  if (unavailable || !process.env.REDIS_URL) return null
  if (client) return client
  try {
    client = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      connectTimeout:       2000,
      lazyConnect:          true,
      enableOfflineQueue:   false,
    })
    client.on('error', () => { unavailable = true; client = null })
    return client
  } catch {
    unavailable = true
    return null
  }
}

function makeRedisCheck(options: RateLimitOptions, memCheck: RateLimiter['check']) {
  return async (identifier: string): Promise<{ allowed: boolean; retryAfterMs: number }> => {
    const redis = getClient()
    if (!redis) return memCheck(identifier)
    const key = `rl:${options.keyPrefix}:${identifier}`
    try {
      const count = await redis.incr(key)
      if (count === 1) await redis.pexpire(key, options.windowMs)
      if (count > options.max) {
        const ttlMs = await redis.pttl(key)
        return { allowed: false, retryAfterMs: Math.max(ttlMs, 0) }
      }
      return { allowed: true, retryAfterMs: 0 }
    } catch {
      return memCheck(identifier)
    }
  }
}

// Upgrade each limiter to Redis-backed check at module load time
const limiters: Array<[RateLimiter, RateLimitOptions]> = [
  [publicSearchLimit, { windowMs: 60_000,   max: 30, keyPrefix: 'pub'    }],
  [portalLimit,       { windowMs: 60_000,   max: 60, keyPrefix: 'vow'    }],
  [loginLimit,        { windowMs: 900_000,  max: 5,  keyPrefix: 'login'  }],
  [authLimit,         { windowMs: 900_000,  max: 5,  keyPrefix: 'auth'   }],
  [forgotPassLimit,   { windowMs: 3600_000, max: 3,  keyPrefix: 'forgot' }],
  [aiLimit,           { windowMs: 60_000,   max: 20, keyPrefix: 'ai'     }],
  [publicLeadLimit,   { windowMs: 3600_000, max: 5,  keyPrefix: 'lead'   }],
]

for (const [limiter, opts] of limiters) {
  const original = limiter.check.bind(limiter)
  limiter._setCheck(makeRedisCheck(opts, original))
}
