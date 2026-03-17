'use client'

/**
 * SpecialEventBuilder
 *
 * Creates / edits a "special_event" campaign where each step fires on a
 * date anchored to a contact-specific event:
 *
 *   • Contact's Birthday           — annual, e.g. 7 days before
 *   • Anniversary of Last Deal     — annual, on the closing anniversary
 *   • Fixed Calendar Date          — annual, e.g. Dec 25 (Christmas)
 *
 * Steps are NOT sequential delays — each step has its own independent
 * date anchor and offset.  delayMinutes is stored as 0 and ignored.
 */

import { useState, useRef } from 'react'
import { Plus, Trash2, Save, Star, Paperclip, X } from 'lucide-react'
import { Button } from '@/components/ui'
import { MergeTagPicker } from './MergeTagPicker'

// ── Types ──────────────────────────────────────────────────────────────────────

type ActionType    = 'send_email' | 'send_sms' | 'create_task' | 'update_lead_score'
type ScheduleType  = 'contact_birthday' | 'last_deal_closed' | 'fixed_date'

interface EventStep {
  order:        number
  type:         ActionType
  scheduleType: ScheduleType
  offsetDays:   number         // negative = before, positive = after, 0 = on the day
  fixedMonth:   number         // 1-12, only relevant for fixed_date
  fixedDay:     number         // 1-31, only relevant for fixed_date
  config:       Record<string, string | number>
}

interface InitialData {
  name:        string
  description: string
  steps: Array<{
    order:        number
    type:         ActionType
    delayMinutes: number
    config:       Record<string, string | number>
  }>
}

interface Props {
  onCreated?:  () => void
  onUpdated?:  () => void
  campaignId?: string
  initialData?: InitialData
}

// ── Constants ──────────────────────────────────────────────────────────────────

const ACTION_LABELS: Record<ActionType, string> = {
  send_email:        'Send Email',
  send_sms:          'Send SMS',
  create_task:       'Call',
  update_lead_score: 'Update Lead Score',
}

const SCHEDULE_LABELS: Record<ScheduleType, string> = {
  contact_birthday: "Contact's Birthday",
  last_deal_closed: 'Anniversary of Last Closed Deal',
  fixed_date:       'Fixed Calendar Date',
}

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

function daysInMonth(month: number): number {
  // month is 1-indexed; use a non-leap year for simplicity
  return new Date(2001, month, 0).getDate()
}

function defaultConfig(type: ActionType): Record<string, string | number> {
  switch (type) {
    case 'send_email':        return { subject: '', body: '' }
    case 'send_sms':          return { body: '' }
    case 'create_task':       return { title: '', priority: 'normal' }
    case 'update_lead_score': return { delta: 5 }
  }
}

function parseExistingStep(s: InitialData['steps'][number]): EventStep {
  const cfg = s.config as Record<string, unknown>
  return {
    order:        s.order,
    type:         s.type as ActionType,
    scheduleType: (cfg.scheduleType as ScheduleType) ?? 'contact_birthday',
    offsetDays:   (cfg.offsetDays   as number) ?? 0,
    fixedMonth:   (cfg.fixedMonth   as number) ?? 12,
    fixedDay:     (cfg.fixedDay     as number) ?? 25,
    config:       s.config,
  }
}

function emptyStep(order: number): EventStep {
  return {
    order,
    type:         'send_email',
    scheduleType: 'contact_birthday',
    offsetDays:   0,
    fixedMonth:   12,
    fixedDay:     25,
    config:       defaultConfig('send_email'),
  }
}

// ── Step action config inputs (same style as CampaignBuilder) ──────────────────

