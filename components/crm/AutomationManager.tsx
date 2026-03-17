'use client'

/**
 * AutomationManager
 *
 * Client component that owns the Campaigns / Rules / Job Queue tabs and
 * re-fetches data after create/toggle actions without a full page reload.
 */

import { useState } from 'react'
import { Plus, Zap, CheckCircle, XCircle, Clock, Play, ToggleLeft, ToggleRight, Pencil, X } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { Badge, Button, Tabs } from '@/components/ui'
import { CampaignBuilder } from './CampaignBuilder'
import { RuleBuilder } from './RuleBuilder'
import { SpecialEventBuilder } from './SpecialEventBuilder'

// ─── Types ────────────────────────────────────────────────────────────────────

type CampaignStep = {
  id:           string
  order:        number
  type:         string
  delayMinutes: number
  config:       Record<string, unknown>
}

type Campaign = {
  id:                string
  name:              string
  description:       string | null
  trigger:           string
  isActive:          boolean
  activeEnrollments: number
  steps:             CampaignStep[]
  createdAt:         Date | string
}

type Rule = {
  id:          string
  name:        string
  description: string | null
  trigger:     string
  isActive:    boolean
  runCount:    number
  lastRunAt:   Date | string | null
  createdAt:   Date | string
}

type JobStats = {
  pending: number
  failed:  number
  jobs:    Array<{
    id:      string
    type:    string
    status:  string
    runAt:   Date | string
    error:   string | null
    attempts: number
  }>
}

