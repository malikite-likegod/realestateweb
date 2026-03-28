'use client'

import { useState } from 'react'
import { Card } from '@/components/layout'
import { Bell } from 'lucide-react'

interface Props {
  initialEnabled: boolean
  initialViews:   number
  initialHours:   number
}

export function HotBrowserAlertCard({ initialEnabled, initialViews, initialHours }: Props) {
  const [enabled, setEnabled] = useState(initialEnabled)
  const [views,   setViews]   = useState(initialViews)
  const [hours,   setHours]   = useState(initialHours)
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)

  async function save() {
    setSaving(true)
    setSaved(false)
    await fetch('/api/admin/settings', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hot_browser_alert_enabled: String(enabled),
        hot_browser_alert_views:   String(views),
        hot_browser_alert_hours:   String(hours),
      }),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <Card>
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-center gap-2">
          <Bell size={18} className="text-gold-500 shrink-0" />
          <h3 className="font-semibold text-charcoal-900">Hot Browser Alert</h3>
        </div>
        {/* Toggle */}
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={() => setEnabled(v => !v)}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-gold-500 focus:ring-offset-2 ${
            enabled ? 'bg-gold-500' : 'bg-charcoal-200'
          }`}
        >
          <span
            className={`inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform ${
              enabled ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      <p className="text-sm text-charcoal-500 mb-5">
        When a contact views listings repeatedly within a set window, the notification bell will fire
        and a call-back task will be created for the following day.
      </p>

      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-xs font-medium text-charcoal-600 mb-1">
            Listing views
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={50}
              value={views}
              onChange={e => setViews(Math.max(1, Number(e.target.value)))}
              disabled={!enabled}
              className="w-20 rounded-lg border border-charcoal-200 px-3 py-1.5 text-sm text-charcoal-900 focus:outline-none focus:ring-2 focus:ring-gold-500 disabled:opacity-40"
            />
            <span className="text-sm text-charcoal-500">views</span>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-charcoal-600 mb-1">
            Time window
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={168}
              value={hours}
              onChange={e => setHours(Math.max(1, Number(e.target.value)))}
              disabled={!enabled}
              className="w-20 rounded-lg border border-charcoal-200 px-3 py-1.5 text-sm text-charcoal-900 focus:outline-none focus:ring-2 focus:ring-gold-500 disabled:opacity-40"
            />
            <span className="text-sm text-charcoal-500">hours</span>
          </div>
        </div>

        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="rounded-lg bg-charcoal-900 px-4 py-2 text-sm font-medium text-white hover:bg-charcoal-700 transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save'}
        </button>
      </div>

      {enabled && (
        <p className="mt-4 text-xs text-charcoal-400 bg-charcoal-50 rounded-lg px-3 py-2">
          Alert fires when a contact views <strong>{views}</strong> or more listings within <strong>{hours}</strong> hour{hours !== 1 ? 's' : ''}.
          A &ldquo;Call [contact]&rdquo; task will be created due the following day.
        </p>
      )}
    </Card>
  )
}