function StepActionConfig({
  step, onChange, onConfigChange,
}: {
  step:           EventStep
  onChange:       (patch: Partial<EventStep>) => void
  onConfigChange: (key: string, value: string | number) => void
}) {
  const [uploading, setUploading]     = useState(false)
  const [uploadError, setUploadError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const bodyRef = useRef<HTMLTextAreaElement>(null)

  const inputCls = 'w-full rounded-lg border border-charcoal-200 bg-white px-2 py-1 text-sm text-charcoal-900 placeholder:text-charcoal-400 focus:outline-none focus:ring-2 focus:ring-charcoal-900'

  async function handleAttachment(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true); setUploadError('')
    try {
      const fd = new FormData(); fd.append('file', file)
      const res = await fetch('/api/uploads', { method: 'POST', body: fd })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Upload failed')
      const { data } = await res.json()
      onConfigChange('attachmentUrl',  data.url)
      onConfigChange('attachmentName', data.originalName)
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false); e.target.value = ''
    }
  }

  switch (step.type) {
    case 'send_email':
      return (
        <div className="flex flex-col gap-2">
          <input className={inputCls} type="text" placeholder="Email subject"
            value={step.config.subject as string}
            onChange={e => onConfigChange('subject', e.target.value)} />
          <MergeTagPicker textareaRef={bodyRef} value={step.config.body as string} onChange={v => onConfigChange('body', v)} />
          <textarea ref={bodyRef} className={`${inputCls} resize-none font-mono`} rows={3}
            placeholder="Email body (HTML allowed)"
            value={step.config.body as string}
            onChange={e => onConfigChange('body', e.target.value)} />
          <input ref={fileRef} type="file" className="hidden" onChange={handleAttachment} />
          {uploadError && <p className="text-xs text-red-500">{uploadError}</p>}
          {step.config.attachmentName ? (
            <div className="flex items-center gap-2 text-xs text-charcoal-700">
              <Paperclip size={11} className="text-charcoal-400 shrink-0" />
              <span className="truncate flex-1">{step.config.attachmentName as string}</span>
              <button type="button" onClick={() => { onConfigChange('attachmentUrl', ''); onConfigChange('attachmentName', '') }}
                className="text-charcoal-400 hover:text-red-500"><X size={12} /></button>
            </div>
          ) : (
            <button type="button" disabled={uploading} onClick={() => fileRef.current?.click()}
              className="flex items-center gap-1.5 text-xs text-charcoal-500 hover:text-charcoal-800 disabled:opacity-50">
              <Paperclip size={13} /> {uploading ? 'Uploading…' : 'Attach a file'}
            </button>
          )}
        </div>
      )
    case 'send_sms':
      return (
        <textarea className={`${inputCls} resize-none`} rows={2} maxLength={160}
          placeholder="SMS message (max 160 chars)"
          value={step.config.body as string}
          onChange={e => onConfigChange('body', e.target.value)} />
      )
    case 'create_task':
      return (
        <div className="flex gap-2">
          <input className={`${inputCls} flex-1`} type="text" placeholder="Task title"
            value={step.config.title as string}
            onChange={e => onConfigChange('title', e.target.value)} />
          <select className={`${inputCls} w-28`} value={step.config.priority as string}
            onChange={e => onConfigChange('priority', e.target.value)}>
            {['low','normal','high','urgent'].map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      )
    case 'update_lead_score':
      return (
        <div className="flex items-center gap-2">
          <label className="text-xs text-charcoal-500 shrink-0">Score delta</label>
          <input className={`${inputCls} w-24`} type="number"
            value={step.config.delta as number}
            onChange={e => onConfigChange('delta', parseInt(e.target.value) || 0)} />
          <span className="text-xs text-charcoal-400">(negative to deduct)</span>
        </div>
      )
  }
}

// ── SpecialEventBuilder ────────────────────────────────────────────────────────

