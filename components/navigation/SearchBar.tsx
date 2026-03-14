'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SearchBarProps {
  placeholder?: string
  className?: string
  variant?: 'hero' | 'compact'
}

export function SearchBar({ placeholder = 'Search by location, MLS#, or keyword…', className, variant = 'compact' }: SearchBarProps) {
  const [query, setQuery] = useState('')
  const router = useRouter()

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) {
      router.push(`/listings?keyword=${encodeURIComponent(query.trim())}`)
    }
  }

  if (variant === 'hero') {
    return (
      <form onSubmit={handleSearch} className={cn('flex w-full max-w-2xl rounded-2xl bg-white shadow-2xl overflow-hidden', className)}>
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={placeholder}
          className="flex-1 px-6 py-4 text-charcoal-900 placeholder:text-charcoal-400 focus:outline-none text-base"
        />
        <button type="submit" className="flex items-center gap-2 bg-gold-500 hover:bg-gold-600 text-white px-6 py-4 font-medium transition-colors">
          <Search size={18} />
          <span className="hidden sm:inline">Search</span>
        </button>
      </form>
    )
  }

  return (
    <form onSubmit={handleSearch} className={cn('relative', className)}>
      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-charcoal-400" />
      <input
        type="text"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-charcoal-200 bg-white pl-9 pr-4 py-2 text-sm text-charcoal-900 placeholder:text-charcoal-400 focus:outline-none focus:ring-2 focus:ring-charcoal-900"
      />
    </form>
  )
}
