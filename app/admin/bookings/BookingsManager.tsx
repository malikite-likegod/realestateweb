'use client'

import { useState } from 'react'
import { formatDate } from '@/lib/utils'
import { Badge } from '@/components/ui'
import { useToast } from '@/components/ui'
import { Calendar, Clock, Mail, Phone, CheckCircle, XCircle, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

type Booking = {
  id:           string
  guestName:    string
  guestEmail:   string
  guestPhone:   string | null
  guestMessage: string | null
  startAt:      string | Date
  endAt:        string | Date
  status:       string
  adminNotes:   string | null
  schedule:     { meetingTitle: string }
}

interface Props {
  initialBookings: Booking[]
}

const statusVariant: Record<string, 'success' | 'warning' | 'danger' | 'default'> = {
  confirmed:    'success',
  cancelled:    'danger',
  rescheduled:  'warning',
}

export function BookingsManager({ initialBookings }: Props) {
  const { toast }     = useToast()
  const [bookings, setBookings] = useState<Booking[]>(initialBookings)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [updating, setUpdating] = useState<string | null>(null)

  async function updateStatus(id: string, status: string) {
    setUpdating(id)
    try {
      const res = await fetch(`/api/bookings/${id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error()
      setBookings(prev => prev.map(b => b.id === id ? { ...b, status } : b))
      toast('success', `Booking ${status}`)
    } catch {
      toast('error', 'Failed to update booking')
    } finally {
      setUpdating(null)
    }
  }

  const upcoming  = bookings.filter(b => b.status === 'confirmed' && new Date(b.startAt) >= new Date())
  const past      = bookings.filter(b => b.status === 'confirmed' && new Date(b.startAt) <  new Date())
  const cancelled = bookings.filter(b => b.status === 'cancelled')

  function BookingCard({ b }: { b: Booking }) {
    const isOpen = expanded === b.id
    const start  = new Date(b.startAt)
    const end    = new Date(b.endAt)

    return (
      <div className={cn('rounded-xl border bg-white transition-shadow', isOpen ? 'border-charcoal-300 shadow-sm' : 'border-charcoal-200')}>
        {/* Header row */}
        <div
          className="flex items-center gap-4 p-4 cursor-pointer"
          onClick={() => setExpanded(isOpen ? null : b.id)}
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="font-semibold text-charcoal-900">{b.guestName}</span>
              <Badge variant={statusVariant[b.status] ?? 'default'} className="text-xs capitalize">{b.status}</Badge>
            </div>
            <div className="flex items-center gap-3 text-xs text-charcoal-500">
              <span className="flex items-center gap-1">
                <Calendar size={12} />
                {formatDate(start, { weekday: 'short', month: 'short', day: 'numeric' })}
              </span>
              <span className="flex items-center gap-1">
                <Clock size={12} />
                {start.toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit' })}
                {' – '}
                {end.toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit' })}
              </span>
            </div>
          </div>
          <ChevronDown size={16} className={cn('text-charcoal-400 transition-transform shrink-0', isOpen && 'rotate-180')} />
        </div>

        {/* Expanded detail */}
        {isOpen && (
          <div className="border-t border-charcoal-100 p-4 flex flex-col gap-3">
            <div className="flex flex-col gap-1 text-sm">
              <p className="flex items-center gap-2 text-charcoal-700">
                <Mail size={14} className="text-charcoal-400" />{b.guestEmail}
              </p>
              {b.guestPhone && (
                <p className="flex items-center gap-2 text-charcoal-700">
                  <Phone size={14} className="text-charcoal-400" />{b.guestPhone}
                </p>
              )}
              {b.guestMessage && (
                <p className="mt-1 text-charcoal-600 text-xs bg-charcoal-50 rounded-lg px-3 py-2">{b.guestMessage}</p>
              )}
            </div>

            {b.status === 'confirmed' && (
              <div className="flex gap-2">
                <button
                  disabled={updating === b.id}
                  onClick={() => updateStatus(b.id, 'cancelled')}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                >
                  <XCircle size={13} /> Cancel Booking
                </button>
              </div>
            )}
            {b.status === 'cancelled' && (
              <button
                disabled={updating === b.id}
                onClick={() => updateStatus(b.id, 'confirmed')}
                className="self-start flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-charcoal-200 text-charcoal-600 hover:bg-charcoal-50 transition-colors disabled:opacity-50"
              >
                <CheckCircle size={13} /> Restore
              </button>
            )}
          </div>
        )}
      </div>
    )
  }

  function Section({ title, items }: { title: string; items: Booking[] }) {
    if (items.length === 0) return null
    return (
      <div>
        <h3 className="text-xs font-semibold text-charcoal-500 uppercase tracking-wide mb-2">{title}</h3>
        <div className="flex flex-col gap-2">
          {items.map(b => <BookingCard key={b.id} b={b} />)}
        </div>
      </div>
    )
  }

  if (bookings.length === 0) {
    return (
      <div className="py-16 text-center text-charcoal-400">
        <Calendar size={40} className="mx-auto mb-3 opacity-30" />
        <p className="text-sm">No bookings yet. Share your booking link to get started.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <Section title="Upcoming" items={upcoming} />
      <Section title="Past" items={past} />
      <Section title="Cancelled" items={cancelled} />
    </div>
  )
}
