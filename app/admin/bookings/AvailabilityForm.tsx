'use client'

import { useState } from 'react'
import { Button, Input, Select } from '@/components/ui'
import { useToast } from '@/components/ui'
import { Plus, Trash2, Copy } from 'lucide-react'


type Window = { dayOfWeek: number; startTime: string; endTime: string }

interface Schedule {
  id?:                 string
  slug:                string
  agentName:           string
  agentTitle:          string
  agentEmail:          string
  agentPhone:          string
  agentPhoto:          string
  meetingTitle:        string
  meetingDescription:  string
  meetingDurationMin:  number
  bufferMinutes:       number
  advanceDays:         number
  timezone:            string
  windows:             Window[]
  isActive:            boolean
}

const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const TIMEZONES  = ['America/Toronto', 'America/Vancouver', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles']
const DURATIONS  = [15, 20, 30, 45, 60, 90]

interface Props {
  initial: Schedule | null
}

export function AvailabilityForm({ initial }: Props) {
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)

  const [form, setForm] = useState<Schedule>({
    slug:               initial?.slug               ?? '',
    agentName:          initial?.agentName          ?? '',
    agentTitle:         initial?.agentTitle         ?? '',
    agentEmail:         initial?.agentEmail         ?? '',
    agentPhone:         initial?.agentPhone         ?? '',
    agentPhoto:         initial?.agentPhoto         ?? '',
    meetingTitle:       initial?.meetingTitle        ?? 'Book a Meeting',
    meetingDescription: initial?.meetingDescription  ?? '',
    meetingDurationMin: initial?.meetingDurationMin  ?? 30,
    bufferMinutes:      initial?.bufferMinutes       ?? 15,
    advanceDays:        initial?.advanceDays         ?? 30,
    timezone:           initial?.timezone            ?? 'America/Toronto',
    windows:            initial?.windows             ?? [],
    isActive:           initial?.isActive            ?? true,
  })

  function set<K extends keyof Schedule>(key: K, val: Schedule[K]) {
    setForm(prev => ({ ...prev, [key]: val }))
  }

  function addWindow() {
    setForm(prev => ({
      ...prev,
      windows: [...prev.windows, { dayOfWeek: 1, startTime: '09:00', endTime: '17:00' }],
    }))
  }

  function removeWindow(i: number) {
    setForm(prev => ({ ...prev, windows: prev.windows.filter((_, idx) => idx !== i) }))
  }

  function updateWindow(i: number, key: keyof Window, val: string | number) {
    setForm(prev => ({
      ...prev,
      windows: prev.windows.map((w, idx) => idx === i ? { ...w, [key]: val } : w),
    }))
  }

  async function handleSave() {
    if (!form.slug.trim()) { toast('error', 'Booking URL slug is required'); return }
    if (!form.agentName.trim()) { toast('error', 'Agent name is required'); return }

    setSaving(true)
    try {
      const res  = await fetch('/api/availability', {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ ...form, windows: JSON.stringify(form.windows) }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error ?? 'Failed to save')
      }
      toast('success', 'Availability saved')
    } catch (err) {
      toast('error', err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  function copyLink() {
    const url = `${window.location.origin}/book/${form.slug}`
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const bookingUrl = `/book/${form.slug || '<your-slug>'}`

  return (
    <div className="flex flex-col gap-8 max-w-2xl">

      {/* Booking link preview */}
      {form.slug && (
        <div className="flex items-center gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3">
          <p className="flex-1 text-sm text-sky-800 font-medium truncate">
            {typeof window !== 'undefined' ? window.location.origin : ''}{bookingUrl}
          </p>
          <Button variant="ghost" size="sm" leftIcon={<Copy size={14} />} onClick={copyLink}>
            {copied ? 'Copied!' : 'Copy Link'}
          </Button>
        </div>
      )}

      {/* Agent info */}
      <section>
        <h3 className="text-sm font-semibold text-charcoal-700 uppercase tracking-wide mb-3">Agent Info</h3>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Agent Name *" value={form.agentName} onChange={e => set('agentName', e.target.value)} />
          <Input label="Title / Role" value={form.agentTitle} onChange={e => set('agentTitle', e.target.value)} placeholder="e.g. Realtor®" />
          <Input label="Email" type="email" value={form.agentEmail} onChange={e => set('agentEmail', e.target.value)} />
          <Input label="Phone" value={form.agentPhone} onChange={e => set('agentPhone', e.target.value)} />
          <div className="col-span-2">
            <Input label="Photo URL" value={form.agentPhoto} onChange={e => set('agentPhoto', e.target.value)} placeholder="/uploads/photo.jpg" />
          </div>
        </div>
      </section>

      {/* Meeting settings */}
      <section>
        <h3 className="text-sm font-semibold text-charcoal-700 uppercase tracking-wide mb-3">Meeting Settings</h3>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Booking URL Slug *" value={form.slug}
            onChange={e => set('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
            placeholder="your-name" />
          <Input label="Meeting Title" value={form.meetingTitle} onChange={e => set('meetingTitle', e.target.value)} />
          <div className="col-span-2">
            <Input label="Description (shown on booking page)" value={form.meetingDescription}
              onChange={e => set('meetingDescription', e.target.value)} />
          </div>
          <Select
            label="Meeting Duration"
            value={String(form.meetingDurationMin)}
            onChange={e => set('meetingDurationMin', Number(e.target.value))}
            options={DURATIONS.map(d => ({ value: String(d), label: `${d} minutes` }))}
          />
          <Select
            label="Buffer Between Meetings"
            value={String(form.bufferMinutes)}
            onChange={e => set('bufferMinutes', Number(e.target.value))}
            options={[0, 5, 10, 15, 30].map(d => ({ value: String(d), label: d === 0 ? 'None' : `${d} minutes` }))}
          />
          <Select
            label="Booking Window (how far ahead)"
            value={String(form.advanceDays)}
            onChange={e => set('advanceDays', Number(e.target.value))}
            options={[7, 14, 21, 30, 60, 90].map(d => ({ value: String(d), label: `${d} days ahead` }))}
          />
          <Select
            label="Timezone"
            value={form.timezone}
            onChange={e => set('timezone', e.target.value)}
            options={TIMEZONES.map(tz => ({ value: tz, label: tz }))}
          />
        </div>
      </section>

      {/* Availability windows */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-charcoal-700 uppercase tracking-wide">Weekly Availability</h3>
          <Button variant="ghost" size="sm" leftIcon={<Plus size={14} />} onClick={addWindow}>Add Window</Button>
        </div>

        {form.windows.length === 0 ? (
          <p className="text-sm text-charcoal-400 py-4 text-center border border-dashed border-charcoal-200 rounded-xl">
            No availability windows — guests won&apos;t be able to book. Add a window above.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {form.windows.map((w, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg border border-charcoal-100 bg-white p-3">
                <Select
                  value={String(w.dayOfWeek)}
                  onChange={e => updateWindow(i, 'dayOfWeek', Number(e.target.value))}
                  options={DAY_LABELS.map((d, idx) => ({ value: String(idx), label: d }))}
                  className="w-36"
                />
                <Input
                  type="time" value={w.startTime}
                  onChange={e => updateWindow(i, 'startTime', e.target.value)}
                  className="w-32"
                />
                <span className="text-charcoal-400 text-sm">to</span>
                <Input
                  type="time" value={w.endTime}
                  onChange={e => updateWindow(i, 'endTime', e.target.value)}
                  className="w-32"
                />
                <button onClick={() => removeWindow(i)} className="ml-auto text-charcoal-400 hover:text-red-500 transition-colors">
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Active toggle + save */}
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm text-charcoal-700 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={e => set('isActive', e.target.checked)}
            className="rounded border-charcoal-300"
          />
          Booking page is active (guests can book)
        </label>
        <Button variant="primary" loading={saving} onClick={handleSave}>Save Availability</Button>
      </div>
    </div>
  )
}
