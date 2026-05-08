'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui'
import { Button } from '@/components/ui'
import { ReceiptUpload } from './ReceiptUpload'
import { cn } from '@/lib/utils'

type Category = { id: string; name: string }
type Group    = { id: string; name: string; categories: Category[] }

export type TransactionDraft = {
  id?:         string
  type:        'income' | 'expense'
  categoryId:  string | null
  amount:      number
  date:        string    // ISO date string YYYY-MM-DD
  payee:       string
  notes:       string
  receiptUrl:  string | null
}

interface Props {
  open:     boolean
  initial?: Partial<TransactionDraft>
  groups:   Group[]
  onClose:  () => void
  onSaved:  () => void
}

function todayStr() {
  return new Date().toISOString().split('T')[0]
}

export function TransactionModal({ open, initial, groups, onClose, onSaved }: Props) {
  const [type, setType]             = useState<'income' | 'expense'>(initial?.type ?? 'expense')
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? '')
  const [amount, setAmount]         = useState(initial?.amount ? String(initial.amount) : '')
  const [date, setDate]             = useState(initial?.date ? initial.date.split('T')[0] : todayStr())
  const [payee, setPayee]           = useState(initial?.payee ?? '')
  const [notes, setNotes]           = useState(initial?.notes ?? '')
  const [receiptUrl, setReceiptUrl] = useState<string | null>(initial?.receiptUrl ?? null)
  const [saving, setSaving]         = useState(false)
  const [errors, setErrors]         = useState<Record<string, string>>({})

  function validate() {
    const e: Record<string, string> = {}
    if (!amount || parseFloat(amount) <= 0) e.amount = 'Must be greater than 0'
    if (!date) e.date = 'Date is required'
    if (type === 'expense' && !categoryId) e.categoryId = 'Category is required'
    return e
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setSaving(true)

    const body = {
      type,
      categoryId: type === 'income' ? null : categoryId,
      amount:     parseFloat(amount),
      date,
      payee:      payee || null,
      notes:      notes || null,
      receiptUrl,
    }

    const isEdit = !!initial?.id
    const res = await fetch(
      isEdit ? `/api/budget/transactions/${initial.id}` : '/api/budget/transactions',
      { method: isEdit ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
    )
    setSaving(false)
    if (!res.ok) return
    onSaved(); onClose()
  }

  const title = initial?.id ? 'Edit Transaction' : 'Add Transaction'

  return (
    <Modal open={open} onClose={onClose} title={title} size="md">
      <form onSubmit={submit} className="flex flex-col gap-4">
        {/* Type toggle */}
        <div className="flex rounded-lg overflow-hidden border border-charcoal-200">
          {(['expense', 'income'] as const).map(t => (
            <button key={t} type="button"
              onClick={() => { setType(t); if (t === 'income') setCategoryId('') }}
              className={cn(
                'flex-1 py-2 text-sm font-medium capitalize transition-colors',
                type === t ? 'bg-charcoal-900 text-white' : 'text-charcoal-500 hover:bg-charcoal-50',
              )}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Date */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-charcoal-500 font-medium">Date</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="border border-charcoal-200 rounded-lg px-3 py-2 text-charcoal-900 text-sm focus:outline-none focus:border-charcoal-900" />
          {errors.date && <p className="text-xs text-red-500">{errors.date}</p>}
        </div>

        {/* Payee */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-charcoal-500 font-medium">Payee</label>
          <input value={payee} onChange={e => setPayee(e.target.value)} placeholder="Who did you pay?"
            className="border border-charcoal-200 rounded-lg px-3 py-2 text-charcoal-900 text-sm focus:outline-none focus:border-charcoal-900" />
        </div>

        {/* Amount */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-charcoal-500 font-medium">Amount (CAD)</label>
          <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
            min="0.01" step="0.01" placeholder="0.00"
            className="border border-charcoal-200 rounded-lg px-3 py-2 text-charcoal-900 text-sm focus:outline-none focus:border-charcoal-900" />
          {errors.amount && <p className="text-xs text-red-500">{errors.amount}</p>}
        </div>

        {/* Category (expense only) */}
        {type === 'expense' && (
          <div className="flex flex-col gap-1">
            <label className="text-xs text-charcoal-500 font-medium">Category</label>
            <select value={categoryId} onChange={e => setCategoryId(e.target.value)}
              className="border border-charcoal-200 rounded-lg px-3 py-2 text-charcoal-900 text-sm focus:outline-none focus:border-charcoal-900">
              <option value="">Select category…</option>
              {groups.length === 0
                ? <option disabled value="">No categories yet — add them in the Budget tab</option>
                : groups.map(g => (
                    <optgroup key={g.id} label={g.name}>
                      {g.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </optgroup>
                  ))
              }
            </select>
            {errors.categoryId && <p className="text-xs text-red-500">{errors.categoryId}</p>}
          </div>
        )}

        {/* Notes */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-charcoal-500 font-medium">Notes</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
            placeholder="Optional memo…"
            className="border border-charcoal-200 rounded-lg px-3 py-2 text-charcoal-900 text-sm focus:outline-none focus:border-charcoal-900 resize-none" />
        </div>

        {/* Receipt */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-charcoal-500 font-medium">Receipt</label>
          <ReceiptUpload value={receiptUrl} onChange={setReceiptUrl} />
        </div>

        <div className="flex gap-2 pt-2">
          <Button type="submit" loading={saving} fullWidth>
            {initial?.id ? 'Save Changes' : 'Add Transaction'}
          </Button>
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
        </div>
      </form>
    </Modal>
  )
}
