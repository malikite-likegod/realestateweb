'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Modal, Button, Input, Select, Textarea, Switch } from '@/components/ui'
import { Pencil, Trash2 } from 'lucide-react'

interface Stage { id: string; name: string; color: string }
interface User  { id: string; name: string }

interface DealSnapshot {
  id:            string
  title:         string
  value:         number | null
  stageId:       string
  assigneeId:    string | null
  probability:   number
  expectedClose: string | null
  notes:         string | null
  closedAt:      string | null
}

interface DealEditModalProps {
  deal: DealSnapshot
}

export function DealEditModal({ deal }: DealEditModalProps) {
  const router = useRouter()

  const [open,     setOpen]    = useState(false)
  const [stages,   setStages]  = useState<Stage[]>([])
  const [users,    setUsers]   = useState<User[]>([])

  const [title,         setTitle]         = useState(deal.title)
  const [stageId,       setStageId]       = useState(deal.stageId)
  const [value,         setValue]         = useState(deal.value?.toString() ?? '')
  const [probability,   setProbability]   = useState(deal.probability.toString())
  const [assigneeId,    setAssigneeId]    = useState(deal.assigneeId ?? '')
  const [expectedClose, setExpectedClose] = useState(
    deal.expectedClose ? deal.expectedClose.slice(0, 10) : '',
  )
  const [notes,    setNotes]   = useState(deal.notes ?? '')
  const [isClosed, setIsClosed] = useState(!!deal.closedAt)
  const [closedAt, setClosedAt] = useState(
    deal.closedAt ? deal.closedAt.slice(0, 10) : new Date().toISOString().slice(0, 10),
  )
  const [saving,   setSaving]  = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!open) return
    Promise.all([
      fetch('/api/stages').then(r => r.json()),
      fetch('/api/users').then(r => r.json()),
    ]).then(([s, u]) => {
      setStages(s.data ?? [])
      setUsers(u.data  ?? [])
    })
  }, [open])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch(`/api/deals/${deal.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title:         title.trim(),
          stageId,
          value:         value       ? parseFloat(value)       : null,
          probability:   parseInt(probability) || 50,
          assigneeId:    assigneeId  || null,
          expectedClose: expectedClose || null,
          notes:         notes       || null,
          closedAt:      isClosed    ? closedAt : null,
        }),
      })
      if (res.ok) {
        setOpen(false)
        router.refresh()
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete "${deal.title}"? This cannot be undone.`)) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/deals/${deal.id}`, { method: 'DELETE' })
      if (res.ok) router.push('/admin/deals')
    } finally {
      setDeleting(false)
    }
  }

  const stageOptions = stages.map(s => ({ value: s.id,  label: s.name }))
  const userOptions  = [
    { value: '', label: 'Unassigned' },
    ...users.map(u => ({ value: u.id, label: u.name })),
  ]

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        leftIcon={<Pencil size={14} />}
        onClick={() => setOpen(true)}
      >
        Edit Deal
      </Button>

      <Modal open={open} onClose={() => setOpen(false)} title="Edit Deal" size="md">
        <form onSubmit={handleSave} className="space-y-4">
          <Input
            label="Deal Title"
            value={title}
            onChange={e => setTitle(e.target.value)}
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Stage"
              value={stageId}
              onChange={e => setStageId(e.target.value)}
              options={stageOptions}
            />
            <Select
              label="Assignee"
              value={assigneeId}
              onChange={e => setAssigneeId(e.target.value)}
              options={userOptions}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Value (CAD)"
              type="number"
              min={0}
              value={value}
              onChange={e => setValue(e.target.value)}
              placeholder="0"
            />
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-charcoal-700">
                Probability: {probability}%
              </label>
              <input
                type="range"
                min={0}
                max={100}
                value={probability}
                onChange={e => setProbability(e.target.value)}
                className="h-2 w-full cursor-pointer accent-charcoal-900"
              />
            </div>
          </div>

          <Input
            label="Expected Close Date"
            type="date"
            value={expectedClose}
            onChange={e => setExpectedClose(e.target.value)}
          />

          <Textarea
            label="Notes"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
            placeholder="Add notes…"
          />

          <div className="space-y-2 rounded-lg border border-charcoal-100 bg-charcoal-50 p-3">
            <Switch
              checked={isClosed}
              onChange={setIsClosed}
              label="Mark as Closed"
            />
            {isClosed && (
              <Input
                label="Closed Date"
                type="date"
                value={closedAt}
                onChange={e => setClosedAt(e.target.value)}
              />
            )}
          </div>

          <div className="flex items-center justify-between pt-2">
            <Button
              type="button"
              variant="ghost"
              leftIcon={<Trash2 size={14} />}
              onClick={handleDelete}
              disabled={deleting}
              className="text-red-500 hover:text-red-600"
            >
              {deleting ? 'Deleting…' : 'Delete Deal'}
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" variant="primary" disabled={saving}>
                {saving ? 'Saving…' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </form>
      </Modal>
    </>
  )
}
