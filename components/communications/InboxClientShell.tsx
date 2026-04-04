'use client'

import { useState, useTransition } from 'react'
import { useRouter }               from 'next/navigation'
import Link                        from 'next/link'
import { Badge }                   from '@/components/ui'
import { formatDate }              from '@/lib/utils'
import {
  Phone, MessageSquare, Mail,
  PhoneMissed, Mic, Trash2,
} from 'lucide-react'

export type InboxItem = {
  id:          string
  channel:     'sms' | 'call' | 'email'
  status:      string
  preview:     string
  contactId:   string | null
  contactName: string
  occurredAt:  Date
}

const channelColor: Record<InboxItem['channel'], string> = {
  sms:   'bg-teal-100 text-teal-600',
  call:  'bg-red-100 text-red-600',
  email: 'bg-purple-100 text-purple-600',
}

function StatusIcon({ item }: { item: InboxItem }) {
  if (item.channel === 'call' && item.status === 'voicemail') return <Mic size={14} />
  if (item.channel === 'call' && item.status === 'missed')    return <PhoneMissed size={14} />
  if (item.channel === 'sms')   return <MessageSquare size={14} />
  if (item.channel === 'call')  return <Phone size={14} />
  return <Mail size={14} />
}

export function InboxClientShell({ items }: { items: InboxItem[] }) {
  const router = useRouter()
  const [selected, setSelected]   = useState<Set<string>>(new Set())
  const [isPending, startTransition] = useTransition()

  const emailItems = items.filter(i => i.channel === 'email')
  const allEmailsSelected =
    emailItems.length > 0 && emailItems.every(i => selected.has(i.id))
  const someEmailsSelected =
    !allEmailsSelected && emailItems.some(i => selected.has(i.id))

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleAll(checked: boolean) {
    if (checked) {
      setSelected(new Set(emailItems.map(i => i.id)))
    } else {
      setSelected(new Set())
    }
  }

  function handleBulkDelete() {
    if (selected.size === 0) return
    if (!confirm(`Delete ${selected.size} email${selected.size > 1 ? 's' : ''}? This cannot be undone.`)) return

    startTransition(async () => {
      await fetch('/api/emails/bulk-delete', {
        method:  'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ ids: Array.from(selected) }),
      })
      setSelected(new Set())
      router.refresh()
    })
  }

  if (items.length === 0) {
    return (
      <p className="text-sm text-charcoal-400 text-center py-12">
        No inbound communications yet.
      </p>
    )
  }

  return (
    <>
      {/* Bulk action toolbar — email rows only */}
      {emailItems.length > 0 && (
        <div className="flex items-center gap-3 px-2 pb-3 border-b border-charcoal-100 mb-1">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-charcoal-300 text-gold-600 focus:ring-gold-500"
            checked={allEmailsSelected}
            ref={el => { if (el) el.indeterminate = someEmailsSelected }}
            onChange={e => toggleAll(e.target.checked)}
            aria-label="Select all emails"
          />
          {selected.size > 0 ? (
            <>
              <span className="text-sm text-charcoal-600">
                {selected.size} email{selected.size > 1 ? 's' : ''} selected
              </span>
              <button
                onClick={handleBulkDelete}
                disabled={isPending}
                className="flex items-center gap-1.5 text-sm text-red-600 hover:text-red-700 disabled:opacity-50"
              >
                <Trash2 size={14} />
                {isPending ? 'Deleting…' : 'Delete selected'}
              </button>
              <button
                onClick={() => setSelected(new Set())}
                className="text-sm text-charcoal-500 hover:text-charcoal-700"
              >
                Clear
              </button>
            </>
          ) : (
            <span className="text-xs text-charcoal-400">Select emails to delete</span>
          )}
        </div>
      )}

      <div className="divide-y divide-charcoal-100">
        {items.map(item => (
          <div
            key={`${item.channel}-${item.id}`}
            className={`flex items-start gap-4 py-3 hover:bg-charcoal-50 px-2 rounded-lg transition-colors ${
              selected.has(item.id) ? 'bg-red-50' : ''
            }`}
          >
            {/* Checkbox — email rows only */}
            {item.channel === 'email' ? (
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 shrink-0 rounded border-charcoal-300 text-gold-600 focus:ring-gold-500"
                checked={selected.has(item.id)}
                onChange={() => toggle(item.id)}
                aria-label={`Select email from ${item.contactName}`}
              />
            ) : (
              <div className="w-4 shrink-0" />
            )}

            {/* Channel icon */}
            <div className={`mt-0.5 h-8 w-8 shrink-0 rounded-full flex items-center justify-center ${channelColor[item.channel]}`}>
              <StatusIcon item={item} />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                {item.contactId ? (
                  <Link
                    href={`/admin/contacts/${item.contactId}`}
                    className="text-sm font-semibold text-charcoal-900 hover:text-gold-600 transition-colors"
                  >
                    {item.contactName}
                  </Link>
                ) : (
                  <span className="text-sm font-semibold text-charcoal-900">{item.contactName}</span>
                )}
                <Badge variant="default" className="capitalize text-xs">{item.channel}</Badge>
                {item.channel === 'call' && (
                  <Badge variant="default" className="capitalize text-xs">{item.status}</Badge>
                )}
              </div>
              <p className="text-xs text-charcoal-500 truncate">{item.preview}</p>
            </div>

            {/* Time + optional view link */}
            <div className="flex flex-col items-end gap-1 shrink-0">
              <span className="text-xs text-charcoal-400">
                {formatDate(item.occurredAt, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
              </span>
              {item.channel === 'email' && (
                <Link
                  href={`/admin/communications/emails/${item.id}`}
                  className="text-xs text-gold-600 hover:underline"
                >
                  View
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
