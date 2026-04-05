'use client'

/**
 * CampaignBuilder
 *
 * Modal-style form for creating or editing a drip campaign with a variable
 * number of steps. Each step defines channel, delay (minutes or days), and content.
 */

import { useState, useRef, useEffect } from 'react'
import { Plus, Trash2, ChevronUp, ChevronDown, Zap, Save, Paperclip, X } from 'lucide-react'
import { Button } from '@/components/ui'
import { MergeTagPicker } from './MergeTagPicker'
import { FilePicker } from '@/components/admin/FilePicker'

type StepType    = 'send_email' | 'send_sms' | 'create_task' | 'wait' | 'update_lead_score' | 'transfer_campaign' | 'send_portal_invite'
type TriggerType = 'new_lead' | 'deal_stage_change' | 'showing_scheduled' | 'manual'
type DelayUnit   = 'minutes' | 'days'

interface CampaignSummary {
  id:    string
  name:  string
  steps: Array<{ order: number; type: string }>
}

interface StepForm {
  order:        number
  type:         StepType
  delayMinutes: number
  delayUnit:    DelayUnit
  config:       Record<string, string | number>
}

interface TagOption {
  id:    string
  name:  string
  color: string
}

interface TaskTypeOption {
  id:    string
  name:  string
  color: string
}

interface EmailTemplateOption {
  id:      string
  name:    string
  subject: string
  body:    string
}

interface InitialCampaignData {
  name:          string
  description:   string
  trigger:       TriggerType
  triggerTagId?: string | null
  steps: Array<{
    order:        number
    type:         StepType
    delayMinutes: number
    config:       Record<string, string | number>
  }>
}

interface CampaignBuilderProps {
  /** Called after a successful create */
  onCreated?:        () => void
  /** Called after a successful update (edit mode) */
  onUpdated?:        () => void
  /** When provided, the form operates in edit mode */
  campaignId?:       string
  /** Pre-filled data for edit mode */
  initialData?:      InitialCampaignData
  /** All campaigns available for transfer steps (should exclude self) */
  allCampaigns?:     CampaignSummary[]
  /** Id of the campaign being edited — used to exclude self from transfer targets */
  currentCampaignId?: string
}

const STEP_LABELS: Record<StepType, string> = {
  send_email:          'Send Email',
  send_sms:            'Send SMS',
  create_task:         'Create Task',
  wait:                'Wait / Delay',
  update_lead_score:   'Update Lead Score',
  transfer_campaign:   'Transfer to Campaign',
  send_portal_invite:  'Send Portal Invite',
}

/** Built-in task types that always appear even if the DB is empty */
const BUILTIN_TASK_TYPES: TaskTypeOption[] = [
  { id: 'builtin_call',             name: 'Call',             color: '#3b82f6' },
  { id: 'builtin_meeting',          name: 'Meeting',          color: '#8b5cf6' },
  { id: 'builtin_email',            name: 'Email',            color: '#10b981' },
  { id: 'builtin_followup',         name: 'Follow-Up',        color: '#f59e0b' },
  { id: 'builtin_showing',          name: 'Property Showing', color: '#ef4444' },
  { id: 'builtin_document_review',  name: 'Document Review',  color: '#6366f1' },
  { id: 'builtin_offer_prep',       name: 'Offer Prep',       color: '#ec4899' },
  { id: 'builtin_contract_review',  name: 'Contract Review',  color: '#14b8a6' },
  { id: 'builtin_todo',             name: 'To-Do',            color: '#64748b' },
]

/** Encode a task-type-specific step as a synthetic selector value */
function taskStepValue(taskTypeId: string) { return `create_task::${taskTypeId}` }

/** Get the value the step-type <select> should show for a given step */
function stepSelectValue(step: StepForm): string {
  if (step.type === 'create_task' && step.config.taskTypeId) {
    return taskStepValue(step.config.taskTypeId as string)
  }
  return step.type
}


