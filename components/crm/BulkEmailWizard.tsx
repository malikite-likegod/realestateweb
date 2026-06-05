'use client'

/**
 * BulkEmailWizard
 *
 * 3-step wizard for sending a bulk email:
 *   1. Select recipients (by tag and/or individual contacts)
 *   2. Compose subject + body (with optional template + merge tags)
 *   3. Preview deduplicated list, schedule, and send
 */

import { useState, useRef, useEffect, useMemo } from 'react'
import { useRouter }                   from 'next/navigation'
import { ChevronRight, ChevronLeft, Mail, Search, Check, Clock } from 'lucide-react'
import { Button, useToast }            from '@/components/ui'
import { MergeTagPicker }              from './MergeTagPicker'
import type { ContactWithTags, Tag }   from '@/types'

// ── Types ────────────────────────────────────────────────────────────────────

type EmailTemplate = { id: string; name: string; subject: string; body: string }
type MarketReportSummary = { id: string; slug: string; title: string; area: string | null; reportMonth: string | null; excerpt: string | null }

function buildReportEmailBlock(report: MarketReportSummary, origin: string): string {
  const label = [report.area, report.reportMonth].filter(Boolean).join(' · ') || 'Market Report'
  return `<div style="font-family:Arial,sans-serif;max-width:600px;background:#fafaf9;border-left:4px solid #c9a227;border-radius:4px;padding:20px 24px;margin:16px 0">
  <p style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#b45309;margin:0 0 6px">${label}</p>
  <h2 style="font-family:Georgia,serif;font-size:20px;font-weight:700;color:#1c1917;margin:0 0 10px;line-height:1.3">${report.title}</h2>${report.excerpt ? `\n  <p style="font-size:14px;color:#6b7280;margin:0 0 16px;line-height:1.6">${report.excerpt}</p>` : ''}
  <a href="${origin}/market-report/${report.slug}" style="display:inline-block;padding:10px 20px;background:#1c1917;color:#ffffff;font-size:13px;font-weight:600;text-decoration:none;border-radius:6px">Read the Full Report →</a>
</div>`
}

