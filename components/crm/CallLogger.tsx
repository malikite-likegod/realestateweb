'use client'

/**
 * CallLogger
 *
 * Renders the call history for a contact plus a form to manually log a new
 * call. Designed to match the NotesPanel visual style.
 */

import { useState } from 'react'
import { Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed, Mic } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { Button, useToast } from '@/components/ui'

type CallStatus = 'completed' | 'missed' | 'voicemail' | 'failed'
type CallDirection = 'inbound' | 'outbound'

export type CallLogEntry = {
  id:           string
  direction:    CallDirection
  status:       CallStatus
  durationSec:  number | null
  notes:        string | null
  recordingUrl: string | null
  transcription: string | null
  loggedBy:     { name: string } | null
  occurredAt:   Date | string
}

interface CallLoggerProps {
  calls:     CallLogEntry[]
  contactId: string
  onLog?:    (entry: CallLogEntry) => void
}

const statusIcon: Record<CallStatus, React.ReactNode> = {
  completed: <PhoneOutgoing size={12} />,
  missed:    <PhoneMissed   size={12} />,
  voicemail: <Mic           size={12} />,
  failed:    <PhoneMissed   size={12} />,
}

const statusColor: Record<CallStatus, string> = {
  completed: 'bg-green-100 text-green-600',
  missed:    'bg-red-100 text-red-600',
  voicemail: 'bg-amber-100 text-amber-600',
  failed:    'bg-red-100 text-red-600',
}

function formatDuration(sec: number | null): string {
  if (!sec) return '—'
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return m ? `${m}m ${s}s` : `${s}s`
}

export function CallLogger({ calls, contactId, onLog }: CallLoggerProps) {
  const [direction, setDirection]  = useState<CallDirection>('outbound')
  const [status, setStatus]        = useState<CallStatus>('completed')
  const [durationSec, setDuration] = useState('')
  const [notes, setNotes]          = useState('')
  const [saving, setSaving]        = useState(false)
  const { toast }                  = useToast()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch('/api/calls', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          contactId,
          direction,
          status,
          durationSec: durationSec ? parseInt(durationSec) : undefined,
          notes:       notes || undefined,
        }),
      })
      if (!res.ok) throw new Error('Failed to log call')
      const { data } = await res.json()
      onLog?.(data)
      setNotes('')
      setDuration('')
      toast('success', 'Call logged')
    } catch (err) {
      console.error(err)
      toast('error', 'Failed to log call')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Log call form */}
      <form onSubmit={handleSubmit} className="rounded-xl border border-charcoal-200 bg-charcoal-50 p-4 flex flex-col gap-3">
        <p className="text-xs font-semibold text-charcoal-700 uppercase tracking-wide">Log a Call</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-charcoal-500 mb-1 block">Direction</label>
            <select
              value={direction}
              onChange={e => setDirection(e.target.value as CallDirection)}
              className="w-full rounded-lg border border-charcoal-200 bg-white px-3 py-1.5 text-sm text-charcoal-900 focus:outline-none focus:ring-2 focus:ring-charcoal-900"
            >
              <option value="outbound">Outbound</option>
              <option value="inbound">Inbound</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-charcoal-500 mb-1 block">Outcome</label>
            <select
              value={status}
              onChange={e => setStatus(e.target.value as CallStatus)}
              className="w-full rounded-lg border border-charcoal-200 bg-white px-3 py-1.5 text-sm text-charcoal-900 focus:outline-none focus:ring-2 focus:ring-charcoal-900"
            >
              <option value="completed">Completed</option>
              <option value="missed">Missed</option>
              <option value="voicemail">Voicemail</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        </div>
        <div>
          <label className="text-xs text-charcoal-500 mb-1 block">Duration (seconds)</label>
          <input
            type="number"
            min={0}
            value={durationSec}
            onChange={e => setDuration(e.target.value)}
            placeholder="e.g. 180"
            className="w-full rounded-lg border border-charcoal-200 bg-white px-3 py-1.5 text-sm text-charcoal-900 placeholder:text-charcoal-400 focus:outline-none focus:ring-2 focus:ring-charcoal-900"
          />
        </div>
        <div>
          <label className="text-xs text-charcoal-500 mb-1 block">Notes</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Call summary…"
            rows={2}
            className="w-full rounded-lg border border-charcoal-200 bg-white px-3 py-2 text-sm text-charcoal-900 placeholder:text-charcoal-400 focus:outline-none focus:ring-2 focus:ring-charcoal-900 resize-none"
          />
        </div>
        <Button type="submit" variant="primary" size="sm" loading={saving} leftIcon={<Phone size={14} />}>
          Log Call
        </Button>
      </form>

      {/* Call history */}
      <div className="flex flex-col gap-3">
        {calls.length === 0 && <p className="text-sm text-charcoal-400">No calls logged yet.</p>}
        {calls.map(call => {
          const dir = call.direction as CallDirection
          const st  = call.status  as CallStatus
          return (
            <div key={call.id} className="flex items-start gap-3">
              <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${statusColor[st]}`}>
                {dir === 'inbound' ? <PhoneIncoming size={12} /> : statusIcon[st]}
              </div>
              <div className="flex-1 rounded-xl bg-white border border-charcoal-100 p-3">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-semibold text-charcoal-800 capitalize">{st} {dir} call</span>
                  <span className="text-xs text-charcoal-400">· {formatDuration(call.durationSec)}</span>
                </div>
                {call.notes && <p className="text-xs text-charcoal-500 mb-1">{call.notes}</p>}
                {call.transcription && (
                  <details className="text-xs">
                    <summary className="text-charcoal-400 cursor-pointer">View transcription</summary>
                    <p className="mt-1 text-charcoal-600 whitespace-pre-wrap">{call.transcription}</p>
                  </details>
                )}
                {call.recordingUrl && (
                  <a href={call.recordingUrl} target="_blank" rel="noreferrer" className="text-xs text-gold-600 hover:underline mt-1 inline-block">
                    Play recording
                  </a>
                )}
                <div className="flex items-center gap-2 mt-1 text-xs text-charcoal-300">
                  {call.loggedBy && <span>{call.loggedBy.name}</span>}
                  <span>·</span>
                  <span>{formatDate(new Date(call.occurredAt), { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
