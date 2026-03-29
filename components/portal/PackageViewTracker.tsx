'use client'
import { useEffect, useRef } from 'react'

interface Props {
  token:         string
  packageItemId: string
}

export function PackageViewTracker({ token, packageItemId }: Props) {
  const viewIdRef = useRef<string | null>(null)
  const startRef  = useRef<number>(Date.now())

  useEffect(() => {
    // Record view on mount
    fetch(`/api/portal/packages/${token}/view`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ itemId: packageItemId }),
    })
      .then(r => r.json())
      .then(json => { viewIdRef.current = json.viewId ?? null })
      .catch(() => { /* silently ignore */ })

    function sendDuration() {
      if (!viewIdRef.current) return
      const durationSec = Math.round((Date.now() - startRef.current) / 1000)
      navigator.sendBeacon(
        `/api/portal/packages/${token}/view/${viewIdRef.current}`,
        new Blob([JSON.stringify({ durationSec })], { type: 'application/json' })
      )
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'hidden') sendDuration()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('beforeunload', sendDuration)

    return () => {
      sendDuration()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('beforeunload', sendDuration)
    }
  }, [token, packageItemId])

  return null
}
