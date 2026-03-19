import { LRUCache } from 'lru-cache'

// LRUCache requires V extends {} (non-nullable). We store any serialisable
// value and cast at the call-site.
type CacheValue = object | string | number | boolean

// No default TTL — each call to withCache() specifies its own TTL.
// Set ttlAutopurge: true so expired entries are cleaned up automatically.
const cache = new LRUCache<string, CacheValue>({
  max:          500,
  ttlAutopurge: true,
})

export async function withCache<T>(key: string, ttlSeconds: number, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(key) as T | undefined
  if (hit !== undefined) return hit
  const value = await fn()
  cache.set(key, value as CacheValue, { ttl: ttlSeconds * 1000 })
  return value
}

export function invalidateCache(prefix: string): void {
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key)
  }
}
