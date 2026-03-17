'use client'

/**
 * Public booking page — /book/[slug]
 * A Calendly-style experience: pick a date, pick a time slot, fill in details, confirm.
 */

import { use, useState, useEffect, useCallback, useRef } from 'react'
import { Button, Input } from '@/components/ui'
import { ChevronLeft, ChevronRight, Clock, Calendar, CheckCircle, User, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import Image from 'next/image'

// ── Types ─────────────────────────────────────────────────────────────────────

type ScheduleInfo = {
  agentName:          string
  agentTitle:         string | null
  agentPhoto:         string | null
  meetingTitle:       string
  meetingDescription: string | null
  meetingDurationMin: number
  timezone:           string
  advanceDays:        number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function addDays(d: Date, n: number) {
  const r = new Date(d); r.setDate(r.getDate() + n); return r
}
function toYMD(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1) }
function getDaysInMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate() }

function formatSlot(iso: string) {
  const d = new Date(iso)
  return d.toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit' })
}

function formatConfirmed(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString('en-CA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function BookPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)

  const today   = new Date(); today.setHours(0, 0, 0, 0)
  const [step, setStep]             = useState<'calendar' | 'form' | 'confirmed'>('calendar')
  const [viewMonth, setViewMonth]   = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
  const [slots, setSlots]           = useState<string[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [schedule, setSchedule]     = useState<ScheduleInfo | null>(null)
  const [notFound, setNotFound]     = useState(false)

  const [form, setForm] = useState({ name: '', email: '', phone: '', message: '' })
  const [submitting, setSubmitting] = useState(false)
  const [confirmedSlot, setConfirmedSlot] = useState<string | null>(null)

  // Track whether we've loaded schedule info so we don't put `schedule` in callback deps
  const scheduleLoaded = useRef(false)

  // Stable fetch function — uses refs to avoid stale-closure re-render loops
  const fetchSlots = useCallback(async (date: string) => {
    setLoadingSlots(true)
    setSlots([])
    try {
      const res  = await fetch(`/api/book/${slug}?date=${date}`)
      if (res.status === 404) { setNotFound(true); return }
      const json = await res.json()
      if (json.data) {
        setSlots(json.data.slots ?? [])
        if (!scheduleLoaded.current && json.data.schedule) {
          scheduleLoaded.current = true
          setSchedule(json.data.schedule)
        }
      }
    } catch {
      // network error — leave empty
    } finally {
      setLoadingSlots(false)
    }
  }, [slug]) // slug is stable; removed `schedule` to prevent re-fetch loop

  // Fetch slots whenever the selected date changes
  useEffect(() => {
    if (selectedDate) fetchSlots(selectedDate)
  }, [selectedDate, fetchSlots])

  // Fetch schedule info once on mount using today's date
  useEffect(() => { fetchSlots(toYMD(today)) }, [fetchSlots]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedSlot || !form.name || !form.email) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/book/${slug}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ guestName: form.name, guestEmail: form.email, guestPhone: form.phone, guestMessage: form.message, startAt: selectedSlot }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        alert(json.error ?? 'Failed to book. Please try a different slot.')
        setStep('calendar')
        setSelectedSlot(null)
        return
      }
      setConfirmedSlot(selectedSlot)
      setStep('confirmed')
    } catch {
      alert('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Calendar grid ────────────────────────────────────────────────────────────

  const maxDate = schedule ? addDays(today, schedule.advanceDays) : addDays(today, 30)
  const prevMonthStart = new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1)
  const nextMonthStart = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1)
  const canGoPrev = prevMonthStart >= startOfMonth(today)
  const canGoNext = nextMonthStart <= maxDate

  const daysInMonth     = getDaysInMonth(viewMonth)
  const firstDayOfWeek  = viewMonth.getDay()
  const days: (Date | null)[] = [
    ...Array<null>(firstDayOfWeek).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(viewMonth.getFullYear(), viewMonth.getMonth(), i + 1)),
  ]

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-charcoal-50">
        <div className="text-center">
          <p className="text-2xl font-serif font-bold text-charcoal-900 mb-2">Booking page not found</p>
          <p className="text-charcoal-500">This booking link may be inactive or doesn&apos;t exist.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-charcoal-50 flex items-start justify-center py-12 px-4">
      <div className="w-full max-w-3xl">

        {/* Header */}
        <div className="mb-6 flex items-center gap-4">
          {schedule?.agentPhoto && (
            <div className="relative h-16 w-16 rounded-full overflow-hidden shrink-0">
              <Image src={schedule.agentPhoto} alt={schedule.agentName ?? ''} fill className="object-cover" sizes="64px" />
            </div>
          )}
          {!schedule?.agentPhoto && (
            <div className="h-16 w-16 rounded-full bg-charcoal-200 flex items-center justify-center shrink-0">
              <User size={28} className="text-charcoal-400" />
            </div>
          )}
          <div>
            <h1 className="text-2xl font-serif font-bold text-charcoal-900">{schedule?.meetingTitle ?? 'Book a Meeting'}</h1>
            {schedule && (
              <p className="text-charcoal-500 text-sm mt-0.5">
                with {schedule.agentName}{schedule.agentTitle ? ` · ${schedule.agentTitle}` : ''}
              </p>
            )}
            {schedule?.meetingDescription && (
              <p className="text-charcoal-600 text-sm mt-1">{schedule.meetingDescription}</p>
            )}
            {schedule && (
              <p className="flex items-center gap-1 text-xs text-charcoal-400 mt-1">
                <Clock size={12} /> {schedule.meetingDurationMin} min meeting
              </p>
            )}
          </div>
        </div>

        {/* ── Step: confirmed ──────────────────────────────────────────────────── */}
        {step === 'confirmed' && confirmedSlot && (
          <div className="rounded-2xl border border-charcoal-200 bg-white p-8 text-center">
            <CheckCircle size={48} className="mx-auto mb-4 text-green-500" />
            <h2 className="text-xl font-serif font-bold text-charcoal-900 mb-2">You&apos;re booked!</h2>
            <p className="text-charcoal-600 mb-1">{formatConfirmed(confirmedSlot)}</p>
            <p className="text-charcoal-500 text-sm">A confirmation has been sent to <strong>{form.email}</strong>.</p>
          </div>
        )}

        {/* ── Step: calendar + slots ──────────────────────────────────────────── */}
        {step === 'calendar' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* Left: calendar */}
            <div className="rounded-2xl border border-charcoal-200 bg-white p-5">
              {/* Month navigation */}
              <div className="flex items-center justify-between mb-4">
                <button
                  disabled={!canGoPrev}
                  onClick={() => setViewMonth(prevMonthStart)}
                  className="p-1 rounded-lg hover:bg-charcoal-100 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronLeft size={18} />
                </button>
                <span className="text-sm font-semibold text-charcoal-900">
                  {viewMonth.toLocaleString('en-CA', { month: 'long', year: 'numeric' })}
                </span>
                <button
                  disabled={!canGoNext}
                  onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))}
                  className="p-1 rounded-lg hover:bg-charcoal-100 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronRight size={18} />
                </button>
              </div>

              {/* Day-of-week headers */}
              <div className="grid grid-cols-7 mb-1">
                {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
                  <div key={d} className="text-center text-xs font-semibold text-charcoal-400 py-1">{d}</div>
                ))}
              </div>

              {/* Day cells */}
              <div className="grid grid-cols-7 gap-0.5">
                {days.map((day, i) => {
                  if (!day) return <div key={`empty-${i}`} />
                  const ymd       = toYMD(day)
                  const isPast    = day < today
                  const isTooFar  = day > maxDate
                  const isDisabled = isPast || isTooFar
                  const isSelected = ymd === selectedDate
                  const isToday    = ymd === toYMD(today)
                  return (
                    <button
                      key={ymd}
                      disabled={isDisabled}
                      onClick={() => setSelectedDate(ymd)}
                      className={cn(
                        'aspect-square flex items-center justify-center rounded-lg text-sm font-medium transition-colors',
                        isDisabled  && 'text-charcoal-300 cursor-not-allowed',
                        !isDisabled && !isSelected && 'hover:bg-charcoal-100 text-charcoal-700',
                        isSelected  && 'bg-charcoal-900 text-white',
                        isToday && !isSelected && 'ring-2 ring-charcoal-400',
                      )}
                    >
                      {day.getDate()}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Right: time slots */}
            <div className="rounded-2xl border border-charcoal-200 bg-white p-5">
              {!selectedDate ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-charcoal-400 py-8">
                  <Calendar size={32} className="mb-2 opacity-40" />
                  <p className="text-sm">Select a date to see available times</p>
                </div>
              ) : loadingSlots ? (
                <div className="h-full flex items-center justify-center py-8">
                  <Loader2 size={24} className="animate-spin text-charcoal-400" />
                </div>
              ) : slots.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-charcoal-400 py-8">
                  <Clock size={32} className="mb-2 opacity-40" />
                  <p className="text-sm">No available times on this day</p>
                </div>
              ) : (
                <div>
                  <p className="text-sm font-semibold text-charcoal-700 mb-3">
                    {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric' })}
                  </p>
                  <div className="flex flex-col gap-2 max-h-72 overflow-y-auto pr-1">
                    {slots.map(slot => (
                      <button
                        key={slot}
                        onClick={() => { setSelectedSlot(slot); setStep('form') }}
                        className="w-full rounded-xl border border-charcoal-200 py-2.5 text-sm font-medium text-charcoal-800 hover:border-charcoal-900 hover:bg-charcoal-900 hover:text-white transition-colors"
                      >
                        {formatSlot(slot)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Step: booking form ──────────────────────────────────────────────── */}
        {step === 'form' && selectedSlot && (
          <div className="rounded-2xl border border-charcoal-200 bg-white p-6">
            <button
              onClick={() => { setStep('calendar'); setSelectedSlot(null) }}
              className="flex items-center gap-1 text-sm text-charcoal-500 hover:text-charcoal-800 mb-5 transition-colors"
            >
              <ChevronLeft size={16} /> Back
            </button>

            <div className="flex items-center gap-2 mb-6 p-3 rounded-xl bg-charcoal-50 text-sm text-charcoal-700">
              <Calendar size={16} className="text-charcoal-400 shrink-0" />
              <span>{formatConfirmed(selectedSlot)}</span>
              <span className="text-charcoal-400 ml-auto">· {schedule?.meetingDurationMin ?? 30} min</span>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <Input
                label="Your Name *"
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                required
              />
              <Input
                label="Email Address *"
                type="email"
                value={form.email}
                onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                required
              />
              <Input
                label="Phone (optional)"
                type="tel"
                value={form.phone}
                onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
              />
              <div>
                <label className="block text-sm font-medium text-charcoal-700 mb-1">Message (optional)</label>
                <textarea
                  rows={3}
                  value={form.message}
                  onChange={e => setForm(p => ({ ...p, message: e.target.value }))}
                  placeholder="Anything you'd like me to know before our meeting?"
                  className="w-full rounded-xl border border-charcoal-200 px-3 py-2 text-sm text-charcoal-900 placeholder-charcoal-400 focus:border-charcoal-400 focus:outline-none focus:ring-0 resize-none"
                />
              </div>
              <Button type="submit" variant="primary" loading={submitting} className="mt-2">
                Confirm Booking
              </Button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
