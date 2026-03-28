'use client'

import { useState } from 'react'
import { X, Send, Loader2 } from 'lucide-react'

interface ComposeEmailModalProps {
  onClose:   () => void
  /** Pre-fill fields for reply / forward */
  defaults?: {
    to?:      string
    subject?: string
    body?:    string
  }
}

export function ComposeEmailModal({ onClose, defaults }: ComposeEmailModalProps) {
  const [to,       setTo]       = useState(defaults?.to      ?? '')
  const [subject,  setSubject]  = useState(defaults?.subject ?? '')
  const [body,     setBody]     = useState(defaults?.body    ?? '')
  const [sending,  setSending]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const [sent,     setSent]     = useState(false)

  async function handleSend() {
    if (!to.trim() || !subject.trim() || !body.trim()) {
      setError('To, subject, and body are all required.')
      return
    }
    setSending(true)
    setError(null)
    try {
      const res = await fetch('/api/emails', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toEmail: to.trim(), subject: subject.trim(), body }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Failed to send')
      }
      setSent(true)
      setTimeout(onClose, 1200)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        {/* Title bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-charcoal-100">
          <h2 className="text-base font-semibold text-charcoal-900">New Email</h2>
          <button onClick={onClose} className="text-charcoal-400 hover:text-charcoal-700 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Fields */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* To */}
          <div>
            <label className="block text-xs font-medium text-charcoal-500 mb-1">To</label>
            <input
              type="email"
              value={to}
              onChange={e => setTo(e.target.value)}
              placeholder="recipient@example.com"
              className="w-full rounded-lg border border-charcoal-200 px-3 py-2 text-sm text-charcoal-900 focus:outline-none focus:ring-2 focus:ring-gold-400"
            />
          </div>

          {/* Subject */}
          <div>
            <label className="block text-xs font-medium text-charcoal-500 mb-1">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="Subject"
              className="w-full rounded-lg border border-charcoal-200 px-3 py-2 text-sm text-charcoal-900 focus:outline-none focus:ring-2 focus:ring-gold-400"
            />
          </div>

          {/* Body */}
          <div>
            <label className="block text-xs font-medium text-charcoal-500 mb-1">Message</label>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              rows={12}
              placeholder="Write your message…"
              className="w-full rounded-lg border border-charcoal-200 px-3 py-2 text-sm text-charcoal-900 focus:outline-none focus:ring-2 focus:ring-gold-400 resize-none font-mono"
            />
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}
          {sent  && <p className="text-xs text-green-600 font-medium">Email sent!</p>}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-charcoal-100 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-charcoal-600 hover:text-charcoal-900 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={sending || sent}
            className="flex items-center gap-2 px-4 py-2 bg-charcoal-900 text-white text-sm rounded-lg hover:bg-charcoal-700 disabled:opacity-50 transition-colors"
          >
            {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            {sending ? 'Sending…' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  )
}
