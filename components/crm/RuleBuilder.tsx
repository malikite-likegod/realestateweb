'use client'

/**
 * RuleBuilder
 *
 * Form for creating a new event-triggered automation rule.
 * Rules fire immediately (not on a schedule) when the chosen trigger occurs
 * and the optional conditions are satisfied.
 */

import { useState } from 'react'
import { Plus, Trash2, Zap } from 'lucide-react'
import { Button } from '@/components/ui'

type TriggerType = 'new_lead' | 'deal_stage_changed' | 'lead_inactive' | 'listing_viewed' | 'manual'
type ActionType  = 'send_email' | 'send_sms' | 'assign_task' | 'change_stage' | 'enroll_campaign' | 'update_score'

const TRIGGER_LABELS: Record<TriggerType, string> = {
  new_lead:          'New Lead Created',
  deal_stage_changed: 'Deal Stage Changed',
  lead_inactive:     'Lead Inactive (N days)',
  listing_viewed:    'Listing Viewed',
  manual:            'Manual Trigger',
}

const ACTION_LABELS: Record<ActionType, string> = {
  send_email:      'Send Email',
  send_sms:        'Send SMS',
  assign_task:     'Create Task',
  change_stage:    'Change Pipeline Stage',
  enroll_campaign: 'Enroll in Campaign',
  update_score:    'Update Lead Score',
}

interface ActionForm { type: ActionType; [key: string]: string | number }

interface RuleBuilderProps { onCreated?: () => void }

function defaultAction(type: ActionType): ActionForm {
  switch (type) {
    case 'send_email':      return { type, templateId: '', subject: '', body: '' }
    case 'send_sms':        return { type, body: '' }
    case 'assign_task':     return { type, title: '', priority: 'normal' }
    case 'change_stage':    return { type, stageId: '' }
    case 'enroll_campaign': return { type, sequenceId: '' }
    case 'update_score':    return { type, delta: 10, reason: '' }
  }
}

export function RuleBuilder({ onCreated }: RuleBuilderProps) {
  const [name,    setName]    = useState('')
  const [trigger, setTrigger] = useState<TriggerType>('new_lead')
  const [actions, setActions] = useState<ActionForm[]>([defaultAction('assign_task')])
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState('')

  function addAction() {
    setActions(prev => [...prev, defaultAction('send_sms')])
  }

  function removeAction(i: number) {
    setActions(prev => prev.filter((_, idx) => idx !== i))
  }

  function updateAction(i: number, patch: Partial<ActionForm>) {
    setActions(prev => prev.map((a, idx) => {
      if (idx !== i) return a
      if (patch.type && patch.type !== a.type) return defaultAction(patch.type as ActionType)
      return { ...a, ...patch } as ActionForm
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim())       { setError('Name is required');              return }
    if (actions.length < 1) { setError('At least one action required'); return }
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/automation/rules', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name, trigger, actions }),
      })
      if (!res.ok) throw new Error('Failed to create rule')
      onCreated?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'w-full rounded-lg border border-charcoal-200 bg-white px-3 py-1.5 text-sm text-charcoal-900 placeholder:text-charcoal-400 focus:outline-none focus:ring-2 focus:ring-charcoal-900'

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {/* Metadata */}
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="text-xs text-charcoal-500 mb-1 block">Rule Name *</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)}
            placeholder="e.g. Assign task for hot leads" className={inputCls} />
        </div>
        <div className="col-span-2">
          <label className="text-xs text-charcoal-500 mb-1 block">When this happens (Trigger)</label>
          <select value={trigger} onChange={e => setTrigger(e.target.value as TriggerType)} className={inputCls}>
            {Object.entries(TRIGGER_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
      </div>

      {/* Actions */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-charcoal-700 uppercase tracking-wide">Then do these</p>
          <button type="button" onClick={addAction}
            className="flex items-center gap-1 text-xs text-gold-600 hover:text-gold-700 font-medium">
            <Plus size={12} /> Add Action
          </button>
        </div>

        <div className="flex flex-col gap-3">
          {actions.map((action, i) => (
            <div key={i} className="rounded-xl border border-charcoal-200 bg-charcoal-50 p-3 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <select value={action.type} onChange={e => updateAction(i, { type: e.target.value as ActionType })}
                  className="flex-1 rounded-lg border border-charcoal-200 bg-white px-2 py-1.5 text-sm text-charcoal-900 focus:outline-none focus:ring-2 focus:ring-charcoal-900">
                  {Object.entries(ACTION_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                <button type="button" onClick={() => removeAction(i)} className="text-red-400 hover:text-red-600">
                  <Trash2 size={14} />
                </button>
              </div>

              {/* Action-specific inputs */}
              {action.type === 'send_email' && (
                <>
                  <input type="text" placeholder="Subject" value={String(action.subject ?? '')}
                    onChange={e => updateAction(i, { subject: e.target.value })} className={inputCls} />
                  <textarea placeholder="Email body" rows={2} value={String(action.body ?? '')}
                    onChange={e => updateAction(i, { body: e.target.value })}
                    className={`${inputCls} resize-none`} />
                </>
              )}
              {action.type === 'send_sms' && (
                <textarea placeholder="SMS body" rows={2} value={String(action.body ?? '')}
                  onChange={e => updateAction(i, { body: e.target.value })}
                  className={`${inputCls} resize-none`} />
              )}
              {action.type === 'assign_task' && (
                <div className="flex gap-2">
                  <input type="text" placeholder="Task title" value={String(action.title ?? '')}
                    onChange={e => updateAction(i, { title: e.target.value })} className={`${inputCls} flex-1`} />
                  <select value={String(action.priority ?? 'normal')}
                    onChange={e => updateAction(i, { priority: e.target.value })}
                    className="rounded-lg border border-charcoal-200 bg-white px-2 py-1.5 text-sm text-charcoal-900 w-28 focus:outline-none">
                    {['low', 'normal', 'high', 'urgent'].map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              )}
              {action.type === 'enroll_campaign' && (
                <input type="text" placeholder="Campaign / Sequence ID" value={String(action.sequenceId ?? '')}
                  onChange={e => updateAction(i, { sequenceId: e.target.value })} className={inputCls} />
              )}
              {action.type === 'change_stage' && (
                <input type="text" placeholder="Stage ID" value={String(action.stageId ?? '')}
                  onChange={e => updateAction(i, { stageId: e.target.value })} className={inputCls} />
              )}
              {action.type === 'update_score' && (
                <div className="flex items-center gap-2">
                  <input type="number" value={Number(action.delta ?? 0)}
                    onChange={e => updateAction(i, { delta: parseInt(e.target.value) || 0 })}
                    className={`${inputCls} w-24`} />
                  <span className="text-xs text-charcoal-400">score delta</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <Button type="submit" variant="primary" loading={saving} leftIcon={<Zap size={14} />}>
        Create Rule
      </Button>
    </form>
  )
}
