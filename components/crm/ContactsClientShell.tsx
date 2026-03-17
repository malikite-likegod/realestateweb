'use client'

/**
 * ContactsClientShell
 *
 * Client wrapper for the contacts list page. Owns checkbox selection state
 * and renders: tag/status filters, selection toolbar, contacts table.
 */

import { useState, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { Mail, X } from 'lucide-react'
import { ContactTable } from './ContactTable'
import { ContactFilters } from './ContactFilters'
import type { ContactWithTags, Tag } from '@/types'

interface Props {
  contacts: ContactWithTags[]
  tags:     Tag[]
}

export function ContactsClientShell({ contacts, tags }: Props) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())

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

  return (
    <>
      <Suspense>
        <ContactFilters tags={tags} />
      </Suspense>

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

      <ContactTable
        contacts={contacts}
        selectedIds={selected}
        onToggle={toggle}
        onToggleAll={toggleAll}
      />
    </>
  )
}
