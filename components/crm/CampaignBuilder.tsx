'use client'

/**
 * CampaignBuilder
 *
 * Modal-style form for creating a new drip campaign with a variable number
 * of steps. Each step defines channel, delay, and content.
 */

import { useState } from 'react'
import { Plus, Trash2, ChevronUp, ChevronDown, Zap } from 'lucide-react'
import { Button } from '@/components/ui'

type StepType = 'send_email' | 'send_sms' | 'create_task' | 'wait' | 'update_lead_score'
type TriggerType = 'new_lead' | 'deal_stage_change' | 'showing_scheduled' | 'manual'

interface StepForm {
  order:        number
  type:         StepType
  delayMinutes: number
  config:       Record<string, string | number>
}

interface CampaignBuilderProps {
  onCreated?: () => void
}

const STEP_LABELS: Record<StepType, string> = {
  send_email:         'Send Email',
  send_sms:           'Send SMS',
  create_task:        'Create Task',
  wait:               'Wait / Delay',
  update_lead_score:  'Update Lead Score',
}

const TRIGGER_LABELS: Record<TriggerType, string> = {
  new_lead:           'New Lead Created',
  deal_stage_change:  'Deal Stage Changed',
  showing_scheduled:  'Showing Scheduled',
  manual:             'Manual Enrollment',
}

function defaultConfig(type: StepType): Record<string, string | number> {
  switch (type) {
    case 'send_email':        return { subject: '', body: '' }
    case 'send_sms':          return { body: '' }
    case 'create_task':       return { title: '', priority: 'normal' }
    case 'wait':              return {}
    case 'update_lead_score': return { delta: 5 }
  }
}

