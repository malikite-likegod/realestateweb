'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

interface BackButtonProps {
  fallbackHref?: string
  label?: string
}

export function BackButton({ fallbackHref = '/listings', label = 'Back to results' }: BackButtonProps) {
  const router = useRouter()

  return (
    <button
      onClick={() => router.back()}
      className="inline-flex items-center gap-1.5 text-sm text-charcoal-500 hover:text-charcoal-900 transition-colors"
    >
      <ArrowLeft size={15} />
      {label}
    </button>
  )
}
