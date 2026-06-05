'use client'

/**
 * EmailComposer
 *
 * Email composer with template picker and send history. Matching the visual
 * style of the existing NotesPanel / CallLogger components.
 */

import { useState, useEffect, useRef } from 'react'
import { Mail, Send, ChevronDown, Eye, MousePointerClick, Paperclip, X } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { sanitizeContent } from '@/lib/sanitize'
import { Button, useToast } from '@/components/ui'
import { MergeTagPicker } from './MergeTagPicker'
import { FilePicker, type PickedFile } from '@/components/admin/FilePicker'

type EmailTemplate = {
  id:      string
  name:    string
  subject: string
  body:    string
}

type MarketReportSummary = { id: string; slug: string; title: string; area: string | null; reportMonth: string | null; excerpt: string | null }

function buildReportEmailBlock(report: MarketReportSummary, origin: string): string {
  const label = [report.area, report.reportMonth].filter(Boolean).join(' · ') || 'Market Report'
  return `<div style="font-family:Arial,sans-serif;max-width:600px;background:#fafaf9;border-left:4px solid #c9a227;border-radius:4px;padding:20px 24px;margin:16px 0">
  <p style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#b45309;margin:0 0 6px">${label}</p>
  <h2 style="font-family:Georgia,serif;font-size:20px;font-weight:700;color:#1c1917;margin:0 0 10px;line-height:1.3">${report.title}</h2>${report.excerpt ? `\n  <p style="font-size:14px;color:#6b7280;margin:0 0 16px;line-height:1.6">${report.excerpt}</p>` : ''}
  <a href="${origin}/market-report/${report.slug}" style="display:inline-block;padding:10px 20px;background:#1c1917;color:#ffffff;font-size:13px;font-weight:600;text-decoration:none;border-radius:6px">Read the Full Report →</a>
</div>`
}

export type EmailEntry = {
  id:          string
  direction:   'inbound' | 'outbound'
  status:      string
  subject:     string
  body:        string
  fromEmail:   string | null
  toEmail:     string | null
  openCount:   number
  clickCount:  number
  openedAt:    Date | string | null
  template:    { name: string } | null
  sentBy:      { name: string } | null
  sentAt:      Date | string
}

interface EmailComposerProps {
  emails:          EmailEntry[]
  contactId:       string
  contactEmail:    string | null
  emailOptOut?:    boolean
  initialSubject?: string
  initialBody?:    string
}