export function SpecialEventBuilder({ onCreated, onUpdated, campaignId, initialData }: Props) {
  const isEdit = Boolean(campaignId)

  const [name,        setName]        = useState(initialData?.name        ?? '')
  const [description, setDescription] = useState(initialData?.description ?? '')
  const [steps,       setSteps]       = useState<EventStep[]>(
    initialData?.steps?.length
      ? initialData.steps.map(parseExistingStep)
      : [emptyStep(0)]
  )
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  function addStep() {
    setSteps(prev => [...prev, emptyStep(prev.length)])
  }

  function removeStep(i: number) {
    setSteps(prev => prev.filter((_, idx) => idx !== i).map((s, idx) => ({ ...s, order: idx })))
  }

  function updateStep(i: number, patch: Partial<EventStep>) {
    setSteps(prev => prev.map((s, idx) => {
      if (idx !== i) return s
      const updated = { ...s, ...patch }
      if (patch.type && patch.type !== s.type) updated.config = defaultConfig(patch.type)
      return updated
    }))
  }

  function updateConfig(i: number, key: string, value: string | number) {
    setSteps(prev => prev.map((s, idx) =>
      idx === i ? { ...s, config: { ...s.config, [key]: value } } : s
    ))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('Campaign name is required'); return }
    if (steps.length === 0) { setError('Add at least one step'); return }
    setSaving(true); setError('')

    try {
      // Merge schedule fields into config before sending
      const apiSteps = steps.map(s => ({
        order:        s.order,
        type:         s.type,
        delayMinutes: 0,
        config: {
          ...s.config,
          scheduleType: s.scheduleType,
          offsetDays:   s.offsetDays,
          ...(s.scheduleType === 'fixed_date' && { fixedMonth: s.fixedMonth, fixedDay: s.fixedDay }),
        },
      }))

      const url    = isEdit ? `/api/campaigns/${campaignId}` : '/api/campaigns'
      const method = isEdit ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, trigger: 'special_event', steps: apiSteps }),
      })

      if (!res.ok) {
        let message = `Failed to ${isEdit ? 'update' : 'create'} campaign`
        try {
          const json = await res.json()
          if (json.error) message = typeof json.error === 'string' ? json.error : JSON.stringify(json.error)
        } catch { /* empty body */ }
        throw new Error(message)
      }

      isEdit ? onUpdated?.() : onCreated?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {/* Metadata */}
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="text-xs text-charcoal-500 mb-1 block">Campaign Name *</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)}
            placeholder="e.g. Birthday & Anniversary Touches"
            className="w-full rounded-lg border border-charcoal-200 bg-white px-3 py-2 text-sm text-charcoal-900 placeholder:text-charcoal-400 focus:outline-none focus:ring-2 focus:ring-charcoal-900" />
        </div>
        <div className="col-span-2">
          <label className="text-xs text-charcoal-500 mb-1 block">Description (optional)</label>
          <input type="text" value={description} onChange={e => setDescription(e.target.value)}
            placeholder="Brief description"
            className="w-full rounded-lg border border-charcoal-200 bg-white px-3 py-2 text-sm text-charcoal-900 placeholder:text-charcoal-400 focus:outline-none focus:ring-2 focus:ring-charcoal-900" />
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

              {/* Row 1: step number + action type + remove */}
              <div className="flex items-center gap-2 mb-3">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-charcoal-200 text-xs font-bold text-charcoal-700 shrink-0">
                  {i + 1}
                </span>
                <select value={step.type}
                  onChange={e => updateStep(i, { type: e.target.value as ActionType })}
                  className="flex-1 rounded-lg border border-charcoal-200 bg-white px-2 py-1 text-sm text-charcoal-900 focus:outline-none focus:ring-2 focus:ring-charcoal-900">
                  {Object.entries(ACTION_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
                <button type="button" onClick={() => removeStep(i)}
                  className="text-red-400 hover:text-red-600 ml-1 shrink-0">
                  <Trash2 size={14} />
                </button>
              </div>

              {/* Row 2: schedule — "Send X days before/after [event]" */}
              <div className="flex flex-wrap items-center gap-2 mb-3 bg-white rounded-lg border border-charcoal-200 px-3 py-2">
                <label className="text-xs text-charcoal-500 shrink-0">Send</label>

                {/* Offset value */}
                <input
                  type="number" min={0}
                  disabled={step.offsetDays === 0}
                  value={step.offsetDays === 0 ? '' : Math.abs(step.offsetDays)}
                  onChange={e => {
                    const abs = parseInt(e.target.value) || 0
                    updateStep(i, { offsetDays: step.offsetDays < 0 ? -abs : abs })
                  }}
                  className="w-14 rounded border border-charcoal-200 bg-charcoal-50 px-2 py-1 text-sm text-charcoal-900 focus:outline-none focus:ring-1 focus:ring-charcoal-900 disabled:opacity-40 disabled:cursor-not-allowed"
                />

                {/* Before / On / After */}
                <select
                  value={step.offsetDays === 0 ? 'on' : step.offsetDays < 0 ? 'before' : 'after'}
                  onChange={e => {
                    const abs = Math.abs(step.offsetDays) || 1
                    if (e.target.value === 'on')     updateStep(i, { offsetDays: 0 })
                    if (e.target.value === 'before') updateStep(i, { offsetDays: -abs })
                    if (e.target.value === 'after')  updateStep(i, { offsetDays:  abs })
                  }}
                  className="rounded border border-charcoal-200 bg-charcoal-50 px-2 py-1 text-sm text-charcoal-900 focus:outline-none focus:ring-1 focus:ring-charcoal-900">
                  <option value="before">days before</option>
                  <option value="on">days on</option>
                  <option value="after">days after</option>
                </select>

                {/* Event type */}
                <select value={step.scheduleType}
                  onChange={e => updateStep(i, { scheduleType: e.target.value as ScheduleType })}
                  className="rounded border border-charcoal-200 bg-charcoal-50 px-2 py-1 text-sm text-charcoal-900 focus:outline-none focus:ring-1 focus:ring-charcoal-900">
                  {Object.entries(SCHEDULE_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>

                {/* Fixed date pickers */}
                {step.scheduleType === 'fixed_date' && (
                  <>
                    <select value={step.fixedMonth}
                      onChange={e => updateStep(i, { fixedMonth: Number(e.target.value), fixedDay: Math.min(step.fixedDay, daysInMonth(Number(e.target.value))) })}
                      className="rounded border border-charcoal-200 bg-charcoal-50 px-2 py-1 text-sm text-charcoal-900 focus:outline-none focus:ring-1 focus:ring-charcoal-900">
                      {MONTHS.map((m, idx) => <option key={idx} value={idx + 1}>{m}</option>)}
                    </select>
                    <select value={step.fixedDay}
                      onChange={e => updateStep(i, { fixedDay: Number(e.target.value) })}
                      className="rounded border border-charcoal-200 bg-charcoal-50 px-2 py-1 text-sm text-charcoal-900 focus:outline-none focus:ring-1 focus:ring-charcoal-900">
                      {Array.from({ length: daysInMonth(step.fixedMonth) }, (_, d) => (
                        <option key={d + 1} value={d + 1}>{d + 1}</option>
                      ))}
                    </select>
                  </>
                )}
              </div>

              {/* Row 3: action content */}
              <StepActionConfig
                step={step}
                onChange={patch => updateStep(i, patch)}
                onConfigChange={(k, v) => updateConfig(i, k, v)}
              />
            </div>
          ))}
        </div>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <Button type="submit" variant="primary" loading={saving}
        leftIcon={isEdit ? <Save size={14} /> : <Star size={14} />}>
        {isEdit ? 'Save Changes' : 'Create Special Event Campaign'}
      </Button>
    </form>
  )
}
