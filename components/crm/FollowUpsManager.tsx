'use client'

/**
 * FollowUpsManager
 *
 * Client-side UI for /admin/followups:
 *   - "Run analyzer now" button — POST /api/followups/analyze, refreshes the list
 *   - Overdue contacts table — read-only preview of who's currently due
 *   - Per-segment cadence rules editor — PATCH /api/followups/rules/[id]
 */

import { useState } from 'react'
import Link from 'next/link'
import { Play, Phone, Mail, MessageSquare } from 'lucide-react'
import { Card } from '@/components/layout'
import { Button, Badge, Input, Select } from '@/components/ui'
import type { OverdueContactPreview } from '@/lib/followups/analyzer-service'
import type { FollowUpRule } from '@prisma/client'

const SEGMENT_LABEL: Record<string, string> = {
  hot: 'Hot', warm: 'Warm', cool: 'Cool', past_client: 'Past Client', soi: 'SOI',
}
const SEGMENT_BADGE: Record<string, 'danger' | 'warning' | 'default' | 'info' | 'gold'> = {
  hot: 'danger', warm: 'warning', cool: 'info', past_client: 'gold', soi: 'default',
}
const CHANNEL_ICON = { email: Mail, text: MessageSquare, call: Phone } as const

const CHANNEL_OPTIONS = [
  { value: 'email', label: 'Email' },
  { value: 'text',  label: 'Text' },
  { value: 'call',  label: 'Call' },
]
const PRIORITY_OPTIONS = [
  { value: 'low',    label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high',   label: 'High' },
  { value: 'urgent', label: 'Urgent' },
]

interface FollowUpsManagerProps {
  initialRules:   FollowUpRule[]
  initialOverdue: OverdueContactPreview[]
}

export function FollowUpsManager({ initialRules, initialOverdue }: FollowUpsManagerProps) {
  const [rules, setRules]     = useState(initialRules)
  const [overdue, setOverdue] = useState(initialOverdue)
  const [running, setRunning] = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [status, setStatus]   = useState<string | null>(null)

  async function refreshOverdue() {
    const res = await fetch('/api/followups/preview')
    if (res.ok) {
      const { data } = await res.json()
      setOverdue(data)
    }
  }

  async function runAnalyzer() {
    setRunning(true)
    setStatus(null)
    try {
      const res = await fetch('/api/followups/analyze', { method: 'POST' })
      if (!res.ok) throw new Error('Analyzer run failed')
      const { data } = await res.json()
      setStatus(`Analyzed ${data.analyzed} contacts — created ${data.tasksCreated} follow-up task${data.tasksCreated === 1 ? '' : 's'}, flagged ${data.anniversariesFlagged} anniversar${data.anniversariesFlagged === 1 ? 'y' : 'ies'}.`)
      await refreshOverdue()
    } catch {
      setStatus('Analyzer run failed — check server logs.')
    } finally {
      setRunning(false)
    }
  }

  async function saveRule(rule: FollowUpRule, patch: Partial<FollowUpRule>) {
    setSavingId(rule.id)
    try {
      const res = await fetch(`/api/followups/rules/${rule.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(patch),
      })
      if (res.ok) {
        const { data } = await res.json()
        setRules(prev => prev.map(r => (r.id === rule.id ? data : r)))
      }
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="font-semibold text-charcoal-900">Run Analyzer</h3>
            <p className="text-sm text-charcoal-500">Runs automatically once a day — trigger it manually any time.</p>
          </div>
          <Button onClick={runAnalyzer} loading={running} leftIcon={<Play size={16} />}>
            Run analyzer now
          </Button>
        </div>
        {status && <p className="text-sm text-charcoal-700 mt-2">{status}</p>}
      </Card>

      <Card>
        <h3 className="font-semibold text-charcoal-900 mb-4">Overdue Contacts ({overdue.length})</h3>
        {overdue.length === 0 ? (
          <p className="text-sm text-charcoal-400">Nobody's overdue right now.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-charcoal-400 border-b border-charcoal-100">
                  <th className="pb-2 font-medium">Contact</th>
                  <th className="pb-2 font-medium">Segment</th>
                  <th className="pb-2 font-medium">Days Overdue</th>
                  <th className="pb-2 font-medium">Channel</th>
                  <th className="pb-2 font-medium">Priority</th>
                  <th className="pb-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {overdue.map(c => {
                  const ChannelIcon = CHANNEL_ICON[c.recommendedChannel]
                  return (
                    <tr key={c.contactId} className="border-b border-charcoal-50 last:border-0">
                      <td className="py-2.5">
                        <Link href={`/admin/contacts/${c.contactId}`} className="font-medium text-charcoal-900 hover:text-gold-600">
                          {c.name}
                        </Link>
                      </td>
                      <td className="py-2.5">
                        <Badge variant={SEGMENT_BADGE[c.segment] ?? 'default'}>{SEGMENT_LABEL[c.segment] ?? c.segment}</Badge>
                      </td>
                      <td className="py-2.5 text-charcoal-700">{c.daysSinceLastTouch}</td>
                      <td className="py-2.5">
                        <span className="flex items-center gap-1.5 text-charcoal-700">
                          <ChannelIcon size={14} /> {c.recommendedChannel}
                        </span>
                      </td>
                      <td className="py-2.5 text-charcoal-700 capitalize">{c.priority}</td>
                      <td className="py-2.5">
                        {c.hasOpenFollowUpTask
                          ? <Badge variant="success">Task created</Badge>
                          : <Badge variant="default">Pending run</Badge>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <h3 className="font-semibold text-charcoal-900 mb-4">Cadence Rules</h3>
        <div className="flex flex-col gap-4">
          {rules.map(rule => (
            <div key={rule.id} className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end pb-4 border-b border-charcoal-50 last:border-0 last:pb-0">
              <div>
                <p className="text-xs font-medium text-charcoal-400 mb-1.5">Segment</p>
                <Badge variant={SEGMENT_BADGE[rule.segment] ?? 'default'}>{SEGMENT_LABEL[rule.segment] ?? rule.segment}</Badge>
              </div>
              <Input
                label="Interval (days)"
                type="number"
                min={1}
                defaultValue={rule.intervalDays}
                onBlur={e => {
                  const value = parseInt(e.target.value, 10)
                  if (value > 0 && value !== rule.intervalDays) saveRule(rule, { intervalDays: value })
                }}
              />
              <Select
                label="Channel"
                options={CHANNEL_OPTIONS}
                defaultValue={rule.preferredChannel}
                onChange={e => saveRule(rule, { preferredChannel: e.target.value })}
              />
              <Select
                label="Priority"
                options={PRIORITY_OPTIONS}
                defaultValue={rule.priority}
                onChange={e => saveRule(rule, { priority: e.target.value })}
              />
              <div className="md:col-span-2">
                <Input
                  label="Task title template"
                  defaultValue={rule.taskTitleTemplate}
                  onBlur={e => {
                    if (e.target.value && e.target.value !== rule.taskTitleTemplate) {
                      saveRule(rule, { taskTitleTemplate: e.target.value })
                    }
                  }}
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 text-sm text-charcoal-700">
                  <input
                    type="checkbox"
                    defaultChecked={rule.isActive}
                    onChange={e => saveRule(rule, { isActive: e.target.checked })}
                  />
                  Active
                </label>
                {savingId === rule.id && <span className="text-xs text-charcoal-400">Saving…</span>}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