const TRIGGER_LABELS: Record<TriggerType, string> = {
  new_lead:           'New Lead Created',
  deal_stage_change:  'Deal Stage Changed',
  showing_scheduled:  'Showing Scheduled',
  manual:             'Manual Enrollment',
}

function defaultConfig(type: StepType): Record<string, string | number> {
  switch (type) {
    case 'send_email':        return { subject: '', body: '', templateId: '' }
    case 'send_sms':          return { body: '' }
    case 'create_task':       return { title: '', description: '', priority: 'normal', taskTypeId: '' }
    case 'wait':              return {}
    case 'update_lead_score': return { delta: 5 }
    case 'transfer_campaign':  return { targetSequenceId: '', targetSequenceName: '', startAtStep: 0 }
    case 'send_portal_invite': return {}
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

export function CampaignBuilder({ onCreated, onUpdated, campaignId, initialData, allCampaigns, currentCampaignId }: CampaignBuilderProps) {
  const isEditMode = Boolean(campaignId)

  const [name,          setName]          = useState(initialData?.name        ?? '')
  const [description,   setDescription]   = useState(initialData?.description ?? '')
  const [trigger,       setTrigger]       = useState<TriggerType>(initialData?.trigger ?? 'new_lead')
  const [triggerTagId,  setTriggerTagId]  = useState<string>(initialData?.triggerTagId ?? '')
  const [tags,          setTags]          = useState<TagOption[]>([])
  const [taskTypes,     setTaskTypes]     = useState<TaskTypeOption[]>([])
  const [templates,     setTemplates]     = useState<EmailTemplateOption[]>([])
  const [steps,         setSteps]         = useState<StepForm[]>(
    initialData?.steps?.length
      ? initialData.steps.map(initialStepForm)
      : [{ order: 0, type: 'send_email', delayMinutes: 0, delayUnit: 'minutes', config: defaultConfig('send_email') }]
  )
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  useEffect(() => {
    fetch('/api/tags').then(r => r.json()).then(d => setTags(d.data ?? [])).catch(() => {})
    fetch('/api/task-types').then(r => r.json()).then(d => setTaskTypes(d.data ?? [])).catch(() => {})
    fetch('/api/email-templates')
      .then(r => r.json())
      .then(d => setTemplates(
        (d.data ?? [])
          .filter((t: { isActive: boolean; id: string; name: string; subject: string; body: string }) => t.isActive)
          .sort((a: EmailTemplateOption, b: EmailTemplateOption) => a.name.localeCompare(b.name))
      ))
      .catch(() => {})
  }, [])

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

  /** Handle the step-type selector — decomposes synthetic create_task::<id> values */
  function handleStepTypeChange(index: number, value: string) {
    if (value.startsWith('create_task::')) {
      const taskTypeId = value.slice('create_task::'.length)
      setSteps(prev => prev.map((s, i) =>
        i !== index
          ? s
          : { ...s, type: 'create_task', config: { ...defaultConfig('create_task'), taskTypeId } }
      ))
    } else {
      updateStep(index, { type: value as StepType })
    }
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
      const apiSteps = steps.map(s => ({ order: s.order, type: s.type, delayMinutes: s.delayMinutes, config: s.config }))

      const url    = isEditMode ? `/api/campaigns/${campaignId}` : '/api/campaigns'
      const method = isEditMode ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name, description, trigger, triggerTagId: triggerTagId || null, steps: apiSteps }),
      })
      if (!res.ok) {
        let message = `Failed to ${isEditMode ? 'update' : 'create'} campaign`
        try {
          const json = await res.json()
          if (json.error) message = typeof json.error === 'string' ? json.error : JSON.stringify(json.error)
        } catch { /* response body was empty or not JSON */ }
        throw new Error(message)
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
          <label className="text-xs text-charcoal-500 mb-1 block">
            Tag Filter
            <span className="ml-1 text-charcoal-400 font-normal">(optional)</span>
          </label>
          <select
            value={triggerTagId}
            onChange={e => setTriggerTagId(e.target.value)}
            disabled={trigger === 'manual'}
            className="w-full rounded-lg border border-charcoal-200 bg-white px-3 py-1.5 text-sm text-charcoal-900 focus:outline-none focus:ring-2 focus:ring-charcoal-900 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <option value="">Any contact</option>
            {tags.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          {trigger === 'manual' && (
            <p className="text-xs text-charcoal-400 mt-1">Not applicable for manual enrollment</p>
          )}
        </div>
        <div className="col-span-2">
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
                <select
                  value={stepSelectValue(step)}
                  onChange={e => handleStepTypeChange(i, e.target.value)}
                  className="flex-1 rounded-lg border border-charcoal-200 bg-white px-2 py-1 text-sm text-charcoal-900 focus:outline-none focus:ring-2 focus:ring-charcoal-900">
                  <option value="send_email">Send Email</option>
                  <option value="send_sms">Send SMS</option>
                  <optgroup label="Create Task">
                    <option value="create_task">Generic / Miscellaneous</option>
                    {BUILTIN_TASK_TYPES.map(tt => (
                      <option key={tt.id} value={taskStepValue(tt.id)}>{tt.name}</option>
                    ))}
                    {taskTypes
                      .filter(tt => !BUILTIN_TASK_TYPES.some(b => b.name.toLowerCase() === tt.name.toLowerCase()))
                      .map(tt => (
                        <option key={tt.id} value={taskStepValue(tt.id)}>{tt.name}</option>
                      ))}
                  </optgroup>
                  <option value="wait">Wait / Delay</option>
                  <option value="update_lead_score">Update Lead Score</option>
                  <option value="transfer_campaign">Transfer to Campaign</option>
                  <option value="send_portal_invite">Send Portal Invite</option>
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
              <StepConfig
                type={step.type}
                config={step.config}
                onChange={(k, v) => updateConfig(i, k, v)}
                allCampaigns={allCampaigns}
                currentCampaignId={campaignId ?? currentCampaignId}
                templates={templates}
              />
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

function StepConfig({ type, config, onChange, allCampaigns, currentCampaignId, templates }: {
  type:               StepType
  config:             Record<string, string | number>
  onChange:           (key: string, value: string | number) => void
  allCampaigns?:      CampaignSummary[]
  currentCampaignId?: string
  templates?:         EmailTemplateOption[]
}) {
  const [showPicker, setShowPicker] = useState(false)
  const bodyRef = useRef<HTMLTextAreaElement>(null)
  const inputCls = 'w-full rounded-lg border border-charcoal-200 bg-white px-2 py-1 text-sm text-charcoal-900 placeholder:text-charcoal-400 focus:outline-none focus:ring-2 focus:ring-charcoal-900'

  function clearAttachment() {
    onChange('attachmentUrl',  '')
    onChange('attachmentName', '')
  }

  switch (type) {
    case 'send_email': {
      const activeTemplates = templates ?? []
      return (
        <div className="flex flex-col gap-2">
          {activeTemplates.length > 0 && (
            <select
              value={config.templateId as string || ''}
              onChange={e => {
                const tpl = activeTemplates.find(t => t.id === e.target.value)
                if (tpl) {
                  onChange('templateId', tpl.id)
                  onChange('subject',    tpl.subject)
                  onChange('body',       tpl.body)
                } else {
                  onChange('templateId', '')
                }
              }}
              className="w-full rounded-lg border border-charcoal-200 bg-white px-2 py-1 text-sm text-charcoal-900 focus:outline-none focus:ring-2 focus:ring-charcoal-900"
            >
              <option value="">— Load from template —</option>
              {activeTemplates.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          )}
          <input type="text" placeholder="Email subject" value={config.subject as string}
            onChange={e => onChange('subject', e.target.value)} className={inputCls} />
          <MergeTagPicker textareaRef={bodyRef} value={config.body as string} onChange={v => onChange('body', v)} />
          <textarea ref={bodyRef} placeholder="Email body (HTML allowed)" rows={3} value={config.body as string}
            onChange={e => onChange('body', e.target.value)}
            className={`${inputCls} resize-none font-mono`} />

          {/* Attachment */}
          {config.attachmentName ? (
            <div className="flex items-center gap-2 text-xs text-charcoal-700">
              <Paperclip size={11} className="text-charcoal-400 shrink-0" />
              <span className="truncate flex-1">{config.attachmentName as string}</span>
              <button type="button" onClick={clearAttachment} className="text-charcoal-400 hover:text-red-500 transition-colors">
                <X size={12} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowPicker(true)}
              className="flex items-center gap-1.5 text-xs text-charcoal-500 hover:text-charcoal-800 transition-colors"
            >
              <Paperclip size={13} />
              Attach a file
            </button>
          )}

          {showPicker && (
            <FilePicker
              multiple={false}
              onSelect={([picked]) => {
                if (picked) {
                  onChange('attachmentUrl',  picked.url)
                  onChange('attachmentName', picked.name)
                }
                setShowPicker(false)
              }}
              onClose={() => setShowPicker(false)}
            />
          )}
        </div>
      )
    }
    case 'send_sms':
      return (
        <div className="flex flex-col gap-2">
          <MergeTagPicker textareaRef={bodyRef} value={config.body as string} onChange={v => onChange('body', v)} />
          <textarea ref={bodyRef} placeholder="SMS message" rows={2} value={config.body as string}
            onChange={e => onChange('body', e.target.value)}
            className={`${inputCls} resize-none`} />
        </div>
      )
    case 'create_task':
      return (
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <input type="text" placeholder="Task title" value={config.title as string}
              onChange={e => onChange('title', e.target.value)} className={`${inputCls} flex-1`} />
            <select value={config.priority as string} onChange={e => onChange('priority', e.target.value)}
              className={`${inputCls} w-28`}>
              {['low', 'normal', 'high', 'urgent'].map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <textarea placeholder="Description (optional)" rows={2} value={(config.description ?? '') as string}
            onChange={e => onChange('description', e.target.value)}
            className={`${inputCls} resize-none`} />
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

    case 'send_portal_invite':
      return (
        <p className="text-xs text-charcoal-400">
          Sends the contact a portal registration invitation by email so they can log in and browse MLS listings.
          Skipped automatically if the contact has no email or already has an active portal account.
        </p>
      )

    case 'transfer_campaign': {
      const available = (allCampaigns ?? []).filter(c => c.id !== currentCampaignId)
      const selected  = available.find(c => c.id === (config.targetSequenceId as string))
      return (
        <div className="flex flex-col gap-2">
          {available.length === 0 ? (
            <p className="text-xs text-charcoal-400 italic">No other campaigns exist yet. Create another campaign first.</p>
          ) : (
            <>
              <select
                value={config.targetSequenceId as string}
                onChange={e => {
                  const target = available.find(c => c.id === e.target.value)
                  onChange('targetSequenceId',  e.target.value)
                  onChange('targetSequenceName', target?.name ?? '')
                  onChange('startAtStep', 0)
                }}
                className={inputCls}
              >
                <option value="">— Select target campaign —</option>
                {available.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>

              {selected && selected.steps.length > 0 && (
                <div className="flex items-center gap-2">
                  <label className="text-xs text-charcoal-500 shrink-0">Start at step</label>
                  <select
                    value={config.startAtStep as number}
                    onChange={e => onChange('startAtStep', parseInt(e.target.value))}
                    className={`${inputCls} w-auto`}
                  >
                    {selected.steps.map((s, idx) => (
                      <option key={idx} value={idx}>
                        Step {idx + 1} — {STEP_LABELS[s.type as StepType] ?? s.type.replace('create_task::', 'Create Task: ')}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {selected && (
                <p className="text-xs text-charcoal-400">
                  Contact will be moved out of this campaign and enrolled in &quot;{selected.name}&quot;.
                </p>
              )}
            </>
          )}
        </div>
      )
    }

    default:
      return null
  }
}
