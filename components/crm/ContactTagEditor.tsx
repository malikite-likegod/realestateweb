'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Plus, Tag, Check } from 'lucide-react'
import { useToast } from '@/components/ui'

const PRESET_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316',
  '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#64748b',
]

interface TagItem {
  id:    string
  name:  string
  color: string
}

interface Props {
  contactId:   string
  initialTags: TagItem[]
  allTags:     TagItem[]
}

export function ContactTagEditor({ contactId, initialTags, allTags: initialAllTags }: Props) {
  const { toast } = useToast()

  const [contactTags, setContactTags] = useState<TagItem[]>(initialTags)
  const [allTags,     setAllTags]     = useState<TagItem[]>(initialAllTags)
  const [open,        setOpen]        = useState(false)
  const [search,      setSearch]      = useState('')
  const [creating,    setCreating]    = useState(false)
  const [newName,     setNewName]     = useState('')
  const [newColor,    setNewColor]    = useState(PRESET_COLORS[0])
  const [saving,      setSaving]      = useState(false)

  const wrapperRef = useRef<HTMLDivElement>(null)
  const searchRef  = useRef<HTMLInputElement>(null)
  const newNameRef = useRef<HTMLInputElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
        setCreating(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [])

  // Auto-focus search when dropdown opens
  useEffect(() => {
    if (open && !creating) searchRef.current?.focus()
  }, [open, creating])

  // Auto-focus name input when create form appears
  useEffect(() => {
    if (creating) newNameRef.current?.focus()
  }, [creating])

  const assignedIds   = new Set(contactTags.map(t => t.id))
  const filteredTags  = allTags.filter(
    t => !assignedIds.has(t.id) && t.name.toLowerCase().includes(search.toLowerCase()),
  )

  // ── Assign an existing tag to this contact ─────────────────────────────────
  async function assignTag(tag: TagItem) {
    const res = await fetch(`/api/contacts/${contactId}/tags`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ tagId: tag.id }),
    })
    if (!res.ok) { toast('error', 'Failed to assign tag'); return }
    setContactTags(prev => [...prev, tag])
    setSearch('')
    setOpen(false)
  }

  // ── Remove a tag from this contact (does NOT delete the global tag) ─────────
  async function unassignTag(tagId: string) {
    const res = await fetch(`/api/contacts/${contactId}/tags?tagId=${tagId}`, { method: 'DELETE' })
    if (!res.ok) { toast('error', 'Failed to remove tag'); return }
    setContactTags(prev => prev.filter(t => t.id !== tagId))
  }

  // ── Create a brand-new global tag, then immediately assign it ──────────────
  async function createAndAssign() {
    const name = newName.trim()
    if (!name) return
    setSaving(true)
    try {
      const res = await fetch('/api/tags', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name, color: newColor }),
      })
      const json = await res.json()
      if (!res.ok) { toast('error', json.error ?? 'Failed to create tag'); return }

      const tag: TagItem = json.data
      setAllTags(prev => [...prev, tag].sort((a, b) => a.name.localeCompare(b.name)))
      await assignTag(tag)
      setNewName('')
      setNewColor(PRESET_COLORS[0])
      setCreating(false)
    } catch {
      toast('error', 'Failed to create tag')
    } finally {
      setSaving(false)
    }
  }

  // ── Globally delete a tag (removes it from all contacts) ───────────────────
  async function deleteGlobalTag(tagId: string, e: React.MouseEvent) {
    e.stopPropagation()
    const res = await fetch(`/api/tags/${tagId}`, { method: 'DELETE' })
    if (!res.ok) { toast('error', 'Failed to delete tag'); return }
    setAllTags(prev =>     prev.filter(t => t.id !== tagId))
    setContactTags(prev => prev.filter(t => t.id !== tagId))
  }

  return (
    <div>
      <p className="text-xs font-semibold text-charcoal-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
        <Tag size={11} /> Tags
      </p>

      {/* Assigned tags */}
      <div className="flex flex-wrap gap-1.5 mb-2 min-h-[1.5rem]">
        {contactTags.length === 0 && (
          <span className="text-xs text-charcoal-400 italic">No tags</span>
        )}
        {contactTags.map(tag => (
          <span
            key={tag.id}
            style={{ backgroundColor: tag.color + '22', color: tag.color }}
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium"
          >
            {tag.name}
            <button
              onClick={() => unassignTag(tag.id)}
              className="rounded-full hover:opacity-60 transition-opacity leading-none"
              title="Remove tag"
            >
              <X size={10} strokeWidth={2.5} />
            </button>
          </span>
        ))}
      </div>

      {/* Dropdown anchor */}
      <div className="relative" ref={wrapperRef}>
        <button
          onClick={() => { setOpen(v => !v); setCreating(false); setSearch('') }}
          className="flex items-center gap-1 text-xs text-charcoal-400 hover:text-gold-600 transition-colors font-medium"
        >
          <Plus size={12} /> Add tag
        </button>

        {open && (
          <div className="absolute left-0 top-6 z-20 w-60 rounded-xl border border-charcoal-100 bg-white shadow-xl overflow-hidden">

            {!creating ? (
              <>
                {/* Search */}
                <div className="p-2 border-b border-charcoal-50">
                  <input
                    ref={searchRef}
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search tags…"
                    className="w-full rounded-lg border border-charcoal-200 px-2.5 py-1.5 text-xs text-charcoal-900 focus:outline-none focus:ring-2 focus:ring-charcoal-900"
                  />
                </div>

                {/* Tag list */}
                <div className="max-h-44 overflow-y-auto py-1">
                  {filteredTags.length === 0 && (
                    <p className="px-3 py-2 text-xs text-charcoal-400 italic">
                      {search ? 'No matching tags' : allTags.length === 0 ? 'No tags yet' : 'All tags already assigned'}
                    </p>
                  )}
                  {filteredTags.map(tag => (
                    <div
                      key={tag.id}
                      className="flex items-center justify-between px-3 py-1.5 hover:bg-charcoal-50 group cursor-pointer"
                    >
                      <button
                        className="flex items-center gap-2 flex-1 text-left min-w-0"
                        onClick={() => assignTag(tag)}
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: tag.color }}
                        />
                        <span className="text-xs text-charcoal-700 truncate">{tag.name}</span>
                      </button>
                      <button
                        onClick={e => deleteGlobalTag(tag.id, e)}
                        title="Delete tag globally"
                        className="opacity-0 group-hover:opacity-100 text-charcoal-300 hover:text-red-500 transition-all ml-1 shrink-0"
                      >
                        <X size={11} />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Create new tag trigger */}
                <div className="border-t border-charcoal-50 p-2">
                  <button
                    onClick={() => { setCreating(true); setNewName(search); setSearch('') }}
                    className="flex items-center gap-1.5 text-xs text-gold-600 hover:text-gold-700 font-medium w-full py-1"
                  >
                    <Plus size={12} />
                    {search ? `Create "${search}"` : 'Create new tag'}
                  </button>
                </div>
              </>
            ) : (
              /* Create tag form */
              <div className="p-3 flex flex-col gap-3">
                <p className="text-xs font-semibold text-charcoal-700">New tag</p>

                <input
                  ref={newNameRef}
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') createAndAssign()
                    if (e.key === 'Escape') setCreating(false)
                  }}
                  placeholder="Tag name"
                  maxLength={50}
                  className="w-full rounded-lg border border-charcoal-200 px-2.5 py-1.5 text-xs text-charcoal-900 focus:outline-none focus:ring-2 focus:ring-charcoal-900"
                />

                {/* Color swatches */}
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_COLORS.map(c => (
                    <button
                      key={c}
                      onClick={() => setNewColor(c)}
                      title={c}
                      className="w-5 h-5 rounded-full transition-transform hover:scale-110 flex items-center justify-center shrink-0"
                      style={{ backgroundColor: c }}
                    >
                      {newColor === c && <Check size={10} className="text-white" strokeWidth={3} />}
                    </button>
                  ))}
                </div>

                {/* Preview */}
                {newName.trim() && (
                  <span
                    style={{ backgroundColor: newColor + '22', color: newColor }}
                    className="self-start rounded-full px-2.5 py-0.5 text-xs font-medium"
                  >
                    {newName.trim()}
                  </span>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={createAndAssign}
                    disabled={saving || !newName.trim()}
                    className="flex-1 rounded-lg bg-charcoal-900 text-white text-xs py-1.5 font-medium hover:bg-charcoal-700 disabled:opacity-40 transition-colors"
                  >
                    {saving ? 'Creating…' : 'Create & assign'}
                  </button>
                  <button
                    onClick={() => setCreating(false)}
                    className="px-3 rounded-lg border border-charcoal-200 text-xs text-charcoal-500 hover:bg-charcoal-50 transition-colors"
                  >
                    Back
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