export function EmailComposer({ emails, contactId, contactEmail, emailOptOut = false, initialSubject, initialBody }: EmailComposerProps) {
  const [templates, setTemplates]         = useState<EmailTemplate[]>([])
  const [marketReports, setMarketReports] = useState<MarketReportSummary[]>([])
  const [subject, setSubject]             = useState(initialSubject ?? '')
  const [body, setBody]                   = useState(initialBody ?? '')
  const [signature, setSignature]         = useState('')
  const [templateId, setTemplateId]       = useState('')
  const [attachments, setAttachments]     = useState<PickedFile[]>([])
  const [showPicker,  setShowPicker]      = useState(false)
  const [expanded,    setExpanded]        = useState<string | null>(null)
  const [sending,     setSending]         = useState(false)
  const [sentEmails,  setSentEmails]      = useState<EmailEntry[]>(emails)
  const { toast }                         = useToast()
  const bodyRef                           = useRef<HTMLTextAreaElement>(null)

  // Load templates, signature, and published market reports on mount
  useEffect(() => {
    fetch('/api/email-templates')
      .then(r => r.json())
      .then(json => setTemplates(json.data ?? []))
      .catch(() => {})
    fetch('/api/settings/signature')
      .then(r => r.json())
      .then(json => { if (json.data?.emailSignature) setSignature(json.data.emailSignature) })
      .catch(() => {})
    fetch('/api/market-reports?status=published')
      .then(r => r.json())
      .then(d => setMarketReports(Array.isArray(d) ? d : []))
      .catch(() => {})
  }, [])

  // When a template is selected, pre-fill subject and body
  function applyTemplate(id: string) {
    const tmpl = templates.find(t => t.id === id)
    if (!tmpl) return
    setTemplateId(id)
    setSubject(tmpl.subject)
    setBody(tmpl.body)
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
    setBody(body.slice(0, start) + html + body.slice(end))
    toast('success', 'Report block inserted', report.title)
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(start + html.length, start + html.length)
    })
  }

  function removeAttachment(index: number) {
    setAttachments(prev => prev.filter((_, i) => i !== index))
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!subject.trim() || !body.trim() || !contactEmail) return
    setSending(true)
    try {
      const finalBody = signature.trim()
        ? `${body.trim()}\n\n<hr style="border:none;border-top:1px solid #e5e5e5;margin:16px 0"/>\n${signature.trim()}`
        : body.trim()

      const formData = new FormData()
      formData.append('contactId', contactId)
      formData.append('subject',   subject.trim())
      formData.append('body',      finalBody)
      formData.append('toEmail',   contactEmail)
      if (templateId) formData.append('templateId', templateId)
      // Send existing-file references by URL — API reads them from disk
      attachments.forEach((a, i) => {
        formData.append(`existingAttachmentUrl_${i}`,  a.url)
        formData.append(`existingAttachmentName_${i}`, a.name)
      })

      const res = await fetch('/api/emails', { method: 'POST', body: formData })
      if (!res.ok) throw new Error('Failed to send')
      const { data } = await res.json()
      setSentEmails(prev => [data, ...prev])
      setSubject('')
      setBody('')
      setTemplateId('')
      setAttachments([])
      toast('success', 'Email sent', `Delivered to ${contactEmail}`)
    } catch (err) {
      console.error(err)
      toast('error', 'Failed to send email', 'Check SMTP configuration in settings.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Compose form */}
      {emailOptOut ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          This contact has opted out of email communications. Edit the contact to re-enable.
        </div>
      ) : (
        <form onSubmit={handleSend} className="rounded-xl border border-charcoal-200 bg-charcoal-50 p-4 flex flex-col gap-3">
          <p className="text-xs font-semibold text-charcoal-700 uppercase tracking-wide">Compose Email</p>

          {templates.length > 0 && (
            <div>
              <label className="text-xs text-charcoal-500 mb-1 block">Template (optional)</label>
              <select
                value={templateId}
                onChange={e => applyTemplate(e.target.value)}
                className="w-full rounded-lg border border-charcoal-200 bg-white px-3 py-1.5 text-sm text-charcoal-900 focus:outline-none focus:ring-2 focus:ring-charcoal-900"
              >
                <option value="">— No template —</option>
                {templates.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="text-xs text-charcoal-500 mb-1 block">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="Subject line…"
              className="w-full rounded-lg border border-charcoal-200 bg-white px-3 py-1.5 text-sm text-charcoal-900 placeholder:text-charcoal-400 focus:outline-none focus:ring-2 focus:ring-charcoal-900"
            />
          </div>

          {marketReports.length > 0 && (
            <div>
              <label className="text-xs text-charcoal-500 mb-1 block">Insert Market Report</label>
              <div className="flex gap-2">
                <select
                  id="composer-report-select"
                  defaultValue=""
                  className="flex-1 rounded-lg border border-charcoal-200 bg-white px-3 py-1.5 text-sm text-charcoal-900 focus:outline-none focus:ring-2 focus:ring-charcoal-900"
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
                    const sel = document.getElementById('composer-report-select') as HTMLSelectElement
                    if (!sel.value) { toast('error', 'No report selected', 'Choose a market report from the dropdown first.'); return }
                    const report = marketReports.find(r => r.id === sel.value)
                    if (report) insertReportBlock(report)
                  }}
                  className="px-3 py-1.5 rounded-lg bg-charcoal-800 text-white text-xs font-medium hover:bg-charcoal-900 transition-colors whitespace-nowrap"
                >
                  Insert
                </button>
              </div>
              <p className="text-[10px] text-charcoal-400 mt-1">Inserts a styled report card into the body. The HTML in the textarea will render as a formatted block in the recipient&apos;s email client.</p>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-charcoal-500">Body</label>
            <MergeTagPicker textareaRef={bodyRef} value={body} onChange={setBody} />
            <textarea
              ref={bodyRef}
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="Email body (HTML allowed)…"
              rows={5}
              className="w-full rounded-lg border border-charcoal-200 bg-white px-3 py-2 text-sm text-charcoal-900 placeholder:text-charcoal-400 focus:outline-none focus:ring-2 focus:ring-charcoal-900 resize-none font-mono"
            />
          </div>

          {/* Signature */}
          {signature.trim() && (
            <div className="border-t border-charcoal-100 pt-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-charcoal-400">Signature (appended on send)</span>
                <button type="button" onClick={() => setSignature('')} className="text-xs text-charcoal-400 hover:text-red-500 transition-colors">Remove</button>
              </div>
              <textarea
                value={signature}
                onChange={e => setSignature(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-charcoal-100 bg-charcoal-50 px-3 py-2 text-xs text-charcoal-500 focus:outline-none focus:ring-1 focus:ring-charcoal-300 resize-none"
              />
            </div>
          )}

          {/* Attachments */}
          <div>
            <button
              type="button"
              onClick={() => setShowPicker(true)}
              className="flex items-center gap-1.5 text-xs text-charcoal-500 hover:text-charcoal-800 transition-colors"
            >
              <Paperclip size={13} />
              Attach files
            </button>
            {attachments.length > 0 && (
              <ul className="mt-2 flex flex-col gap-1">
                {attachments.map((f, i) => (
                  <li key={i} className="flex items-center gap-2 text-xs text-charcoal-700">
                    <Paperclip size={11} className="text-charcoal-400 shrink-0" />
                    <span className="truncate flex-1">{f.name}</span>
                    <button type="button" onClick={() => removeAttachment(i)} className="text-charcoal-400 hover:text-red-500 transition-colors">
                      <X size={12} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {contactEmail ? (
            <Button type="submit" variant="primary" size="sm" loading={sending} leftIcon={<Send size={14} />}>
              Send to {contactEmail}
            </Button>
          ) : (
            <p className="text-xs text-charcoal-400">Add an email address to this contact to send emails.</p>
          )}
        </form>
      )}

      {showPicker && (
        <FilePicker
          multiple
          onSelect={picked => { setAttachments(prev => [...prev, ...picked.filter(p => !prev.some(a => a.url === p.url))]); setShowPicker(false) }}
          onClose={() => setShowPicker(false)}
        />
      )}

      {/* Email history */}
      <div className="flex flex-col gap-3">
        {sentEmails.length === 0 && <p className="text-sm text-charcoal-400">No emails yet.</p>}
        {sentEmails.map(email => (
          <div key={email.id} className="rounded-xl border border-charcoal-100 bg-white overflow-hidden">
            <button
              type="button"
              onClick={() => setExpanded(prev => prev === email.id ? null : email.id)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-charcoal-50 transition-colors"
            >
              <div className={`h-6 w-6 rounded-full flex items-center justify-center shrink-0 ${
                email.direction === 'inbound' ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'
              }`}>
                <Mail size={12} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-charcoal-900 truncate">{email.subject}</p>
                <div className="flex items-center gap-3 text-xs text-charcoal-400 mt-0.5">
                  <span>{formatDate(new Date(email.sentAt), { month: 'short', day: 'numeric' })}</span>
                  {email.openCount > 0 && (
                    <span className="flex items-center gap-1 text-green-600"><Eye size={10} />{email.openCount} open{email.openCount !== 1 ? 's' : ''}</span>
                  )}
                  {email.clickCount > 0 && (
                    <span className="flex items-center gap-1 text-blue-600"><MousePointerClick size={10} />{email.clickCount} click{email.clickCount !== 1 ? 's' : ''}</span>
                  )}
                </div>
              </div>
              <ChevronDown size={14} className={`text-charcoal-400 transition-transform ${expanded === email.id ? 'rotate-180' : ''}`} />
            </button>
            {expanded === email.id && (
              <div className="border-t border-charcoal-100 px-4 py-3">
                <div
                  className="text-sm text-charcoal-700 prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: sanitizeContent(email.body) }}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