interface AutomationManagerProps {
  initialCampaigns:      Campaign[]
  initialRules:          Rule[]
  initialJobStats:       JobStats
  initialSpecialEvents?: Campaign[]
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AutomationManager({ initialCampaigns, initialRules, initialJobStats, initialSpecialEvents }: AutomationManagerProps) {
  const [campaigns,      setCampaigns]      = useState<Campaign[]>(initialCampaigns)
  const [specialEvents,  setSpecialEvents]  = useState<Campaign[]>(initialSpecialEvents ?? [])
  const [rules,          setRules]          = useState<Rule[]>(initialRules)
  const [jobStats,       setJobStats]       = useState<JobStats>(initialJobStats)
  const [showNewCampaign,     setShowNewCampaign]     = useState(false)
  const [showNewSpecialEvent, setShowNewSpecialEvent] = useState(false)
  const [showNewRule,         setShowNewRule]         = useState(false)
  const [processing,          setProcessing]          = useState(false)
  const [editingCampaignId,   setEditingCampaignId]   = useState<string | null>(null)
  const [editingEventId,      setEditingEventId]      = useState<string | null>(null)

  // Refresh campaigns from server
  function normaliseCampaigns(raw: (Campaign & { enrollments: { id: string }[], steps: Array<CampaignStep & { config: string }> })[]) {
    return raw.map(c => ({
      ...c,
      activeEnrollments: c.enrollments.length,
      steps: c.steps.map((s: CampaignStep & { config: string }) => {
        let config: Record<string, unknown> = {}
        try { config = typeof s.config === 'string' ? JSON.parse(s.config) : s.config } catch { /* skip bad config */ }
        return { ...s, config }
      }),
    }))
  }

  async function refreshCampaigns() {
    try {
      const res  = await fetch('/api/campaigns?trigger=drip')
      if (!res.ok) return
      const json = await res.json()
      if (json.data) setCampaigns(normaliseCampaigns(json.data))
    } catch { /* network error — keep current list */ }
    setShowNewCampaign(false)
  }

  async function refreshSpecialEvents() {
    try {
      const res  = await fetch('/api/campaigns?trigger=special_event')
      if (!res.ok) return
      const json = await res.json()
      if (json.data) setSpecialEvents(normaliseCampaigns(json.data))
    } catch { /* network error */ }
    setShowNewSpecialEvent(false)
    setEditingEventId(null)
  }

  async function refreshRules() {
    const res  = await fetch('/api/automation/rules')
    const json = await res.json()
    if (json.data) setRules(json.data)
    setShowNewRule(false)
  }

  async function toggleCampaign(id: string, current: boolean) {
    await fetch(`/api/campaigns/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !current }),
    })
    setCampaigns(prev => prev.map(c => c.id === id ? { ...c, isActive: !current } : c))
  }

  async function toggleSpecialEvent(id: string, current: boolean) {
    await fetch(`/api/campaigns/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !current }),
    })
    setSpecialEvents(prev => prev.map(c => c.id === id ? { ...c, isActive: !current } : c))
  }

  async function toggleRule(id: string, current: boolean) {
    await fetch(`/api/automation/rules/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !current }),
    })
    setRules(prev => prev.map(r => r.id === id ? { ...r, isActive: !current } : r))
  }

  async function processJobs() {
    setProcessing(true)
    try {
      const res  = await fetch('/api/automation/process', { method: 'POST' })
      const json = await res.json()
      // Refresh queue stats
      const statsRes  = await fetch('/api/automation/process')
      const statsJson = await statsRes.json()
      if (statsJson.data) setJobStats(prev => ({ ...prev, ...statsJson.data }))
      return json.data
    } finally {
      setProcessing(false)
    }
  }

  const stepTypeLabels: Record<string, string> = {
    send_email: 'Email', send_sms: 'SMS', create_task: 'Call',
    wait: 'Wait', update_lead_score: 'Score', transfer_campaign: 'Transfer',
  }

  const scheduleTypeLabels: Record<string, string> = {
    contact_birthday: 'Birthday',
    last_deal_closed: 'Deal Anniversary',
    fixed_date:       'Fixed Date',
  }

  // ─── Campaigns tab ──────────────────────────────────────────────────────────

  const CampaignsTab = (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button variant="primary" size="sm" leftIcon={<Plus size={14} />}
          onClick={() => setShowNewCampaign(v => !v)}>
          {showNewCampaign ? 'Cancel' : 'New Campaign'}
        </Button>
      </div>

      {showNewCampaign && (
        <div className="rounded-xl border border-charcoal-200 bg-white p-5">
          <h3 className="font-semibold text-charcoal-900 mb-4">New Drip Campaign</h3>
          <CampaignBuilder onCreated={refreshCampaigns} allCampaigns={campaigns} />
        </div>
      )}

      {campaigns.length === 0 && !showNewCampaign ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-charcoal-100">
            <Zap size={24} className="text-charcoal-400" />
          </div>
          <h3 className="font-serif text-xl font-bold text-charcoal-900">No Campaigns Yet</h3>
          <p className="text-charcoal-400 max-w-sm text-sm">Create automated drip sequences that send emails, SMS, and tasks over time.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {campaigns.map(c => (
            <div key={c.id} className="rounded-xl border border-charcoal-200 bg-white p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-charcoal-900">{c.name}</h3>
                  {c.description && <p className="text-xs text-charcoal-400 mt-0.5">{c.description}</p>}
                  <p className="text-xs text-charcoal-400 mt-0.5 capitalize">Trigger: {c.trigger.replace(/_/g, ' ')}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={c.isActive ? 'success' : 'default'}>{c.isActive ? 'Active' : 'Paused'}</Badge>
                  <button
                    onClick={() => setEditingCampaignId(editingCampaignId === c.id ? null : c.id)}
                    className="text-charcoal-400 hover:text-charcoal-700" title="Edit campaign">
                    {editingCampaignId === c.id ? <X size={16} /> : <Pencil size={16} />}
                  </button>
                  <button onClick={() => toggleCampaign(c.id, c.isActive)}
                    className="text-charcoal-400 hover:text-charcoal-700" title="Toggle">
                    {c.isActive ? <ToggleRight size={20} className="text-green-600" /> : <ToggleLeft size={20} />}
                  </button>
                </div>
              </div>

              {/* Steps preview */}
              <div className="flex flex-col gap-1.5 border-t border-charcoal-100 pt-3 mb-3">
                {c.steps.map((step, i) => (
                  <div key={step.id} className="flex items-center gap-2 text-xs">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-charcoal-100 text-charcoal-600 font-medium shrink-0">{i + 1}</span>
                    <span className="text-charcoal-700">{stepTypeLabels[step.type] ?? step.type}</span>
                    {step.type === 'transfer_campaign' && typeof step.config.targetSequenceName === 'string' && step.config.targetSequenceName && (
                      <span className="text-charcoal-500 truncate">→ {step.config.targetSequenceName}</span>
                    )}
                    {step.delayMinutes > 0 && (
                      <span className="text-charcoal-400 shrink-0">
                        +{step.delayMinutes >= 1440 ? `${Math.round(step.delayMinutes / 1440)}d` : `${step.delayMinutes}m`}
                      </span>
                    )}
                  </div>
                ))}
              </div>

              <p className="text-xs text-charcoal-400">
                {c.activeEnrollments} active enrollment{c.activeEnrollments !== 1 ? 's' : ''}
              </p>

              {/* Inline editor */}
              {editingCampaignId === c.id && (
                <div className="border-t border-charcoal-100 pt-4 mt-3">
                  <CampaignBuilder
                    campaignId={c.id}
                    currentCampaignId={c.id}
                    allCampaigns={campaigns}
                    initialData={{
                      name:        c.name,
                      description: c.description ?? '',
                      trigger:     c.trigger as 'new_lead' | 'deal_stage_change' | 'showing_scheduled' | 'manual',
                      steps:       c.steps.map(s => ({
                        order:        s.order,
                        type:         s.type as 'send_email' | 'send_sms' | 'create_task' | 'wait' | 'update_lead_score' | 'transfer_campaign',
                        delayMinutes: s.delayMinutes,
                        config:       s.config as Record<string, string | number>,
                      })),
                    }}
                    onUpdated={() => {
                      setEditingCampaignId(null)
                      refreshCampaigns()
                    }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )

  // ─── Rules tab ──────────────────────────────────────────────────────────────

  const RulesTab = (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button variant="primary" size="sm" leftIcon={<Plus size={14} />}
          onClick={() => setShowNewRule(v => !v)}>
          {showNewRule ? 'Cancel' : 'New Rule'}
        </Button>
      </div>

      {showNewRule && (
        <div className="rounded-xl border border-charcoal-200 bg-white p-5">
          <h3 className="font-semibold text-charcoal-900 mb-4">New Automation Rule</h3>
          <RuleBuilder onCreated={refreshRules} />
        </div>
      )}

      {rules.length === 0 && !showNewRule ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-charcoal-100">
            <Zap size={24} className="text-charcoal-400" />
          </div>
          <h3 className="font-serif text-xl font-bold text-charcoal-900">No Rules Yet</h3>
          <p className="text-charcoal-400 max-w-sm text-sm">Rules fire instantly when events occur — assign tasks, send messages, change stages.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {rules.map(r => (
            <div key={r.id} className="flex items-center gap-4 rounded-xl border border-charcoal-200 bg-white p-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-semibold text-charcoal-900 text-sm">{r.name}</span>
                  <Badge variant={r.isActive ? 'success' : 'default'} className="text-xs">{r.isActive ? 'Active' : 'Off'}</Badge>
                </div>
                <p className="text-xs text-charcoal-400 capitalize">
                  Trigger: {r.trigger.replace(/_/g, ' ')} · {r.runCount} runs
                  {r.lastRunAt && ` · Last: ${formatDate(new Date(r.lastRunAt), { month: 'short', day: 'numeric' })}`}
                </p>
              </div>
              <button onClick={() => toggleRule(r.id, r.isActive)}
                className="text-charcoal-400 hover:text-charcoal-700" title="Toggle">
                {r.isActive ? <ToggleRight size={22} className="text-green-600" /> : <ToggleLeft size={22} />}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  // ─── Job Queue tab ───────────────────────────────────────────────────────────

  const statusIcon: Record<string, React.ReactNode> = {
    pending:   <Clock        size={14} className="text-amber-500" />,
    running:   <Play         size={14} className="text-blue-500" />,
    completed: <CheckCircle  size={14} className="text-green-500" />,
    failed:    <XCircle      size={14} className="text-red-500" />,
  }

  const QueueTab = (
    <div className="flex flex-col gap-4">
      {/* Stats + trigger */}
      <div className="flex items-center gap-4">
        <div className="flex gap-6 flex-1">
          <div className="text-center">
            <p className="text-2xl font-bold text-charcoal-900">{jobStats.pending}</p>
            <p className="text-xs text-charcoal-500">Pending</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-red-600">{jobStats.failed}</p>
            <p className="text-xs text-charcoal-500">Failed</p>
          </div>
        </div>
        <Button variant="primary" size="sm" loading={processing} leftIcon={<Play size={14} />}
          onClick={processJobs}>
          Process Now
        </Button>
      </div>

      {/* Job list */}
      {jobStats.jobs.length === 0 ? (
        <p className="text-sm text-charcoal-400 text-center py-8">No pending or failed jobs.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {jobStats.jobs.map(job => (
            <div key={job.id} className="flex items-center gap-3 rounded-lg border border-charcoal-100 bg-white px-4 py-2.5">
              <div className="shrink-0">{statusIcon[job.status] ?? statusIcon.pending}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-charcoal-900 capitalize">{job.type.replace(/_/g, ' ')}</p>
                {job.error && <p className="text-xs text-red-500 truncate">{job.error}</p>}
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-charcoal-400">
                  {formatDate(new Date(job.runAt), { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                </p>
                <p className="text-xs text-charcoal-400">{job.attempts} attempt{job.attempts !== 1 ? 's' : ''}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  // ─── Special Events tab ────────────────────────────────────────────────────

  const specialEventScheduleLabel = (step: CampaignStep): string => {
    const cfg        = step.config as Record<string, unknown>
    const type       = scheduleTypeLabels[cfg.scheduleType as string] ?? 'Event'
    const offset     = (cfg.offsetDays as number) ?? 0
    const absOffset  = Math.abs(offset)
    if (offset === 0) return `On ${type}`
    if (offset < 0)   return `${absOffset}d before ${type}`
    return `${absOffset}d after ${type}`
  }

  const SpecialEventsTab = (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button variant="primary" size="sm" leftIcon={<Plus size={14} />}
          onClick={() => setShowNewSpecialEvent(v => !v)}>
          {showNewSpecialEvent ? 'Cancel' : 'New Special Event'}
        </Button>
      </div>

      {showNewSpecialEvent && (
        <div className="rounded-xl border border-charcoal-200 bg-white p-5">
          <h3 className="font-semibold text-charcoal-900 mb-4">New Special Event Campaign</h3>
          <SpecialEventBuilder onCreated={refreshSpecialEvents} />
        </div>
      )}

      {specialEvents.length === 0 && !showNewSpecialEvent ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-charcoal-100">
            <Zap size={24} className="text-charcoal-400" />
          </div>
          <h3 className="font-serif text-xl font-bold text-charcoal-900">No Special Events Yet</h3>
          <p className="text-charcoal-400 max-w-sm text-sm">
            Send messages on birthdays, deal anniversaries, or fixed dates like holidays.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {specialEvents.map(c => (
            <div key={c.id} className="rounded-xl border border-charcoal-200 bg-white p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-charcoal-900">{c.name}</h3>
                  {c.description && <p className="text-xs text-charcoal-400 mt-0.5">{c.description}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={c.isActive ? 'success' : 'default'}>{c.isActive ? 'Active' : 'Paused'}</Badge>
                  <button
                    onClick={() => setEditingEventId(editingEventId === c.id ? null : c.id)}
                    className="text-charcoal-400 hover:text-charcoal-700" title="Edit">
                    {editingEventId === c.id ? <X size={16} /> : <Pencil size={16} />}
                  </button>
                  <button onClick={() => toggleSpecialEvent(c.id, c.isActive)}
                    className="text-charcoal-400 hover:text-charcoal-700" title="Toggle">
                    {c.isActive ? <ToggleRight size={20} className="text-green-600" /> : <ToggleLeft size={20} />}
                  </button>
                </div>
              </div>

              {/* Steps preview */}
              <div className="flex flex-col gap-1.5 border-t border-charcoal-100 pt-3 mb-3">
                {c.steps.map((step, i) => (
                  <div key={step.id} className="flex items-center gap-2 text-xs">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-charcoal-100 text-charcoal-600 font-medium shrink-0">{i + 1}</span>
                    <span className="text-charcoal-700">{stepTypeLabels[step.type] ?? step.type}</span>
                    <span className="text-charcoal-400 truncate">· {specialEventScheduleLabel(step)}</span>
                  </div>
                ))}
              </div>

              <p className="text-xs text-charcoal-400">
                {c.activeEnrollments} active enrollment{c.activeEnrollments !== 1 ? 's' : ''}
              </p>

              {editingEventId === c.id && (
                <div className="border-t border-charcoal-100 pt-4 mt-3">
                  <SpecialEventBuilder
                    campaignId={c.id}
                    initialData={{
                      name:        c.name,
                      description: c.description ?? '',
                      steps: c.steps.map(s => ({
                        order:        s.order,
                        type:         s.type as 'send_email' | 'send_sms' | 'create_task' | 'update_lead_score',
                        delayMinutes: s.delayMinutes,
                        config:       s.config as Record<string, string | number>,
                      })),
                    }}
                    onUpdated={() => {
                      setEditingEventId(null)
                      refreshSpecialEvents()
                    }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )

  return (
    <Tabs tabs={[
      { id: 'campaigns',      label: `Drip Campaigns (${campaigns.length})`,     content: CampaignsTab },
      { id: 'special_events', label: `Special Events (${specialEvents.length})`, content: SpecialEventsTab },
      { id: 'rules',          label: `Automation Rules (${rules.length})`,       content: RulesTab },
      { id: 'queue',          label: `Job Queue (${jobStats.pending} pending)`,  content: QueueTab },
    ]} />
  )
}
