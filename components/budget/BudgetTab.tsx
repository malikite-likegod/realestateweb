'use client'

import { useState, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { Button } from '@/components/ui'
import { cn } from '@/lib/utils'
import { AllocationPanel } from './AllocationPanel'

type Category = {
  id: string; name: string; color: string; order: number
  goalType: string | null; goalAmount: number | null; goalTargetDate: string | null
}
type Group = { id: string; name: string; order: number; categories: Category[] }
type AllocData = {
  categoryId: string; month: string
  assigned: number; activity: number; available: number; note: string | null
}
type BudgetData = { readyToAssign: number; categories: AllocData[] }

function toMonth(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
function prevMonth(m: string) {
  const [y, mo] = m.split('-').map(Number)
  return mo === 1 ? `${y - 1}-12` : `${y}-${String(mo - 1).padStart(2, '0')}`
}
function nextMonth(m: string) {
  const [y, mo] = m.split('-').map(Number)
  return mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, '0')}`
}
function fmt(n: number) {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(n)
}

export function BudgetTab() {
  const [month, setMonth]                   = useState(toMonth)
  const [groups, setGroups]                 = useState<Group[]>([])
  const [budgetData, setBudgetData]         = useState<BudgetData | null>(null)
  const [loading, setLoading]               = useState(true)
  const [selectedId, setSelectedId]         = useState<string | null>(null)
  const [showAddGroup, setShowAddGroup]     = useState(false)
  const [newGroupName, setNewGroupName]     = useState('')
  const [showAddCat, setShowAddCat]         = useState<string | null>(null) // groupId
  const [newCatName, setNewCatName]         = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const [gRes, aRes] = await Promise.all([
      fetch('/api/budget/groups'),
      fetch(`/api/budget/allocations?month=${month}`),
    ])
    const gJson = await gRes.json()
    const aJson = await aRes.json()
    setGroups(gJson.data ?? [])
    setBudgetData(aJson.data ?? null)
    setLoading(false)
  }, [month])

  useEffect(() => { load() }, [load])

  const allocMap = new Map<string, AllocData>(
    budgetData?.categories.map(c => [c.categoryId, c]) ?? []
  )

  async function addGroup() {
    if (!newGroupName.trim()) return
    await fetch('/api/budget/groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newGroupName.trim() }),
    })
    setNewGroupName(''); setShowAddGroup(false); load()
  }

  async function addCategory(groupId: string) {
    if (!newCatName.trim()) return
    await fetch('/api/budget/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ groupId, name: newCatName.trim() }),
    })
    setNewCatName(''); setShowAddCat(null); load()
  }

  return (
    <div className="flex gap-6 items-start">
      <div className="flex-1 flex flex-col gap-4 min-w-0">
        {/* Month navigator + Ready to Assign */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button onClick={() => setMonth(prevMonth)} className="p-1 text-charcoal-400 hover:text-white">
              <ChevronLeft size={20} />
            </button>
            <span className="text-white font-medium w-24 text-center">{month}</span>
            <button onClick={() => setMonth(nextMonth)} className="p-1 text-charcoal-400 hover:text-white">
              <ChevronRight size={20} />
            </button>
          </div>
          {budgetData && (
            <div className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium',
              budgetData.readyToAssign >= 0
                ? 'bg-green-900/30 text-green-400'
                : 'bg-red-900/30 text-red-400',
            )}>
              Ready to Assign: {fmt(budgetData.readyToAssign)}
            </div>
          )}
        </div>

        {/* Table header */}
        <div className="grid grid-cols-4 gap-2 px-3 py-2 text-xs text-charcoal-500 font-medium uppercase tracking-wider">
          <span className="col-span-1">Category</span>
          <span className="text-right">Assigned</span>
          <span className="text-right">Activity</span>
          <span className="text-right">Available</span>
        </div>

        {loading ? (
          <div className="text-charcoal-500 text-sm px-3">Loading…</div>
        ) : groups.length === 0 ? (
          <div className="text-charcoal-500 text-sm px-3">
            No budget groups yet. Create your first group below.
          </div>
        ) : (
          groups.map(group => (
            <div key={group.id} className="flex flex-col gap-1">
              {/* Group header */}
              <div className="flex items-center justify-between px-3 py-1.5 text-xs font-semibold text-charcoal-400 uppercase tracking-wider bg-charcoal-900/60 rounded">
                <span>{group.name}</span>
                <button
                  onClick={() => { setShowAddCat(group.id); setNewCatName('') }}
                  className="text-charcoal-600 hover:text-gold-400 flex items-center gap-0.5"
                >
                  <Plus size={12} /> Add
                </button>
              </div>

              {/* Category rows */}
              {group.categories.map(cat => {
                const alloc    = allocMap.get(cat.id)
                const assigned = alloc?.assigned ?? 0
                const activity = alloc?.activity ?? 0
                const available = alloc?.available ?? 0
                const isSelected = selectedId === cat.id
                const isOver = cat.goalType === 'monthly_limit' && cat.goalAmount && activity > cat.goalAmount
                const isNear = cat.goalType === 'monthly_limit' && cat.goalAmount && activity >= cat.goalAmount * 0.8 && !isOver

                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedId(isSelected ? null : cat.id)}
                    className={cn(
                      'grid grid-cols-4 gap-2 px-3 py-2.5 rounded-lg text-sm text-left w-full transition-colors',
                      isSelected ? 'bg-charcoal-800' : 'hover:bg-charcoal-900/50',
                    )}
                  >
                    <span className="col-span-1 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                      <span className="text-white truncate">{cat.name}</span>
                    </span>
                    <span className="text-right text-charcoal-300">{fmt(assigned)}</span>
                    <span className="text-right text-charcoal-300">{fmt(activity)}</span>
                    <span className={cn(
                      'text-right font-medium',
                      isOver ? 'text-red-400' : isNear ? 'text-yellow-400' : available >= 0 ? 'text-green-400' : 'text-red-400',
                    )}>
                      {fmt(available)}
                    </span>
                  </button>
                )
              })}

              {/* Inline add-category form */}
              {showAddCat === group.id && (
                <div className="flex gap-2 px-3">
                  <input
                    autoFocus
                    value={newCatName}
                    onChange={e => setNewCatName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') addCategory(group.id); if (e.key === 'Escape') setShowAddCat(null) }}
                    placeholder="Category name…"
                    className="flex-1 bg-charcoal-800 border border-charcoal-700 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-gold-400"
                  />
                  <Button size="sm" onClick={() => addCategory(group.id)}>Add</Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowAddCat(null)}>Cancel</Button>
                </div>
              )}
            </div>
          ))
        )}

        {/* Add group */}
        {showAddGroup ? (
          <div className="flex gap-2">
            <input
              autoFocus
              value={newGroupName}
              onChange={e => setNewGroupName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addGroup(); if (e.key === 'Escape') setShowAddGroup(false) }}
              placeholder="Group name…"
              className="flex-1 bg-charcoal-900 border border-charcoal-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-gold-400"
            />
            <Button size="sm" onClick={addGroup}>Add</Button>
            <Button size="sm" variant="ghost" onClick={() => setShowAddGroup(false)}>Cancel</Button>
          </div>
        ) : (
          <Button size="sm" variant="ghost" onClick={() => setShowAddGroup(true)} className="self-start" leftIcon={<Plus size={14} />}>
            Add Group
          </Button>
        )}
      </div>

      {/* Allocation side panel */}
      {selectedId && (
        <AllocationPanel
          categoryId={selectedId}
          month={month}
          groups={groups}
          allocData={allocMap.get(selectedId) ?? null}
          onClose={() => setSelectedId(null)}
          onSaved={load}
        />
      )}
    </div>
  )
}
