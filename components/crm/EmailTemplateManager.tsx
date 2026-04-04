'use client'

/**
 * EmailTemplateManager
 *
 * Full CRUD UI for email templates. Used on /admin/email-templates.
 *
 * Features:
 *  - List templates as cards (with category badge, subject, updated-at)
 *  - Create / Edit modal with "Edit" and "Preview" tabs
 *  - Import HTML from a local .html file directly into the body field
 *  - Merge-tag picker for subject and body
 *  - Delete with inline per-card confirmation
 *  - Category filter pills at the top
 */

import { useState, useRef } from 'react'
import {
  Plus, Pencil, Trash2, Eye, FileCode2, Upload,
  Mail, LayoutTemplate, Clock,
} from 'lucide-react'
import { Button, Input, Select, Textarea, Modal, useToast } from '@/components/ui'
import { MergeTagPicker } from './MergeTagPicker'
import { formatDate } from '@/lib/utils'
import type { RefObject } from 'react'

// ── Types ────────────────────────────────────────────────────────────────────

export type EmailTemplate = {
  id:        string
  name:      string
  subject:   string
  body:      string
  category:  string | null
  isActive:  boolean
  createdAt: string
  updatedAt: string
}

interface Props {
  initialTemplates: EmailTemplate[]
}

// ── Constants ────────────────────────────────────────────────────────────────

const FILTER_TABS = [
  { value: '',           label: 'All'        },
  { value: 'newsletter', label: 'Newsletter' },
  { value: 'listing',    label: 'Listing'    },
  { value: 'follow_up',  label: 'Follow-Up'  },
  { value: 'custom',     label: 'Custom'     },
]

const CATEGORY_OPTIONS = [
  { value: 'newsletter', label: 'Newsletter' },
  { value: 'listing',    label: 'Listing'    },
  { value: 'follow_up',  label: 'Follow-Up'  },
  { value: 'custom',     label: 'Custom'     },
]

const CATEGORY_COLORS: Record<string, string> = {
  newsletter: 'bg-blue-100 text-blue-700',
  listing:    'bg-emerald-100 text-emerald-700',
  follow_up:  'bg-amber-100 text-amber-700',
  custom:     'bg-purple-100 text-purple-700',
}

/** Sample values substituted during preview rendering */
const PREVIEW_VARS: Record<string, string> = {
  firstName:        'Jane',
  lastName:         'Smith',
  fullName:         'Jane Smith',
  email:            'jane@example.com',
  phone:            '(416) 555-0100',
  agentName:        'Michael Taylor',
  agentEmail:       'michael@michaeltaylor.ca',
  agentPhone:       '(416) 555-0199',
  agentDesignation: 'REALTOR®',
  agentBrokerage:   'LuxeRealty Inc., Brokerage',
  officeAddress:    '123 King St W, Toronto, ON M5H 1A1',
  agentBio:         'Michael Taylor is a top-producing REALTOR® with over 15 years of experience in the GTA luxury market.',
  agentImage:       '',
  brandLogo:        '',
  MONTH:            new Date().toLocaleString('en-CA', { month: 'long' }),
  YEAR:             String(new Date().getFullYear()),
}

function applyPreview(text: string) {
  // Resolve standard {{variable}} tags
  let out = text.replace(/\{\{(\w+)\}\}/g, (_, k) => PREVIEW_VARS[k] ?? `{{${k}}}`)
  // Render listing tags as inline placeholders so the preview is readable
  out = out.replace(
    /\{\{listing:([^:}]+):(\w+)\}\}/g,
    (_, mls: string, field: string) => `[Listing ${mls} — ${field}]`,
  )
  // Render random listing tags as inline placeholders
  out = out.replace(
    /\{\{randomListing_(\d+):(\w+)\}\}/g,
    (_, slot: string, field: string) => `[Random Listing ${slot} — ${field}]`,
  )
  return out
}

function emptyForm() {
  return { name: '', subject: '', body: '', category: '' }
}

// ── Component ────────────────────────────────────────────────────────────────

