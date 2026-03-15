'use client'

/**
 * CampaignBuilder
 *
 * Modal-style form for creating or editing a drip campaign with a variable
 * number of steps. Each step defines channel, delay (minutes or days), and content.
 */

import { useState } from 'react'
import { Plus, Trash2, ChevronUp, ChevronDown, Zap, Save } from 'lucide-react'
import { Button } from '@/components/ui'

type StepType   = 'send_email' | 'send_sms' | 'create_task' | 'wait' | 'update_lead_score'
type TriggerType = 'new_lead' | 'deal_stage_change' | 'showing_scheduled' | 'manual'
type DelayUnit  = 'minutes' | 'days'

interface StepForm {
  order:        number
  type:         StepType
  delayMinutes: number
  delayUnit:    DelayUnit
  config:       Record<string, string | number>
}

interface InitialCampaignData {
  name:        string
  description: string
  trigger:     TriggerType
  steps: Array<{
    order:        number
    type:         StepType
    delayMinutes: number
    config:       Record<string, string | number>
  }>
}

interface CampaignBuilderProps {
  /** Called after a successful create */
  onCreated?:   () => void
  /** Called after a successful update (edit mode) */
  onUpdated?:   () => void
  /** When provided, the form operates in edit mode */
  campaignId?:  string
  /** Pre-filled data for edit mode */
  initialData?: InitialCampaignData
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

/** Infer a sensible display unit from a delayMinutes value */
function inferUnit(delayMinutes: number): DelayUnit {
  return delayMinutes > 0 && delayMinutes % 1440 === 0 ? 'days' : 'minutes'
}

function initialStepForm(s: InitialCampaignData['steps'][number]): StepForm {
  return {
    order:        s.order,
    type:         s.type,
    delayMinutes: s.delayMinutes,
    delayUnit:    inferUnit(s.delayMinutes),
    config:       s.config,
  }
}

export function CampaignBuilder({ onCreated, onUpdated, campaignId, initialData }: CampaignBuilderProps) {
  const isEditMode = Boolean(campaignId)

  const [name,        setName]        = useState(initialData?.name        ?? '')
  const [description, setDescription] = useState(initialData?.description ?? '')
  const [trigger,     setTrigger]     = useState<TriggerType>(initialData?.trigger ?? 'new_lead')
  const [steps,       setSteps]       = useState<StepForm[]>(
    initialData?.steps?.length
      ? initialData.steps.map(initialStepForm)
      : [{ order: 0, type: 'send_email', delayMinutes: 0, delayUnit: 'minutes', config: defaultConfig('send_email') }]
  )
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  function addStep() {
    setSteps(prev => [
      ...prev,
      { order: prev.length, type: 'send_email', delayMinutes: 1440, delayUnit: 'days', config: defaultConfig('send_email') },
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

  /** Returns the display value for the delay input given current unit */
  function displayDelay(step: StepForm): number {
    return step.delayUnit === 'days' ? Math.round(step.delayMinutes / 1440) : step.delayMinutes
  }

  function handleDelayChange(index: number, rawValue: string) {
    const val = parseInt(rawValue) || 0
    const step = steps[index]
    updateStep(index, { delayMinutes: step.delayUnit === 'days' ? val * 1440 : val })
  }

  function handleUnitChange(index: number, unit: DelayUnit) {
    // Keep the delayMinutes value as-is; only the display unit changes
    updateStep(index, { delayUnit: unit })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('Name is required'); return }
    setSaving(true)
    setError('')
    try {
      // Strip delayUnit (UI-only) before sending to API
      const apiSteps = steps.map(({ delayUnit: _u, ...s }) => s)

      const url    = isEditMode ? `/api/campaigns/${campaignId}` : '/api/campaigns'
      const method = isEditMode ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name, description, trigger, steps: apiSteps }),
      })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(JSON.stringify(json.error))
      }
      if (isEditMode) {
        onUpdated?.()
      } else {
        onCreated?.()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${isEditMode ? 'update' : 'create'} campaign`)
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

              {/* Delay with unit selector */}
              <div className="flex items-center gap-2 mb-2">
                <label className="text-xs text-charcoal-500 shrink-0">Wait</label>
                <input
                  type="number" min={0}
                  value={displayDelay(step)}
                  onChange={e => handleDelayChange(i, e.target.value)}
                  className="w-20 rounded border border-charcoal-200 bg-white px-2 py-1 text-sm text-charcoal-900 focus:outline-none focus:ring-2 focus:ring-charcoal-900"
                />
                <select
                  value={step.delayUnit}
                  onChange={e => handleUnitChange(i, e.target.value as DelayUnit)}
                  className="rounded border border-charcoal-200 bg-white px-2 py-1 text-sm text-charcoal-900 focus:outline-none focus:ring-2 focus:ring-charcoal-900">
                  <option value="minutes">minutes</option>
                  <option value="days">days</option>
                </select>
                <span className="text-xs text-charcoal-400">before this step</span>
              </div>

              {/* Step-type-specific config */}
              <StepConfig type={step.type} config={step.config}
                onChange={(k, v) => updateConfig(i, k, v)} />
            </div>
          ))}
        </div>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <Button type="submit" variant="primary" loading={saving}
        leftIcon={isEditMode ? <Save size={14} /> : <Zap size={14} />}>
        {isEditMode ? 'Save Changes' : 'Create Campaign'}
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
