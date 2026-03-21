'use client'

import { useBlurMode } from '@/components/admin/BlurModeContext'

interface BlurredFieldProps {
  children: React.ReactNode
  className?: string
}

export function BlurredField({ children, className }: BlurredFieldProps) {
  const { isBlurred } = useBlurMode()
  return (
    <span
      className={`transition-all duration-200 ${isBlurred ? 'blur-sm select-none' : ''} ${className ?? ''}`}
      title={isBlurred ? 'Blur Mode is on' : undefined}
    >
      {children}
    </span>
  )
}