export function EmailTemplateManager({ initialTemplates }: Props) {
  const { toast } = useToast()

  const [templates, setTemplates]   = useState<EmailTemplate[]>(initialTemplates)
  const [activeFilter, setFilter]   = useState('')

  // Modal
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing]     = useState<EmailTemplate | null>(null)
  const [form, setForm]           = useState(emptyForm())
  const [saving, setSaving]       = useState(false)
  const [activeTab, setTab]       = useState<'edit' | 'preview'>('edit')

  // Delete confirmation
  const [deleteId, setDeleteId]   = useState<string | null>(null)
  const [deleting, setDeleting]   = useState(false)

  // Refs for MergeTagPicker cursor insertion
  const subjectRef = useRef<HTMLInputElement>(null)
  const bodyRef    = useRef<HTMLTextAreaElement>(null)

  // ── Computed ────────────────────────────────────────────────────────────

  const filtered = activeFilter
    ? templates.filter(t => t.category === activeFilter)
    : templates

  // ── Modal helpers ────────────────────────────────────────────────────────

  function openCreate() {
    setEditing(null)
    setForm(emptyForm())
    setTab('edit')
    setModalOpen(true)
  }

  function openEdit(tpl: EmailTemplate) {
    setEditing(tpl)
    setForm({ name: tpl.name, subject: tpl.subject, body: tpl.body, category: tpl.category ?? '' })
    setTab('edit')
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setEditing(null)
  }

  // Load a local .html file into the body field
  function importHtmlFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      setForm(f => ({ ...f, body: (ev.target?.result as string) ?? '' }))
      toast('success', `Imported "${file.name}"`);
    }
    reader.readAsText(file)
    e.target.value = '' // allow re-selecting same file
  }

  // ── API ──────────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!form.name.trim() || !form.subject.trim() || !form.body.trim()) {
      toast('error', 'Name, subject, and body are required')
      return
    }
    setSaving(true)
    try {
      const payload = {
        name:     form.name.trim(),
        subject:  form.subject.trim(),
        body:     form.body,
        category: form.category || undefined,
      }
      if (editing) {
        const res  = await fetch(`/api/email-templates/${editing.id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Save failed')
        setTemplates(prev => prev.map(t => t.id === editing.id ? data.data : t))
        toast('success', 'Template updated')
      } else {
        const res  = await fetch('/api/email-templates', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Create failed')
        setTemplates(prev => [data.data, ...prev])
        toast('success', 'Template created')
      }
      closeModal()
    } catch (err) {
      toast('error', err instanceof Error ? err.message : 'Error saving template')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    setDeleting(true)
    try {
      const res = await fetch(`/api/email-templates/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      setTemplates(prev => prev.filter(t => t.id !== id))
      setDeleteId(null)
      toast('success', 'Template deleted')
    } catch (err) {
      toast('error', err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setDeleting(false)
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Filters + New button ──────────────────────────────────────── */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          {FILTER_TABS.map(tab => (
            <button
              key={tab.value}
              onClick={() => setFilter(tab.value)}
              className={[
                'rounded-full border px-4 py-1.5 text-sm font-medium transition-colors',
                activeFilter === tab.value
                  ? 'bg-charcoal-900 text-white border-charcoal-900'
                  : 'border-charcoal-200 bg-white text-charcoal-600 hover:border-charcoal-400',
              ].join(' ')}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus size={15} className="mr-1.5" />
          New Template
        </Button>
      </div>

      {/* ── Grid ─────────────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-charcoal-200 bg-white py-20 text-center">
          <LayoutTemplate size={40} className="mb-4 text-charcoal-300" />
          <p className="font-medium text-charcoal-500">No templates yet</p>
          <p className="mt-1 mb-5 text-sm text-charcoal-400">Create your first email template to get started</p>
          <Button onClick={openCreate} size="sm">
            <Plus size={15} className="mr-1.5" /> New Template
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(tpl => (
            <TemplateCard
              key={tpl.id}
              template={tpl}
              confirmingDelete={deleteId === tpl.id}
              deleting={deleting}
              onEdit={() => openEdit(tpl)}
              onDeleteRequest={() => setDeleteId(tpl.id)}
              onDeleteCancel={() => setDeleteId(null)}
              onDeleteConfirm={() => handleDelete(tpl.id)}
            />
          ))}
        </div>
      )}

      {/* ── Create / Edit modal ───────────────────────────────────────── */}
      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editing ? 'Edit Template' : 'New Email Template'}
        size="xl"
      >
        {/* Tab bar */}
        <div className="-mt-2 mb-5 flex gap-1 border-b border-charcoal-100">
          {(['edit', 'preview'] as const).map(tab => (
            <button
              key={tab}
              type="button"
              onClick={() => setTab(tab)}
              className={[
                '-mb-px border-b-2 px-4 py-2 text-sm font-medium capitalize transition-colors',
                activeTab === tab
                  ? 'border-gold-500 text-charcoal-900'
                  : 'border-transparent text-charcoal-500 hover:text-charcoal-700',
              ].join(' ')}
            >
              {tab === 'edit'
                ? <span className="flex items-center gap-1.5"><Pencil size={12} /> Edit</span>
                : <span className="flex items-center gap-1.5"><Eye    size={12} /> Preview</span>
              }
            </button>
          ))}
        </div>

        {/* ── Edit tab ──────────────────────────────────────────────── */}
        {activeTab === 'edit' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-charcoal-600">
                  Template Name
                </label>
                <Input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Monthly Market Update"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-charcoal-600">
                  Category
                </label>
                <Select
                  value={form.category}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  options={[{ value: '', label: 'Uncategorized' }, ...CATEGORY_OPTIONS]}
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-charcoal-600">
                Subject Line
              </label>
              <Input
                ref={subjectRef}
                value={form.subject}
                onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                placeholder="e.g. {{firstName}}, here's your GTA Market Update for March"
              />
              <div className="mt-1.5">
                <MergeTagPicker
                  textareaRef={subjectRef as RefObject<HTMLInputElement | HTMLTextAreaElement | null>}
                  value={form.subject}
                  onChange={val => setForm(f => ({ ...f, subject: val }))}
                />
              </div>
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wide text-charcoal-600">
                  HTML Body
                </label>
                <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-charcoal-200 bg-white px-3 py-1.5 text-xs font-medium text-charcoal-600 transition-colors hover:bg-charcoal-50">
                  <Upload size={12} />
                  Import .html File
                  <input type="file" accept=".html,.htm" className="hidden" onChange={importHtmlFile} />
                </label>
              </div>
              <Textarea
                ref={bodyRef}
                value={form.body}
                onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
                placeholder="Paste or type your HTML email body here…"
                rows={16}
                className="font-mono text-xs leading-relaxed"
              />
              <div className="mt-1.5">
                <MergeTagPicker
                  textareaRef={bodyRef as RefObject<HTMLInputElement | HTMLTextAreaElement | null>}
                  value={form.body}
                  onChange={val => setForm(f => ({ ...f, body: val }))}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-charcoal-100 pt-4">
              <Button variant="ghost" onClick={closeModal} disabled={saving}>Cancel</Button>
              <Button onClick={handleSave} loading={saving}>
                {editing ? 'Save Changes' : 'Create Template'}
              </Button>
            </div>
          </div>
        )}

        {/* ── Preview tab ───────────────────────────────────────────── */}
        {activeTab === 'preview' && (
          <div>
            <div className="mb-3 rounded-lg bg-charcoal-50 px-4 py-2.5 text-sm text-charcoal-700">
              <span className="font-semibold text-charcoal-500">Subject: </span>
              {applyPreview(form.subject) || <em className="text-charcoal-400">No subject set</em>}
            </div>
            {form.body ? (
              <div className="overflow-hidden rounded-xl border border-charcoal-200" style={{ height: 520 }}>
                <iframe
                  srcDoc={applyPreview(form.body)}
                  title="Email preview"
                  className="h-full w-full"
                  sandbox="allow-same-origin"
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-charcoal-200 py-20 text-charcoal-400">
                <FileCode2 size={32} className="mb-3" />
                <p className="text-sm">Add an HTML body on the Edit tab to see the preview</p>
              </div>
            )}
            <div className="mt-4 flex justify-end gap-3 border-t border-charcoal-100 pt-4">
              <Button variant="ghost" onClick={() => setTab('edit')}>
                <Pencil size={13} className="mr-1.5" /> Back to Edit
              </Button>
              <Button onClick={handleSave} loading={saving}>
                {editing ? 'Save Changes' : 'Create Template'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}

// ── TemplateCard ─────────────────────────────────────────────────────────────

interface CardProps {
  template:         EmailTemplate
  confirmingDelete: boolean
  deleting:         boolean
  onEdit:           () => void
  onDeleteRequest:  () => void
  onDeleteCancel:   () => void
  onDeleteConfirm:  () => void
}

function TemplateCard({
  template, confirmingDelete, deleting,
  onEdit, onDeleteRequest, onDeleteCancel, onDeleteConfirm,
}: CardProps) {
  const catColor = CATEGORY_COLORS[template.category ?? ''] ?? 'bg-charcoal-100 text-charcoal-600'

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-charcoal-200 bg-white transition-all hover:border-charcoal-300 hover:shadow-sm">

      {/* Header */}
      <div className="flex items-start justify-between gap-2 px-5 pb-3 pt-5">
        <div className="min-w-0">
          <h3 className="truncate font-serif text-base font-semibold text-charcoal-900">
            {template.name}
          </h3>
          {template.category && (
            <span className={`mt-1.5 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${catColor}`}>
              {template.category.replace('_', ' ')}
            </span>
          )}
        </div>
        <Mail size={18} className="mt-0.5 shrink-0 text-charcoal-300" />
      </div>

      {/* Subject preview */}
      <div className="flex-1 px-5 pb-4">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-charcoal-400">Subject</p>
        <p className="line-clamp-2 text-sm leading-relaxed text-charcoal-700">{template.subject}</p>
      </div>

      {/* Updated-at */}
      <div className="flex items-center gap-1.5 px-5 pb-3 text-xs text-charcoal-400">
        <Clock size={11} />
        Updated {formatDate(template.updatedAt)}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between border-t border-charcoal-100 px-5 py-3">
        {confirmingDelete ? (
          <div className="flex w-full items-center gap-2">
            <p className="flex-1 text-xs font-medium text-red-600">Delete this template?</p>
            <Button size="sm" variant="ghost" onClick={onDeleteCancel} disabled={deleting}>
              Cancel
            </Button>
            <Button size="sm" variant="danger" onClick={onDeleteConfirm} loading={deleting}>
              Delete
            </Button>
          </div>
        ) : (
          <>
            <button
              onClick={onEdit}
              className="flex items-center gap-1.5 text-sm font-medium text-charcoal-600 transition-colors hover:text-charcoal-900"
            >
              <Pencil size={13} /> Edit
            </button>
            <button
              onClick={onDeleteRequest}
              className="flex items-center gap-1.5 text-sm font-medium text-charcoal-400 transition-colors hover:text-red-600"
            >
              <Trash2 size={13} /> Delete
            </button>
          </>
        )}
      </div>
    </div>
  )
}