interface Props {
  contacts:        ContactWithTags[]
  tags:            Tag[]
  preSelectedIds?: string[]
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function computeRecipients(
  contacts:        ContactWithTags[],
  selectedTagIds:  string[],
  selectedIds:     string[],
): ContactWithTags[] {
  const tagSet  = new Set(selectedTagIds)
  const idSet   = new Set(selectedIds)
  const result  = new Map<string, ContactWithTags>()

  for (const c of contacts) {
    if (idSet.has(c.id) || c.tags.some(t => tagSet.has(t.tag.id))) {
      result.set(c.id, c)
    }
  }
  return Array.from(result.values())
}

// ── Component ────────────────────────────────────────────────────────────────

export function BulkEmailWizard({ contacts, tags, preSelectedIds = [] }: Props) {
  const router            = useRouter()
  const { toast }         = useToast()
  const bodyRef           = useRef<HTMLTextAreaElement>(null)
  const subjectRef        = useRef<HTMLInputElement | null>(null)

  // Step — always start at 1; preSelectedIds pre-populate selectedIds state below
  const [step, setStep]   = useState<1 | 2 | 3>(1)

  // Step 1 state — default to 'individual' mode when arriving with pre-selected contacts
  const [mode, setMode]             = useState<'tag' | 'individual'>(preSelectedIds.length > 0 ? 'individual' : 'tag')
  const [selectedTagIds, setTagIds] = useState<string[]>([])
  const [selectedIds, setIds]       = useState<string[]>(preSelectedIds)
  const [search, setSearch]         = useState('')

  // Step 2 state
  const [templates, setTemplates]         = useState<EmailTemplate[]>([])
  const [marketReports, setMarketReports] = useState<MarketReportSummary[]>([])
  const [templateId, setTemplateId]       = useState('')
  const [subject, setSubject]             = useState('')
  const [body, setBody]                   = useState('')

  // Step 3 state
  const [scheduledAt, setScheduledAt] = useState('')
  const [sending, setSending]         = useState(false)

  // Load templates and published market reports
  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/email-templates', { signal: controller.signal })
      .then(r => r.json())
      .then(d => setTemplates(d.data ?? []))
      .catch(err => { if (err.name !== 'AbortError') console.error('[BulkEmailWizard] template fetch failed:', err) })
    fetch('/api/market-reports?status=published', { signal: controller.signal })
      .then(r => r.json())
      .then(d => setMarketReports(Array.isArray(d) ? d : []))
      .catch(() => {})
    return () => controller.abort()
  }, [])

  // Computed recipients (deduplicated, memoized)
  const recipients = useMemo(
    () => computeRecipients(contacts, selectedTagIds, selectedIds),
    [contacts, selectedTagIds, selectedIds],
  )
  const withEmail  = useMemo(() => recipients.filter(c => c.email),  [recipients])
  const noEmail    = useMemo(() => recipients.filter(c => !c.email), [recipients])

  // ── Step 1 helpers ──────────────────────────────────────────────────────

  function toggleTag(id: string) {
    setTagIds(prev =>
      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
    )
  }

  function toggleContact(id: string) {
    setIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  const filteredContacts = useMemo(
    () => search.trim()
      ? contacts.filter(c =>
          `${c.firstName} ${c.lastName} ${c.email ?? ''}`.toLowerCase().includes(search.toLowerCase())
        )
      : contacts,
    [contacts, search],
  )

  // ── Step 2 helpers ──────────────────────────────────────────────────────

  function pickTemplate(id: string) {
    setTemplateId(id)
    const tpl = templates.find(t => t.id === id)
    if (tpl) { setSubject(tpl.subject); setBody(tpl.body) }
  }

  function insertReportBlock(report: MarketReportSummary) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin
    const html   = buildReportEmailBlock(report, appUrl)
    const el     = bodyRef.current
    if (!el) {
      setBody(prev => prev + '\n\n' + html)
      toast('success', 'Report block inserted', report.title)
      return
    }
    const start = el.selectionStart ?? 0
    const end   = el.selectionEnd   ?? 0
    const next  = body.slice(0, start) + html + body.slice(end)
    setBody(next)
    toast('success', 'Report block inserted', report.title)
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(start + html.length, start + html.length)
    })
  }

  // ── Step 3: Send ────────────────────────────────────────────────────────

  async function handleSend() {
    setSending(true)
    try {
      const res = await fetch('/api/emails/bulk', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          tagIds:      selectedTagIds,
          contactIds:  selectedIds,
          subject,
          body,
          templateId:  templateId || undefined,
          scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Send failed')

      toast(
        'success',
        scheduledAt ? 'Emails scheduled' : 'Emails queued',
        `${data.scheduled} email${data.scheduled !== 1 ? 's' : ''} queued${data.skipped > 0 ? `, ${data.skipped} skipped (no email)` : ''}.`,
      )
      router.push('/admin/contacts')
    } catch (err) {
      toast(
        'error',
        'Send failed',
        err instanceof Error ? err.message : 'Something went wrong.',
      )
    } finally {
      setSending(false)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="max-w-3xl mx-auto">

      {/* Progress indicator */}
      <div className="flex items-center gap-2 mb-8">
        {(['Recipients', 'Compose', 'Preview & Send'] as const).map((label, i) => {
          const n = (i + 1) as 1 | 2 | 3
          return (
            <div key={label} className="flex items-center gap-2">
              <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold ${
                step === n ? 'bg-charcoal-900 text-white' :
                step > n   ? 'bg-green-500 text-white'   :
                             'bg-charcoal-100 text-charcoal-400'
              }`}>
                {step > n ? <Check size={12} /> : n}
              </div>
              <span className={`text-sm ${step === n ? 'font-semibold text-charcoal-900' : 'text-charcoal-400'}`}>{label}</span>
              {i < 2 && <ChevronRight size={14} className="text-charcoal-300" />}
            </div>
          )
        })}
      </div>

      {/* ── Step 1: Recipients ─────────────────────────────────────────── */}
      {step === 1 && (
        <div className="space-y-5">
          <h2 className="text-lg font-semibold text-charcoal-900">Select Recipients</h2>

          {/* Mode toggle */}
          <div className="flex gap-2">
            {(['tag', 'individual'] as const).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  mode === m ? 'bg-charcoal-900 text-white' : 'bg-charcoal-100 text-charcoal-600 hover:bg-charcoal-200'
                }`}
              >
                {m === 'tag' ? 'By Tag' : 'Individual'}
              </button>
            ))}
          </div>

          {mode === 'tag' && (
            <div className="space-y-2">
              {tags.length === 0 && (
                <p className="text-sm text-charcoal-400">No tags found. Add tags to contacts first.</p>
              )}
              {tags.map(tag => {
                const count = contacts.filter(c => c.tags.some(t => t.tag.id === tag.id)).length
                const active = selectedTagIds.includes(tag.id)
                return (
                  <button
                    key={tag.id}
                    onClick={() => toggleTag(tag.id)}
                    className={`flex items-center justify-between w-full px-4 py-2.5 rounded-lg border text-sm transition-colors ${
                      active ? 'border-indigo-400 bg-indigo-50 text-indigo-800' : 'border-charcoal-200 bg-white text-charcoal-700 hover:bg-charcoal-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: tag.color }} />
                      <span className="font-medium">{tag.name}</span>
                    </div>
                    <span className="text-xs text-charcoal-400">{count} contact{count !== 1 ? 's' : ''}</span>
                  </button>
                )
              })}
            </div>
          )}

          {mode === 'individual' && (
            <div className="space-y-2">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-charcoal-400" />
                <input
                  type="text"
                  placeholder="Search contacts..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-charcoal-200 text-sm focus:outline-none focus:ring-1 focus:ring-charcoal-400"
                />
              </div>
              <div className="max-h-72 overflow-y-auto divide-y divide-charcoal-100 rounded-lg border border-charcoal-100">
                {filteredContacts.map(c => {
                  const checked = selectedIds.includes(c.id)
                  return (
                    <label
                      key={c.id}
                      className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${checked ? 'bg-indigo-50' : 'bg-white hover:bg-charcoal-50'}`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleContact(c.id)}
                        className="rounded border-charcoal-300 text-charcoal-900"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-charcoal-900 truncate">{c.firstName} {c.lastName}</p>
                        <p className="text-xs text-charcoal-400 truncate">{c.email ?? 'No email'}</p>
                      </div>
                    </label>
                  )
                })}
              </div>
            </div>
          )}

          {/* Live recipient count */}
          <div className="text-sm text-charcoal-500">
            <span className="font-semibold text-charcoal-900">{recipients.length}</span> unique recipient{recipients.length !== 1 ? 's' : ''} selected
            {noEmail.length > 0 && <span className="text-amber-600 ml-2">({noEmail.length} have no email and will be skipped)</span>}
          </div>
          {recipients.length > 2000 && (
            <p className="text-xs text-red-600 font-medium">
              Warning: recipient list exceeds the 2000-contact limit. Please narrow your selection.
            </p>
          )}

          <div className="flex justify-end">
            <Button
              variant="primary"
              rightIcon={<ChevronRight size={16} />}
              disabled={recipients.length === 0 || withEmail.length === 0 || withEmail.length > 2000}
              onClick={() => setStep(2)}
            >
              Next: Compose
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 2: Compose ────────────────────────────────────────────── */}
      {step === 2 && (
        <div className="space-y-5">
          <h2 className="text-lg font-semibold text-charcoal-900">Compose Email</h2>

          {/* Template picker */}
          {templates.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-charcoal-500 uppercase tracking-wide mb-1">
                Start from template (optional)
              </label>
              <select
                value={templateId}
                onChange={e => pickTemplate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-charcoal-200 text-sm focus:outline-none focus:ring-1 focus:ring-charcoal-400 bg-white"
              >
                <option value="">— No template —</option>
                {templates.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Market report insert */}
          {marketReports.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-charcoal-500 uppercase tracking-wide mb-1">
                Insert Market Report
              </label>
              <div className="flex gap-2">
                <select
                  id="bulk-report-select"
                  defaultValue=""
                  className="flex-1 px-3 py-2 rounded-lg border border-charcoal-200 text-sm focus:outline-none focus:ring-1 focus:ring-charcoal-400 bg-white"
                >
                  <option value="">— Select a report —</option>
                  {marketReports.map(r => (
                    <option key={r.id} value={r.id}>
                      {[r.area, r.reportMonth].filter(Boolean).join(' · ')}{r.area || r.reportMonth ? ' — ' : ''}{r.title}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    const sel = document.getElementById('bulk-report-select') as HTMLSelectElement
                    if (!sel.value) { toast('error', 'No report selected', 'Choose a market report from the dropdown first.'); return }
                    const report = marketReports.find(r => r.id === sel.value)
                    if (report) insertReportBlock(report)
                  }}
                  className="px-3 py-2 rounded-lg bg-charcoal-800 text-white text-xs font-medium hover:bg-charcoal-900 transition-colors whitespace-nowrap"
                >
                  Insert Block
                </button>
              </div>
              <p className="text-[10px] text-charcoal-400 mt-1">Inserts a formatted report card with a link at the cursor position.</p>
            </div>
          )}

          {/* Subject */}
          <div>
            <label className="block text-xs font-semibold text-charcoal-500 uppercase tracking-wide mb-1">Subject</label>
            <input
              ref={subjectRef}
              type="text"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="Email subject…"
              className="w-full px-3 py-2 rounded-lg border border-charcoal-200 text-sm focus:outline-none focus:ring-1 focus:ring-charcoal-400"
            />
          </div>

          {/* Merge tags for subject */}
          <MergeTagPicker
            textareaRef={subjectRef}
            value={subject}
            onChange={setSubject}
          />

          {/* Body */}
          <div>
            <label className="block text-xs font-semibold text-charcoal-500 uppercase tracking-wide mb-1">Body (HTML)</label>
            <textarea
              ref={bodyRef}
              value={body}
              onChange={e => setBody(e.target.value)}
              rows={10}
              placeholder="Email body (HTML supported)…"
              className="w-full px-3 py-2 rounded-lg border border-charcoal-200 text-sm focus:outline-none focus:ring-1 focus:ring-charcoal-400 font-mono resize-y"
            />
          </div>

          {/* Merge tags for body */}
          <MergeTagPicker
            textareaRef={bodyRef}
            value={body}
            onChange={setBody}
          />

          <div className="flex justify-between">
            <Button variant="outline" leftIcon={<ChevronLeft size={16} />} onClick={() => setStep(1)}>
              Back
            </Button>
            <Button
              variant="primary"
              rightIcon={<ChevronRight size={16} />}
              disabled={!subject.trim() || !body.trim()}
              onClick={() => setStep(3)}
            >
              Next: Preview
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 3: Preview & Send ─────────────────────────────────────── */}
      {step === 3 && (
        <div className="space-y-5">
          <h2 className="text-lg font-semibold text-charcoal-900">Preview & Send</h2>

          {/* Recipient list */}
          <div>
            <p className="text-sm text-charcoal-600 mb-2">
              <span className="font-semibold text-charcoal-900">{withEmail.length}</span> email{withEmail.length !== 1 ? 's' : ''} will be sent
            </p>
            {noEmail.length > 0 && (
              <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                <Mail size={13} />
                {noEmail.length} contact{noEmail.length !== 1 ? 's' : ''} have no email address and will be skipped:&nbsp;
                {noEmail.map(c => `${c.firstName} ${c.lastName}`).join(', ')}
              </div>
            )}
            <div className="max-h-64 overflow-y-auto divide-y divide-charcoal-100 rounded-lg border border-charcoal-100">
              {withEmail.map(c => (
                <div key={c.id} className="flex items-center gap-3 px-4 py-2.5 bg-white text-sm">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-charcoal-900 truncate">{c.firstName} {c.lastName}</p>
                    <p className="text-xs text-charcoal-400 truncate">{c.email}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Subject preview */}
          <div className="px-3 py-2 bg-charcoal-50 rounded-lg text-sm">
            <span className="text-xs font-semibold text-charcoal-400 uppercase tracking-wide mr-2">Subject:</span>
            <span className="text-charcoal-700">{subject}</span>
          </div>

          {/* Schedule */}
          <div>
            <label className="block text-xs font-semibold text-charcoal-500 uppercase tracking-wide mb-1">
              <Clock size={12} className="inline mr-1" />
              Schedule (optional — leave blank to send immediately)
            </label>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={e => setScheduledAt(e.target.value)}
              className="px-3 py-2 rounded-lg border border-charcoal-200 text-sm focus:outline-none focus:ring-1 focus:ring-charcoal-400 bg-white"
            />
          </div>

          {withEmail.length > 2000 && (
            <p className="text-xs text-red-600 font-medium">
              Recipient list exceeds the 2000-contact limit. Go back and narrow your selection.
            </p>
          )}

          <div className="flex justify-between">
            <Button variant="outline" leftIcon={<ChevronLeft size={16} />} onClick={() => setStep(2)}>
              Back
            </Button>
            <Button
              variant="primary"
              leftIcon={<Mail size={16} />}
              onClick={handleSend}
              disabled={sending || withEmail.length === 0 || withEmail.length > 2000}
            >
              {sending ? 'Sending…' : scheduledAt ? 'Schedule Send' : `Send to ${withEmail.length} Contact${withEmail.length !== 1 ? 's' : ''}`}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
