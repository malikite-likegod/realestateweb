'use client'

import { useState } from 'react'
import { ChevronDown, Mail, MessageSquare } from 'lucide-react'

type OptLogEntry = {
  id:         string
  channel:    string
  action:     string
  changedAt:  Date | string
  reason:     string | null
  changedBy:  { name: string } | null
}

interface Props {
  emailOptOut: boolean
  smsOptOut:   boolean
  optLogs:     OptLogEntry[]
}

export function CommOptLogPanel({ emailOptOut, smsOptOut, optLogs }: Props) {
  const [expanded, setExpanded] = useState(false)

  function formatLogDate(d: Date | string) {
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  return (
    <div className="rounded-xl border border-charcoal-100 bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-charcoal-50 transition-colors"
      >
        <p className="text-xs font-semibold text-charcoal-700 uppercase tracking-wide">
          Communication Preferences
        </p>
        <ChevronDown
          size={14}
          className={`text-charcoal-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      {expanded && (
        <div className="border-t border-charcoal-100 px-4 py-3 flex flex-col gap-4">

          {/* Current status */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1.5 text-charcoal-600">
                <Mail size={13} /> Email
              </span>
              {emailOptOut
                ? <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full">Opted out</span>
                : <span className="text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full">Receiving</span>
              }
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1.5 text-charcoal-600">
                <MessageSquare size={13} /> SMS
              </span>
              {smsOptOut
                ? <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full">Opted out</span>
                : <span className="text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full">Receiving</span>
              }
            </div>
          </div>

          {/* Log history */}
          {optLogs.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <p className="text-xs font-semibold text-charcoal-400 uppercase tracking-wide">History</p>
              {optLogs.map(entry => (
                <div key={entry.id} className="flex items-start gap-2 text-xs text-charcoal-600">
                  <span className={`mt-0.5 shrink-0 w-1.5 h-1.5 rounded-full ${
                    entry.action === 'opt_out' ? 'bg-red-400' : 'bg-green-400'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <span className="font-medium capitalize">{entry.channel}</span>
                    {' '}
                    <span>{entry.action === 'opt_out' ? 'opted out' : 'opted in'}</span>
                    {entry.reason && <span className="text-charcoal-400"> — {entry.reason}</span>}
                  </div>
                  <div className="shrink-0 text-charcoal-400 text-right">
                    <div>{formatLogDate(entry.changedAt)}</div>
                    {entry.changedBy && <div>{entry.changedBy.name}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {optLogs.length === 0 && (
            <p className="text-xs text-charcoal-400">No preference changes recorded.</p>
          )}
        </div>
      )}
    </div>
  )
}
