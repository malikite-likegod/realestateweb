'use client'

import { useEffect, useRef, useState, useCallback, type ReactNode } from 'react'
import { Bell, MessageSquare, Mail, UserPlus, BellOff, X, Home } from 'lucide-react'

type NotificationType = 'inbound_sms' | 'inbound_email' | 'new_contact' | 'sms_unsubscribe' | 'email_unsubscribe' | 'listing_alert'

interface Notification {
  id:        string
  type:      NotificationType
  title:     string
  body?:     string | null
  contactId: string | null
  isRead:    boolean
  createdAt: string
  contact?:  { firstName: string; lastName: string } | null
}

const TYPE_ICON: Record<NotificationType, ReactNode> = {
  inbound_sms:       <MessageSquare size={15} className="text-blue-500" />,
  inbound_email:     <Mail          size={15} className="text-indigo-500" />,
  new_contact:       <UserPlus      size={15} className="text-green-500" />,
  sms_unsubscribe:   <BellOff       size={15} className="text-amber-500" />,
  email_unsubscribe: <BellOff       size={15} className="text-amber-500" />,
  listing_alert:     <Home          size={15} className="text-gold-500" />,
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60_000)
  if (mins < 1)  return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications')
      if (!res.ok) return
      const json = await res.json()
      setNotifications(json.data ?? [])
    } catch {
      // ignore fetch errors
    }
  }, [])

  // Fetch on mount and poll every 30s
  useEffect(() => {
    fetchNotifications()
    const id = setInterval(fetchNotifications, 30_000)
    return () => clearInterval(id)
  }, [fetchNotifications])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  function handleOpen() {
    if (!open && notifications.length > 0) {
      // Optimistically clear badge, then persist on server
      const toMark = notifications.map(n => n.id)
      setNotifications([])
      fetch('/api/notifications', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ ids: toMark }),
      }).catch(() => {})
    }
    setOpen(o => !o)
  }

  const hasUnread = notifications.length > 0

  return (
    <div ref={ref} className="relative">
      <button
        onClick={handleOpen}
        className="relative p-2 text-charcoal-500 hover:text-charcoal-900 transition-colors rounded-lg hover:bg-charcoal-100"
        aria-label="Notifications"
      >
        <Bell size={20} />
        {hasUnread && (
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-xl border border-charcoal-200 bg-white shadow-lg z-50">
          <div className="flex items-center justify-between border-b border-charcoal-100 px-4 py-3">
            <span className="text-sm font-semibold text-charcoal-900">Notifications</span>
            <button onClick={() => setOpen(false)} className="text-charcoal-400 hover:text-charcoal-700 transition-colors">
              <X size={16} />
            </button>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-charcoal-400">
                <Bell size={28} strokeWidth={1.5} />
                <p className="text-sm">All caught up</p>
              </div>
            ) : (
              notifications.map(n => {
                const inner = (
                  <>
                    <div className="mt-0.5 flex-shrink-0">{TYPE_ICON[n.type] ?? <Bell size={15} className="text-charcoal-400" />}</div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-charcoal-900 leading-snug">{n.title}</p>
                      {n.body && (
                        <p className="mt-0.5 text-xs text-charcoal-500 line-clamp-2">{n.body}</p>
                      )}
                      <p className="mt-1 text-xs text-charcoal-400">{timeAgo(n.createdAt)}</p>
                    </div>
                  </>
                )
                return n.type === 'listing_alert' && n.contactId ? (
                  <a key={n.id} href={`/admin/contacts/${n.contactId}`} className="flex gap-3 border-b border-charcoal-50 px-4 py-3 last:border-0 hover:bg-charcoal-50 transition-colors">
                    {inner}
                  </a>
                ) : (
                  <div key={n.id} className="flex gap-3 border-b border-charcoal-50 px-4 py-3 last:border-0 hover:bg-charcoal-50 transition-colors">
                    {inner}
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
