'use client'

import { AUDIT_EVENTS } from '@/lib/audit'

export interface AuditFilters {
  events: string[]
  actor: string
  ip: string
  from: string
  to: string
}

interface Props {
  filters: AuditFilters
  onChange: (filters: AuditFilters) => void
}

const EVENT_LABELS: Record<string, string> = {
  login_success:            'Login Success',
  login_failure:            'Login Failure',
  logout:                   'Logout',
  '2fa_sent':               '2FA Sent',
  '2fa_success':            '2FA Success',
  '2fa_failure':            '2FA Failure',
  password_reset_request:   'Password Reset Request',
  password_reset_complete:  'Password Reset Complete',
  password_change:          'Password Change',
  portal_login_success:     'Portal Login Success',
  portal_login_failure:     'Portal Login Failure',
  portal_logout:            'Portal Logout',
}

export function SecurityAuditFilters({ filters, onChange }: Props) {
  function toggleEvent(event: string) {
    const next = filters.events.includes(event)
      ? filters.events.filter(e => e !== event)
      : [...filters.events, event]
    onChange({ ...filters, events: next })
  }

  const isDirty = filters.events.length > 0 || filters.actor.length > 0 || filters.ip.length > 0 || filters.from.length > 0 || filters.to.length > 0

  return (
    <div className="flex flex-wrap gap-3 mb-4">
      {/* Event type dropdown */}
      <div className="relative">
        <details className="group">
          <summary className="cursor-pointer px-3 py-2 border border-gray-300 rounded-md text-sm bg-white select-none">
            Events {filters.events.length > 0 ? `(${filters.events.length})` : '(All)'}
          </summary>
          <div className="absolute z-10 mt-1 bg-white border border-gray-200 rounded-md shadow-lg p-2 min-w-52">
            {AUDIT_EVENTS.map(event => (
              <label key={event} className="flex items-center gap-2 px-2 py-1 text-sm hover:bg-gray-50 cursor-pointer rounded">
                <input
                  type="checkbox"
                  checked={filters.events.includes(event)}
                  onChange={() => toggleEvent(event)}
                  className="rounded"
                />
                {EVENT_LABELS[event] ?? event}
              </label>
            ))}
          </div>
        </details>
      </div>

      {/* Date range */}
      <input
        type="date"
        value={filters.from}
        onChange={e => onChange({ ...filters, from: e.target.value })}
        className="px-3 py-2 border border-gray-300 rounded-md text-sm bg-white"
        aria-label="From date"
      />
      <input
        type="date"
        value={filters.to}
        onChange={e => onChange({ ...filters, to: e.target.value })}
        className="px-3 py-2 border border-gray-300 rounded-md text-sm bg-white"
        aria-label="To date"
      />

      {/* Actor */}
      <input
        type="text"
        value={filters.actor}
        onChange={e => onChange({ ...filters, actor: e.target.value })}
        placeholder="Actor email..."
        className="px-3 py-2 border border-gray-300 rounded-md text-sm bg-white w-48"
      />

      {/* IP */}
      <input
        type="text"
        value={filters.ip}
        onChange={e => onChange({ ...filters, ip: e.target.value })}
        placeholder="IP address..."
        className="px-3 py-2 border border-gray-300 rounded-md text-sm bg-white w-36"
      />

      {isDirty && (
        <button
          onClick={() => onChange({ events: [], actor: '', ip: '', from: '', to: '' })}
          className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700"
        >
          Clear filters
        </button>
      )}
    </div>
  )
}
