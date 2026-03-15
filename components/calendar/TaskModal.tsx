'use client'

import { useState, useEffect } from 'react'
import { Modal, Button, Input, Select, Textarea, Switch } from '@/components/ui'
import { Trash2 } from 'lucide-react'

// Format a Date as YYYY-MM-DD in the user's local timezone (for <input type="date">)
function toLocalDateString(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

interface TaskType {
  id: string
  name: string
  color: string
}

interface Contact {
  id: string
  firstName: string
  lastName: string
}

interface TaskModalProps {
  open: boolean
  onClose: () => void
  onSaved: () => void
  // Pre-fill for new tasks (e.g., clicking a date)
  initialDate?: string
  // Existing task for editing
  task?: {
    id: string
    title: string
    description?: string | null
    status: string
    priority: string
    taskTypeId?: string | null
    startDatetime?: string | null
    endDatetime?: string | null
    allDay: boolean
    dueAt?: string | null
    contactId?: string | null
  } | null
}

const PRIORITIES = [
  { value: 'low',    label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high',   label: 'High' },
  { value: 'urgent', label: 'Urgent' },
]

const STATUSES = [
  { value: 'todo',        label: 'To Do' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'done',        label: 'Done' },
  { value: 'cancelled',   label: 'Cancelled' },
]

export function TaskModal({ open, onClose, onSaved, initialDate, task }: TaskModalProps) {
  const isEditing = !!task

  const [taskTypes, setTaskTypes] = useState<TaskType[]>([])
  const [contacts,  setContacts]  = useState<Contact[]>([])

  const [title,      setTitle]      = useState('')
  const [taskTypeId, setTaskTypeId] = useState('')
  const [date,       setDate]       = useState('')
  const [startTime,  setStartTime]  = useState('')
  const [endTime,    setEndTime]    = useState('')
  const [allDay,     setAllDay]     = useState(false)
  const [contactId,  setContactId]  = useState('')
  const [notes,      setNotes]      = useState('')
  const [priority,   setPriority]   = useState('normal')
  const [status,     setStatus]     = useState('todo')
  const [saving,     setSaving]     = useState(false)
  const [deleting,   setDeleting]   = useState(false)

  // Load reference data
  useEffect(() => {
    fetch('/api/task-types').then(r => r.json()).then(r => setTaskTypes(r.data ?? []))
    fetch('/api/contacts?pageSize=200').then(r => r.json()).then(r => setContacts(r.data ?? []))
  }, [])

  // Populate form when editing or when initialDate changes
  useEffect(() => {
    if (!open) return
    if (task) {
      const start = task.startDatetime ?? task.dueAt
      const d     = start ? new Date(start) : null
      setTitle(task.title)
      setTaskTypeId(task.taskTypeId ?? '')
      setDate(d ? toLocalDateString(d) : '')
      setStartTime(d && !task.allDay ? d.toTimeString().slice(0, 5) : '')
      setEndTime(task.endDatetime && !task.allDay ? new Date(task.endDatetime).toTimeString().slice(0, 5) : '')
      setAllDay(task.allDay)
      setContactId(task.contactId ?? '')
      setNotes(task.description ?? '')
      setPriority(task.priority)
      setStatus(task.status)
    } else {
      setTitle('')
      setTaskTypeId('')
      setDate(initialDate ?? '')
      setStartTime('')
      setEndTime('')
      setAllDay(false)
      setContactId('')
      setNotes('')
      setPriority('normal')
      setStatus('todo')
    }
  }, [open, task, initialDate])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const startDatetime = date && startTime && !allDay ? new Date(`${date}T${startTime}`).toISOString() : null
      const endDatetime   = date && endTime   && !allDay ? new Date(`${date}T${endTime}`).toISOString()   : null
      const dueAt         = date ? (allDay ? new Date(date).toISOString() : startDatetime ?? new Date(date).toISOString()) : null

      const payload = {
        title,
        description:   notes || null,
        taskTypeId:    taskTypeId || null,
        priority,
        status,
        allDay,
        dueAt,
        startDatetime,
        endDatetime,
        contactId:     contactId || null,
      }

      const url    = isEditing ? `/api/tasks/${task!.id}` : '/api/tasks'
      const method = isEditing ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        onSaved()
        onClose()
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!task || !confirm('Delete this task?')) return
    setDeleting(true)
    try {
      await fetch(`/api/tasks/${task.id}`, { method: 'DELETE' })
      onSaved()
      onClose()
    } finally {
      setDeleting(false)
    }
  }

  const typeOptions    = taskTypes.map(t => ({ value: t.id,    label: t.name }))
  const contactOptions = contacts.map(c => ({ value: c.id, label: `${c.firstName} ${c.lastName}` }))

  return (
    <Modal open={open} onClose={onClose} title={isEditing ? 'Edit Task' : 'New Task'} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Task Title"
          value={title}
          onChange={e => setTitle(e.target.value)}
          required
          placeholder="e.g. Follow up with John"
        />

        <Select
          label="Task Type"
          value={taskTypeId}
          onChange={e => setTaskTypeId(e.target.value)}
          options={[{ value: '', label: 'Select type…' }, ...typeOptions]}
        />

        <Input
          label="Date"
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          required
        />

        <div className="flex items-center gap-3">
          <Switch
            checked={allDay}
            onChange={setAllDay}
            label="All Day Event"
          />
        </div>

        {!allDay && (
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Start Time"
              type="time"
              value={startTime}
              onChange={e => setStartTime(e.target.value)}
            />
            <Input
              label="End Time"
              type="time"
              value={endTime}
              onChange={e => setEndTime(e.target.value)}
            />
          </div>
        )}

        <Select
          label="Related Contact (optional)"
          value={contactId}
          onChange={e => setContactId(e.target.value)}
          options={[{ value: '', label: 'None' }, ...contactOptions]}
        />

        {isEditing && (
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Priority"
              value={priority}
              onChange={e => setPriority(e.target.value)}
              options={PRIORITIES}
            />
            <Select
              label="Status"
              value={status}
              onChange={e => setStatus(e.target.value)}
              options={STATUSES}
            />
          </div>
        )}

        <Textarea
          label="Notes (optional)"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={3}
          placeholder="Additional details…"
        />

        <div className="flex items-center justify-between pt-2">
          {isEditing ? (
            <Button
              type="button"
              variant="ghost"
              leftIcon={<Trash2 size={15} />}
              onClick={handleDelete}
              disabled={deleting}
              className="text-red-500 hover:text-red-600"
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={saving}>
              {saving ? 'Saving…' : isEditing ? 'Save Changes' : 'Create Task'}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  )
}
