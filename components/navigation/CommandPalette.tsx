'use client'

/**
 * CommandPalette
 *
 * Cmd/Ctrl+K shortcut opens a full-screen overlay with live search across
 * contacts, deals, and listings. Results are grouped by entity type and
 * keyboard-navigable. Clicking or pressing Enter navigates to the record.
 *
 * Replaces the static SearchBar in the topbar.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Users, Briefcase, Building2, ArrowRight, X, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

type ResultGroup = {
  label:   string
  icon:    React.ReactNode
  items:   ResultItem[]
}

type ResultItem = {
  id:       string
  title:    string
  subtitle: string
  href:     string
  group:    string
}

// ─── API search helper ────────────────────────────────────────────────────────

async function fetchResults(query: string): Promise<ResultGroup[]> {
  if (query.trim().length < 2) return []

  const q = encodeURIComponent(query.trim())

  const [contacts, deals, listings] = await Promise.allSettled([
    fetch(`/api/contacts?search=${q}&pageSize=5`).then(r => r.json()),
    fetch(`/api/deals?search=${q}&pageSize=5`).then(r => r.json()),
    fetch(`/api/listings?search=${q}&pageSize=5`).then(r => r.json()),
  ])

  const groups: ResultGroup[] = []

  if (contacts.status === 'fulfilled') {
    const items = (contacts.value.data ?? []).map((c: {
      id: string; firstName: string; lastName: string; email: string | null; status: string
    }) => ({
      id:       c.id,
      title:    `${c.firstName} ${c.lastName}`,
      subtitle: c.email ?? c.status,
      href:     `/admin/contacts/${c.id}`,
      group:    'Contacts',
    }))
    if (items.length) groups.push({ label: 'Contacts', icon: <Users size={13} />, items })
  }

  if (deals.status === 'fulfilled') {
    const items = (deals.value.data ?? []).map((d: {
      id: string; title: string; stage: { name: string }
    }) => ({
      id:       d.id,
      title:    d.title,
      subtitle: d.stage?.name ?? 'Deal',
      href:     `/admin/deals/${d.id}`,
      group:    'Deals',
    }))
    if (items.length) groups.push({ label: 'Deals', icon: <Briefcase size={13} />, items })
  }

  if (listings.status === 'fulfilled') {
    const items = (listings.value.data ?? []).map((l: {
      id: string; title: string; address: string; status: string
    }) => ({
      id:       l.id,
      title:    l.title,
      subtitle: l.address ?? l.status,
      href:     `/admin/listings/${l.id}`,
      group:    'Listings',
    }))
    if (items.length) groups.push({ label: 'Listings', icon: <Building2 size={13} />, items })
  }

  return groups
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CommandPalette() {
  const [open,     setOpen]     = useState(false)
  const [query,    setQuery]    = useState('')
  const [groups,   setGroups]   = useState<ResultGroup[]>([])
  const [loading,  setLoading]  = useState(false)
  const [selected, setSelected] = useState(0)
  const router   = useRef(useRouter())
  const inputRef = useRef<HTMLInputElement>(null)
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  // All flat items for keyboard navigation
  const flatItems = groups.flatMap(g => g.items)

  // Open on Cmd+K / Ctrl+K
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(o => !o)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery('')
      setGroups([])
      setSelected(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  // Debounced search
  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current)
    if (query.trim().length < 2) { setGroups([]); return }
    setLoading(true)
    debounce.current = setTimeout(async () => {
      try {
        const result = await fetchResults(query)
        setGroups(result)
        setSelected(0)
      } finally {
        setLoading(false)
      }
    }, 200)
    return () => { if (debounce.current) clearTimeout(debounce.current) }
  }, [query])

  // Keyboard navigation within results
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelected(s => Math.min(s + 1, flatItems.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelected(s => Math.max(s - 1, 0))
    } else if (e.key === 'Enter' && flatItems[selected]) {
      navigate(flatItems[selected].href)
    }
  }

  const navigate = useCallback((href: string) => {
    router.current.push(href)
    setOpen(false)
  }, [])

  return (
    <>
      {/* Topbar trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-lg border border-charcoal-200 bg-white pl-3 pr-4 py-2 text-sm text-charcoal-400 hover:border-charcoal-300 hover:text-charcoal-600 transition-colors max-w-sm w-full"
      >
        <Search size={14} />
        <span className="flex-1 text-left text-sm">Search…</span>
        <span className="hidden lg:flex items-center gap-0.5 text-xs text-charcoal-300 font-medium bg-charcoal-50 rounded px-1.5 py-0.5 border border-charcoal-200">
          <span>⌘</span><span>K</span>
        </span>
      </button>

      {/* Palette overlay */}
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            />

            {/* Panel */}
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: -8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: -8 }}
              transition={{ duration: 0.15 }}
              className="fixed left-1/2 top-[10vh] z-50 w-full max-w-xl -translate-x-1/2 rounded-2xl bg-white shadow-2xl border border-charcoal-100 overflow-hidden"
            >
              {/* Search input */}
              <div className="flex items-center gap-3 border-b border-charcoal-100 px-4 py-3">
                {loading
                  ? <Loader2 size={16} className="text-charcoal-400 animate-spin shrink-0" />
                  : <Search  size={16} className="text-charcoal-400 shrink-0" />
                }
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Search contacts, deals, listings…"
                  className="flex-1 bg-transparent text-sm text-charcoal-900 placeholder:text-charcoal-400 focus:outline-none"
                />
                <button onClick={() => setOpen(false)} className="text-charcoal-400 hover:text-charcoal-700">
                  <X size={16} />
                </button>
              </div>

              {/* Results */}
              <div className="max-h-[60vh] overflow-y-auto py-2">
                {query.trim().length < 2 && (
                  <div className="flex flex-col gap-1 px-4 py-6 text-center">
                    <p className="text-sm text-charcoal-500">Start typing to search…</p>
                    <p className="text-xs text-charcoal-300">Contacts · Deals · Listings</p>
                  </div>
                )}

                {query.trim().length >= 2 && !loading && groups.length === 0 && (
                  <div className="px-4 py-6 text-center text-sm text-charcoal-400">
                    No results for <strong>{query}</strong>
                  </div>
                )}

                {groups.map(group => {
                  // Compute absolute index offset for keyboard selection
                  const groupOffset = flatItems.findIndex(i => i.group === group.label)
                  return (
                    <div key={group.label}>
                      {/* Group label */}
                      <div className="flex items-center gap-2 px-4 py-1.5 text-xs font-semibold text-charcoal-400 uppercase tracking-wider">
                        {group.icon}
                        {group.label}
                      </div>
                      {/* Items */}
                      {group.items.map((item, localIdx) => {
                        const absIdx = groupOffset + localIdx
                        return (
                          <button
                            key={item.id}
                            onClick={() => navigate(item.href)}
                            onMouseEnter={() => setSelected(absIdx)}
                            className={cn(
                              'flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors',
                              selected === absIdx ? 'bg-charcoal-50' : 'hover:bg-charcoal-50',
                            )}
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-charcoal-900 truncate">{item.title}</p>
                              <p className="text-xs text-charcoal-400 truncate">{item.subtitle}</p>
                            </div>
                            <ArrowRight size={13} className={cn(
                              'shrink-0 transition-opacity',
                              selected === absIdx ? 'opacity-100 text-charcoal-500' : 'opacity-0',
                            )} />
                          </button>
                        )
                      })}
                    </div>
                  )
                })}
              </div>

              {/* Footer hint */}
              {flatItems.length > 0 && (
                <div className="flex items-center gap-4 border-t border-charcoal-100 px-4 py-2 text-xs text-charcoal-300">
                  <span><kbd className="font-mono">↑↓</kbd> navigate</span>
                  <span><kbd className="font-mono">↵</kbd> open</span>
                  <span><kbd className="font-mono">Esc</kbd> close</span>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
