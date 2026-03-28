'use client'

import { useRef, useCallback, useEffect } from 'react'

interface TrackedEvent {
  eventType: string
  entityId?: string
  metadata?: Record<string, unknown>
}

interface UseBehaviorTrackerOptions {
  sessionId?: string
  /** Flush interval in ms (default 8000) */
  flushInterval?: number
  /** Max queue size before auto-flush (default 15) */
  maxQueueSize?: number
}

/**
 * Batches behavior events and flushes them every `flushInterval` ms or when
 * the queue exceeds `maxQueueSize`. Also flushes on page unload.
 *
 * Usage:
 *   const { track } = useBehaviorTracker({ sessionId })
 *   track('filter_change', undefined, { city: 'Toronto' })
 */
export function useBehaviorTracker({
  sessionId,
  flushInterval = 8000,
  maxQueueSize  = 15,
}: UseBehaviorTrackerOptions = {}) {
  const queue   = useRef<TrackedEvent[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const flush = useCallback(() => {
    if (queue.current.length === 0) return
    const batch = queue.current.splice(0)

    const payload = {
      events:    batch,
      sessionId,
    }

    // Use sendBeacon on unload (non-blocking), fetch otherwise
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      navigator.sendBeacon(
        '/api/behavior',
        new Blob([JSON.stringify(payload)], { type: 'application/json' })
      )
    } else {
      fetch('/api/behavior', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true,
      }).catch(() => null)
    }
  }, [sessionId])

  const track = useCallback((
    eventType: string,
    entityId?: string,
    metadata?: Record<string, unknown>
  ) => {
    queue.current.push({ eventType, entityId, metadata })
    if (queue.current.length >= maxQueueSize) {
      flush()
    }
  }, [flush, maxQueueSize])

  // Periodic flush
  useEffect(() => {
    timerRef.current = setInterval(flush, flushInterval)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [flush, flushInterval])

  // Flush on page unload
  useEffect(() => {
    const onUnload = () => flush()
    window.addEventListener('pagehide', onUnload)
    window.addEventListener('beforeunload', onUnload)
    return () => {
      window.removeEventListener('pagehide', onUnload)
      window.removeEventListener('beforeunload', onUnload)
    }
  }, [flush])

  return { track, flush }
}
