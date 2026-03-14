'use client'

/**
 * EmailComposer
 *
 * Email composer with template picker and send history. Matching the visual
 * style of the existing NotesPanel / CallLogger components.
 */

import { useState, useEffect } from 'react'
import { Mail, Send, ChevronDown, Eye, MousePointerClick } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { Button, useToast } from '@/components/ui'

type EmailTemplate = {
  id:      string
  name:    string
  subject: string
  body:    string
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
  emails:       EmailEntry[]
  contactId:    string
  contactEmail: string | null
}

export function EmailComposer({ emails, contactId, contactEmail }: EmailComposerProps) {
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [subject, setSubject]     = useState('')
  const [body, setBody]           = useState('')
  const [templateId, setTemplateId] = useState('')
  const [expanded, setExpanded]   = useState<string | null>(null)
  const [sending, setSending]     = useState(false)
  const [sentEmails, setSentEmails] = useState<EmailEntry[]>(emails)
  const { toast }                 = useToast()

  // Load templates on mount
  useEffect(() => {
    fetch('/api/email-templates')
      .then(r => r.json())
      .then(json => setTemplates(json.data ?? []))
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

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!subject.trim() || !body.trim() || !contactEmail) return
    setSending(true)
    try {
      const res = await fetch('/api/emails', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          contactId,
          subject:    subject.trim(),
          body:       body.trim(),
          toEmail:    contactEmail,
          templateId: templateId || undefined,
        }),
      })
      if (!res.ok) throw new Error('Failed to send')
      const { data } = await res.json()
      setSentEmails(prev => [data, ...prev])
      setSubject('')
      setBody('')
      setTemplateId('')
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

        <div>
          <label className="text-xs text-charcoal-500 mb-1 block">Body</label>
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder="Email body (HTML allowed)…"
            rows={5}
            className="w-full rounded-lg border border-charcoal-200 bg-white px-3 py-2 text-sm text-charcoal-900 placeholder:text-charcoal-400 focus:outline-none focus:ring-2 focus:ring-charcoal-900 resize-none font-mono"
          />
        </div>

        {contactEmail ? (
          <Button type="submit" variant="primary" size="sm" loading={sending} leftIcon={<Send size={14} />}>
            Send to {contactEmail}
          </Button>
        ) : (
          <p className="text-xs text-charcoal-400">Add an email address to this contact to send emails.</p>
        )}
      </form>

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
                  dangerouslySetInnerHTML={{ __html: email.body }}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
