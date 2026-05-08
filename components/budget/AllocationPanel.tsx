'use client'

import { useState } from 'react'
import { X, Plus } from 'lucide-react'
import { Button } from '@/components/ui'
import { cn } from '@/lib/utils'

type Category = {
  id: string; name: string; color: string
  goalType: string | null; goalAmount: number | null; goalTargetDate: string | null
}
type Group = { id: string; name: string; categories: Category[] }
type AllocData = { categoryId: string; month: string; assigned: number; activity: number; available: number; note: string | null }

interface Props {
  categoryId: string; month: string; groups: Group[]
  allocData: AllocData | null; onClose: () => void; onSaved: () => void
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(n)
}

function daysLeft(iso: string | null) {
  if (!iso) return null
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000)
}

export function AllocationPanel({ categoryId, month, groups, allocData, onClose, onSaved }: Props) {
  const cat = groups.flatMap(g => g.categories).find(c => c.id === categoryId)
  const [assigned, setAssigned]     = useState(String(allocData?.assigned ?? 0))
  const [saving, setSaving]         = useState(false)
  const [showGoal, setShowGoal]     = useState(false)
  const [goalType, setGoalType]     = useState(cat?.goalType ?? '')
  const [goalAmount, setGoalAmount] = useState(String(cat?.goalAmount ?? ''))

  if (!cat) return null

  const activity  = allocData?.activity ?? 0
  const available = allocData?.available ?? 0
  const goalAmt   = cat.goalAmount ?? 0
  const days      = daysLeft(cat.goalTargetDate)

  let pct = 0, barColor = 'bg-green-500'
  if (cat.goalType === 'monthly_limit' && goalAmt > 0) {
    pct = Math.min(100, (activity / goalAmt) * 100)
    barColor = pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-yellow-500' : 'bg-green-500'
  } else if (cat.goalType === 'savings_target' && goalAmt > 0) {
    pct = Math.min(100, (available / goalAmt) * 100)
  }

  async function saveAllocation() {
    setSaving(true)
    await fetch('/api/budget/allocations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categoryId, month, assigned: parseFloat(assigned) || 0 }),
    })
    setSaving(false); onSaved()
  }

  async function saveGoal() {
    await fetch(`/api/budget/categories/${categoryId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        goalType: goalType || null,
        goalAmount: goalAmount ? parseFloat(goalAmount) : null,
      }),
    })
    setShowGoal(false); onSaved()
  }

  return (
    <div className="w-72 shrink-0 bg-white border border-charcoal-200 rounded-xl p-4 flex flex-col gap-4 sticky top-4 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
          <span className="font-semibold text-charcoal-900">{cat.name}</span>
        </div>
        <button onClick={onClose} className="text-charcoal-400 hover:text-charcoal-700 transition-colors">
          <X size={16} />
        </button>
      </div>

      {/* Assign */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-charcoal-500 uppercase tracking-wider font-medium">Assign for {month}</label>
        <div className="flex gap-2">
          <input
            type="number" value={assigned} min="0" step="0.01"
            onChange={e => setAssigned(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') saveAllocation() }}
            className="flex-1 border border-charcoal-200 rounded-lg px-3 py-2 text-charcoal-900 text-sm focus:outline-none focus:border-charcoal-400 bg-white"
          />
          <Button size="sm" onClick={saveAllocation} loading={saving}>Save</Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 text-sm bg-charcoal-50 rounded-lg p-3">
        <div>
          <div className="text-xs text-charcoal-500 font-medium">Activity</div>
          <div className="text-charcoal-900 font-semibold mt-0.5">{fmt(activity)}</div>
        </div>
        <div>
          <div className="text-xs text-charcoal-500 font-medium">Available</div>
          <div className={cn('font-semibold mt-0.5', available >= 0 ? 'text-green-700' : 'text-red-600')}>
            {fmt(available)}
          </div>
        </div>
      </div>

      {/* Goal display */}
      {cat.goalType && !showGoal && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-charcoal-500 uppercase tracking-wider font-medium">
              {cat.goalType === 'monthly_limit' ? 'Spending Limit' : 'Savings Target'}
            </span>
            <button onClick={() => setShowGoal(true)} className="text-xs text-gold-500 hover:underline font-medium">Edit</button>
          </div>
          <div className="h-2 bg-charcoal-100 rounded-full overflow-hidden">
            <div className={cn('h-full rounded-full transition-all', barColor)} style={{ width: `${pct}%` }} />
          </div>
          <p className="text-xs text-charcoal-600">
            {cat.goalType === 'monthly_limit'
              ? `${fmt(activity)} of ${fmt(goalAmt)}`
              : `${fmt(available)} of ${fmt(goalAmt)}${days !== null ? ` · ${days}d left` : ''}`
            }
          </p>
        </div>
      )}

      {/* Goal edit form */}
      {showGoal ? (
        <div className="flex flex-col gap-2">
          <select
            value={goalType}
            onChange={e => setGoalType(e.target.value)}
            className="border border-charcoal-200 rounded-lg px-3 py-2 text-charcoal-900 text-sm focus:outline-none focus:border-charcoal-400 bg-white"
          >
            <option value="">No goal</option>
            <option value="monthly_limit">Monthly Spending Limit</option>
            <option value="savings_target">Savings Target</option>
          </select>
          {goalType && (
            <input
              type="number" value={goalAmount} min="0" step="0.01"
              onChange={e => setGoalAmount(e.target.value)}
              placeholder="Goal amount"
              className="border border-charcoal-200 rounded-lg px-3 py-2 text-charcoal-900 text-sm focus:outline-none focus:border-charcoal-400 bg-white"
            />
          )}
          <div className="flex gap-2">
            <Button size="sm" onClick={saveGoal}>Save Goal</Button>
            <Button size="sm" variant="ghost" onClick={() => setShowGoal(false)}>Cancel</Button>
          </div>
        </div>
      ) : !cat.goalType && (
        <button
          onClick={() => setShowGoal(true)}
          className="text-xs text-charcoal-500 hover:text-gold-500 flex items-center gap-1 self-start transition-colors"
        >
          <Plus size={12} /> Add Goal
        </button>
      )}
    </div>
  )
}
