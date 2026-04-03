'use client'

/**
 * ContactsClientShell
 *
 * Client wrapper for the contacts list page. Owns checkbox selection state
 * and renders: tag/status filters, selection toolbar, contacts table.
 */

import { useState, Suspense, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Mail, X, Home, ArrowDownAZ, ArrowUpAZ, Clock } from 'lucide-react'
import { ContactTable } from './ContactTable'
import { ContactFilters } from './ContactFilters'
import type { ContactWithTags, Tag } from '@/types'

type SortOrder = 'date' | 'name_asc' | 'name_desc'

interface Props {
  contacts:            ContactWithTags[]
  tags:                Tag[]
  sendListingId?:      string
  sendListingAddress?: string
}

export function ContactsClientShell({ contacts, tags, sendListingId, sendListingAddress }: Props) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [sortOrder, setSortOrder] = useState<SortOrder>('date')

  useEffect(() => {
    setSelected(new Set())
  }, [contacts])

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else               next.add(id)
      return next
    })
  }

  function toggleAll(checked: boolean) {
    setSelected(checked ? new Set(contacts.map(c => c.id)) : new Set())
  }

  function clearSelection() {
    setSelected(new Set())
  }

  function emailSelected() {
    const ids = Array.from(selected).join(',')
    router.push(`/admin/bulk-email?contactIds=${ids}`)
  }

  const sortedContacts = useMemo(() => {
    if (sortOrder === 'date') return contacts
    return [...contacts].sort((a, b) => {
      const nameA = `${a.lastName} ${a.firstName}`.trim().toLowerCase()
      const nameB = `${b.lastName} ${b.firstName}`.trim().toLowerCase()
      return sortOrder === 'name_asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA)
    })
  }, [contacts, sortOrder])

  function cycleSort() {
    setSortOrder(prev => prev === 'date' ? 'name_asc' : prev === 'name_asc' ? 'name_desc' : 'date')
  }

  const listingLinkSuffix = sendListingId
    ? `?tab=email&sendListingId=${sendListingId}&sendListingAddress=${encodeURIComponent(sendListingAddress ?? '')}`
    : undefined

  return (
    <>
      <Suspense>
        <ContactFilters tags={tags} />
      </Suspense>

      {sendListingId && (
        <div className="flex items-center gap-2 mb-3 px-4 py-2.5 bg-gold-50 border border-gold-200 rounded-lg text-sm">
          <Home size={14} className="text-gold-600 shrink-0" />
          <span className="text-gold-800">
            Select a contact to send <span className="font-medium">{sendListingAddress ?? 'this listing'}</span>
          </span>
        </div>
      )}

      {selected.size > 0 && (
        <div className="flex items-center gap-3 mb-3 px-4 py-2 bg-indigo-50 border border-indigo-200 rounded-lg text-sm">
          <span className="font-medium text-indigo-700">{selected.size} selected</span>
          <button
            onClick={emailSelected}
            className="flex items-center gap-1.5 px-3 py-1 bg-indigo-600 text-white rounded-md text-xs font-medium hover:bg-indigo-700 transition-colors"
          >
            <Mail size={13} />
            Email Selected
          </button>
          <button
            onClick={clearSelection}
            className="flex items-center gap-1 text-xs text-charcoal-500 hover:text-charcoal-700 transition-colors"
          >
            <X size={13} /> Clear
          </button>
        </div>
      )}

      <div className="flex justify-end mb-2">
        <button
          onClick={cycleSort}
          className="flex items-center gap-1.5 text-xs font-medium text-charcoal-500 hover:text-charcoal-800 transition-colors"
        >
          {sortOrder === 'date'      && <><Clock size={13} /> Date added</>}
          {sortOrder === 'name_asc'  && <><ArrowDownAZ size={13} /> Name A–Z</>}
          {sortOrder === 'name_desc' && <><ArrowUpAZ size={13} /> Name Z–A</>}
        </button>
      </div>

      <ContactTable
        contacts={sortedContacts}
        selectedIds={selected}
        onToggle={toggle}
        onToggleAll={toggleAll}
        linkSuffix={listingLinkSuffix}
      />
    </>
  )
}
