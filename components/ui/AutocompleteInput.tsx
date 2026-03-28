'use client'

import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'

interface AutocompleteInputProps {
  options: string[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

export function AutocompleteInput({ options, value, onChange, placeholder, className }: AutocompleteInputProps) {
  const [query, setQuery]   = useState(value)
  const [open, setOpen]     = useState(false)
  const containerRef        = useRef<HTMLDivElement>(null)

  // Keep input text in sync if value is cleared externally
  useEffect(() => { setQuery(value) }, [value])

  const filtered = query.trim()
    ? options.filter(o => o.toLowerCase().includes(query.toLowerCase()))
    : options

  function select(option: string) {
    setQuery(option)
    onChange(option)
    setOpen(false)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value)
    onChange(e.target.value)
    setOpen(true)
  }

  function handleClear() {
    setQuery('')
    onChange('')
    setOpen(false)
  }

  // Close on outside click
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [])

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={handleChange}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="w-full rounded-lg border border-charcoal-200 bg-white px-3 py-2.5 pr-7 text-sm text-charcoal-900 placeholder:text-charcoal-400 focus:outline-none focus:ring-2 focus:ring-charcoal-900 focus:border-transparent"
        />
        {query && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-charcoal-400 hover:text-charcoal-700 text-base leading-none"
          >
            ×
          </button>
        )}
      </div>

      {open && filtered.length > 0 && (
        <ul className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-charcoal-200 bg-white shadow-lg text-sm">
          {filtered.map(option => (
            <li
              key={option}
              onMouseDown={() => select(option)}
              className={cn(
                'cursor-pointer px-3 py-2 hover:bg-charcoal-50',
                option === value && 'bg-charcoal-100 font-medium',
              )}
            >
              {option}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
