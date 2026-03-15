'use client'

import { useState, useEffect } from 'react'
import { Button, Input } from '@/components/ui'
import { Plus, Trash2 } from 'lucide-react'

interface TaskType {
  id: string
  name: string
  color: string
  isDefault: boolean
}

export function TaskTypeManager() {
  const [types,    setTypes]    = useState<TaskType[]>([])
  const [newName,  setNewName]  = useState('')
  const [newColor, setNewColor] = useState('#6366f1')
  const [saving,   setSaving]   = useState(false)

  async function load() {
    const r = await fetch('/api/task-types')
    const j = await r.json()
    setTypes(j.data ?? [])
  }

  useEffect(() => { load() }, [])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    setSaving(true)
    await fetch('/api/task-types', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim(), color: newColor }),
    })
    setNewName('')
    setNewColor('#6366f1')
    await load()
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this task type?')) return
    await fetch(`/api/task-types/${id}`, { method: 'DELETE' })
    await load()
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {types.map(t => (
          <div key={t.id} className="flex items-center gap-3 rounded-lg border border-charcoal-100 bg-white px-3 py-2">
            <span className="h-3 w-3 rounded-full shrink-0" style={{ background: t.color }} />
            <span className="flex-1 text-sm font-medium text-charcoal-800">{t.name}</span>
            {t.isDefault ? (
              <span className="text-xs text-charcoal-400">default</span>
            ) : (
              <button
                onClick={() => handleDelete(t.id)}
                className="text-charcoal-400 hover:text-red-500 transition-colors"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ))}
      </div>

      <form onSubmit={handleAdd} className="flex items-end gap-2">
        <Input
          label="New Type Name"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          placeholder="e.g. Site Visit"
          className="flex-1"
        />
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-charcoal-600">Color</label>
          <input
            type="color"
            value={newColor}
            onChange={e => setNewColor(e.target.value)}
            className="h-9 w-12 cursor-pointer rounded border border-charcoal-200 p-0.5"
          />
        </div>
        <Button type="submit" variant="primary" leftIcon={<Plus size={15} />} disabled={saving}>
          Add
        </Button>
      </form>
    </div>
  )
}