export function CampaignBuilder({ onCreated }: CampaignBuilderProps) {
  const [name,        setName]        = useState('')
  const [description, setDescription] = useState('')
  const [trigger,     setTrigger]     = useState<TriggerType>('new_lead')
  const [steps,       setSteps]       = useState<StepForm[]>([
    { order: 0, type: 'send_email', delayMinutes: 0, config: defaultConfig('send_email') },
  ])
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  function addStep() {
    setSteps(prev => [
      ...prev,
      { order: prev.length, type: 'send_email', delayMinutes: 1440, config: defaultConfig('send_email') },
    ])
  }

  function removeStep(index: number) {
    setSteps(prev => prev.filter((_, i) => i !== index).map((s, i) => ({ ...s, order: i })))
  }

  function moveStep(index: number, dir: -1 | 1) {
    const next = [...steps]
    const swap = index + dir
    if (swap < 0 || swap >= next.length) return
    ;[next[index], next[swap]] = [next[swap], next[index]]
    setSteps(next.map((s, i) => ({ ...s, order: i })))
  }

  function updateStep(index: number, patch: Partial<StepForm>) {
    setSteps(prev => prev.map((s, i) => {
      if (i !== index) return s
      const updated = { ...s, ...patch }
      // Reset config when type changes
      if (patch.type && patch.type !== s.type) updated.config = defaultConfig(patch.type)
      return updated
    }))
  }

  function updateConfig(index: number, key: string, value: string | number) {
    setSteps(prev => prev.map((s, i) =>
      i === index ? { ...s, config: { ...s.config, [key]: value } } : s,
    ))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('Name is required'); return }
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/campaigns', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name, description, trigger, steps }),
      })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(JSON.stringify(json.error))
      }
      onCreated?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create campaign')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {/* Campaign metadata */}
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="text-xs text-charcoal-500 mb-1 block">Campaign Name *</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)}
            placeholder="e.g. New Buyer Welcome Series"
            className="w-full rounded-lg border border-charcoal-200 bg-white px-3 py-2 text-sm text-charcoal-900 placeholder:text-charcoal-400 focus:outline-none focus:ring-2 focus:ring-charcoal-900"
          />
        </div>
        <div>
          <label className="text-xs text-charcoal-500 mb-1 block">Trigger</label>
          <select value={trigger} onChange={e => setTrigger(e.target.value as TriggerType)}
            className="w-full rounded-lg border border-charcoal-200 bg-white px-3 py-1.5 text-sm text-charcoal-900 focus:outline-none focus:ring-2 focus:ring-charcoal-900">
            {Object.entries(TRIGGER_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-charcoal-500 mb-1 block">Description (optional)</label>
          <input type="text" value={description} onChange={e => setDescription(e.target.value)}
            placeholder="Brief description"
            className="w-full rounded-lg border border-charcoal-200 bg-white px-3 py-2 text-sm text-charcoal-900 placeholder:text-charcoal-400 focus:outline-none focus:ring-2 focus:ring-charcoal-900"
          />
        </div>
      </div>

      {/* Steps */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-charcoal-700 uppercase tracking-wide">Steps</p>
          <button type="button" onClick={addStep}
            className="flex items-center gap-1 text-xs text-gold-600 hover:text-gold-700 font-medium">
            <Plus size={12} /> Add Step
          </button>
        </div>

        <div className="flex flex-col gap-3">
          {steps.map((step, i) => (
            <div key={i} className="rounded-xl border border-charcoal-200 bg-charcoal-50 p-3">
              <div className="flex items-center gap-2 mb-3">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-charcoal-200 text-xs font-bold text-charcoal-700">
                  {i + 1}
                </span>
                <select value={step.type}
                  onChange={e => updateStep(i, { type: e.target.value as StepType })}
                  className="flex-1 rounded-lg border border-charcoal-200 bg-white px-2 py-1 text-sm text-charcoal-900 focus:outline-none focus:ring-2 focus:ring-charcoal-900">
                  {Object.entries(STEP_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
                <div className="flex items-center gap-1 shrink-0">
                  <button type="button" onClick={() => moveStep(i, -1)} disabled={i === 0}
                    className="text-charcoal-400 hover:text-charcoal-700 disabled:opacity-30">
                    <ChevronUp size={14} />
                  </button>
                  <button type="button" onClick={() => moveStep(i, 1)} disabled={i === steps.length - 1}
                    className="text-charcoal-400 hover:text-charcoal-700 disabled:opacity-30">
                    <ChevronDown size={14} />
                  </button>
                  <button type="button" onClick={() => removeStep(i)}
                    className="text-red-400 hover:text-red-600 ml-1">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {/* Delay */}
              <div className="flex items-center gap-2 mb-2">
                <label className="text-xs text-charcoal-500 shrink-0">Wait</label>
                <input type="number" min={0} value={step.delayMinutes}
                  onChange={e => updateStep(i, { delayMinutes: parseInt(e.target.value) || 0 })}
                  className="w-20 rounded border border-charcoal-200 bg-white px-2 py-1 text-sm text-charcoal-900 focus:outline-none focus:ring-2 focus:ring-charcoal-900"
                />
                <span className="text-xs text-charcoal-400">minutes before this step</span>
              </div>

              {/* Step-type-specific config */}
              <StepConfig type={step.type} config={step.config}
                onChange={(k, v) => updateConfig(i, k, v)} />
            </div>
          ))}
        </div>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <Button type="submit" variant="primary" loading={saving} leftIcon={<Zap size={14} />}>
        Create Campaign
      </Button>
    </form>
  )
}

function StepConfig({ type, config, onChange }: {
  type:     StepType
  config:   Record<string, string | number>
  onChange: (key: string, value: string | number) => void
}) {
  const inputCls = 'w-full rounded-lg border border-charcoal-200 bg-white px-2 py-1 text-sm text-charcoal-900 placeholder:text-charcoal-400 focus:outline-none focus:ring-2 focus:ring-charcoal-900'

  switch (type) {
    case 'send_email':
      return (
        <div className="flex flex-col gap-2">
          <input type="text" placeholder="Email subject" value={config.subject as string}
            onChange={e => onChange('subject', e.target.value)} className={inputCls} />
          <textarea placeholder="Email body (HTML allowed)" rows={3} value={config.body as string}
            onChange={e => onChange('body', e.target.value)}
            className={`${inputCls} resize-none font-mono`} />
        </div>
      )
    case 'send_sms':
      return (
        <textarea placeholder="SMS message (max 160 chars)" rows={2} value={config.body as string}
          onChange={e => onChange('body', e.target.value)}
          className={`${inputCls} resize-none`} maxLength={160} />
      )
    case 'create_task':
      return (
        <div className="flex gap-2">
          <input type="text" placeholder="Task title" value={config.title as string}
            onChange={e => onChange('title', e.target.value)} className={`${inputCls} flex-1`} />
          <select value={config.priority as string} onChange={e => onChange('priority', e.target.value)}
            className={`${inputCls} w-28`}>
            {['low', 'normal', 'high', 'urgent'].map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      )
    case 'update_lead_score':
      return (
        <div className="flex items-center gap-2">
          <label className="text-xs text-charcoal-500 shrink-0">Score delta</label>
          <input type="number" value={config.delta as number}
            onChange={e => onChange('delta', parseInt(e.target.value) || 0)}
            className={`${inputCls} w-24`} />
          <span className="text-xs text-charcoal-400">(use negative to deduct)</span>
        </div>
      )
    case 'wait':
      return <p className="text-xs text-charcoal-400">This step pauses the sequence for the delay above.</p>
    default:
      return null
  }
}
