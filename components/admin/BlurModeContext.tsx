'use client'

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useToast } from '@/components/ui'

interface BlurModeContextValue {
  isBlurred: boolean
  toggle: () => void
}

const BlurModeContext = createContext<BlurModeContextValue>({
  isBlurred: false,
  toggle: () => {},
})

export function BlurModeProvider({ children }: { children: React.ReactNode }) {
  const [isBlurred, setIsBlurred] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    fetch('/api/admin/settings')
      .then(r => r.json())
      .then(data => {
        if (data.blur_mode_enabled === 'true') setIsBlurred(true)
      })
      .catch(() => {})
  }, [])

  const toggle = useCallback(async () => {
    const prev = isBlurred
    const next = !prev
    setIsBlurred(next)
    try {
      const res = await fetch('/api/admin/settings', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ blur_mode_enabled: next ? 'true' : 'false' }),
      })
      if (!res.ok) throw new Error()
    } catch {
      setIsBlurred(prev)
      toast('error', 'Failed to save Blur Mode setting')
    }
  }, [isBlurred, toast])

  return (
    <BlurModeContext.Provider value={{ isBlurred, toggle }}>
      {children}
    </BlurModeContext.Provider>
  )
}

export function useBlurMode() {
  return useContext(BlurModeContext)
}
