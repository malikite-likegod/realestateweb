'use client'

import { useState } from 'react'
import { Send } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { Button } from '@/components/ui'
import { Avatar } from '@/components/ui'

interface Note {
  id: string
  body: string
  user?: { name: string } | null
  createdAt: Date
}

interface NotesPanelProps {
  notes: Note[]
  onAdd?: (body: string) => Promise<void>
}

export function NotesPanel({ notes, onAdd }: NotesPanelProps) {
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!text.trim() || !onAdd) return
    setSaving(true)
    try {
      await onAdd(text.trim())
      setText('')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Add note */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Add a note…"
          rows={2}
          className="flex-1 rounded-xl border border-charcoal-200 bg-white px-3 py-2 text-sm text-charcoal-900 placeholder:text-charcoal-400 focus:outline-none focus:ring-2 focus:ring-charcoal-900 resize-none"
        />
        <Button type="submit" variant="primary" size="sm" loading={saving} leftIcon={<Send size={14} />}>
          Add
        </Button>
      </form>

      {/* Notes list */}
      <div className="flex flex-col gap-3">
        {notes.map(note => (
          <div key={note.id} className="flex gap-3">
            <Avatar name={note.user?.name ?? '?'} size="sm" className="shrink-0" />
            <div className="flex-1 rounded-xl bg-charcoal-50 p-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium text-charcoal-700">{note.user?.name ?? 'Unknown'}</span>
                <span className="text-xs text-charcoal-300">{formatDate(note.createdAt, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
              </div>
              <p className="text-sm text-charcoal-600 whitespace-pre-wrap">{note.body}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
