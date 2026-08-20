'use client'

/**
 * EmailPreviewModal
 *
 * Shared "how will this actually look" preview for every place email content
 * is composed (campaign steps, templates, contact compose, inbox compose).
 * Fetches the fully-resolved subject/body from /api/emails/preview — merge
 * tags, listing tags, and the sender's signature are all resolved server-side
 * exactly as they would be for a real send.
 */

import { useEffect, useState } from 'react'
import { Eye, User } from 'lucide-react'
import { Modal } from '@/components/ui'

interface EmailPreviewModalProps {
  open:                boolean
  onClose:             () => void
  subject:             string
  body:                string
  /** Preview against this contact's real data; omitted → sample contact data. */
  contactId?:          string
  /** undefined = auto-resolve the sender's stored signature; '' = force no signature; string = show verbatim (e.g. an edited/removed draft). */
  signatureOverride?:  string
}

type PreviewResult = {
  subject:          string
  body:             string
  isSample:         boolean
  toName:           string | null
  toEmail:          string | null
  signatureApplied: boolean
}

export function EmailPreviewModal({ open, onClose, subject, body, contactId, signatureOverride }: EmailPreviewModalProps) {
  const [result,  setResult]  = useState<PreviewResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    setError(null)

    fetch('/api/emails/preview', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ subject, body, contactId, signatureOverride }),
    })
      .then(async r => {
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? 'Preview failed')
        return r.json()
      })
      .then(json => { if (!cancelled) setResult(json.data) })
      .catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : 'Preview failed') })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [open, subject, body, contactId, signatureOverride])

  return (
    <Modal open={open} onClose={onClose} title="Email Preview" size="lg">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-1.5 text-xs text-charcoal-500">
          <Eye size={12} />
          This is how the email will look when delivered{result?.signatureApplied ? ', signature included' : ''}.
        </div>

        {result?.toName || result?.toEmail || result?.isSample ? (
          <div className="flex items-center gap-2 rounded-lg bg-charcoal-50 px-3 py-2 text-xs text-charcoal-600">
            <User size={12} className="shrink-0 text-charcoal-400" />
            {result.isSample
              ? <span>Showing with <strong>sample contact data</strong> — the actual send resolves each recipient&apos;s real info.</span>
              : <span>To: <strong>{result.toName}</strong>{result.toEmail ? ` <${result.toEmail}>` : ''}</span>}
          </div>
        ) : null}

        {error && <p className="text-xs text-red-600">{error}</p>}

        {loading && !result ? (
          <div className="flex h-[420px] items-center justify-center rounded-xl border border-charcoal-200 text-sm text-charcoal-400">
            Rendering preview…
          </div>
        ) : result ? (
          <>
            <div className="rounded-lg bg-charcoal-50 px-4 py-2.5 text-sm text-charcoal-700">
              <span className="font-semibold text-charcoal-500">Subject: </span>
              {result.subject || <em className="text-charcoal-400">No subject set</em>}
            </div>
            <div className="overflow-hidden rounded-xl border border-charcoal-200" style={{ height: 480 }}>
              <iframe
                srcDoc={result.body}
                title="Email preview"
                className="h-full w-full"
                sandbox="allow-same-origin"
              />
            </div>
            {!result.signatureApplied && (
              <p className="text-xs text-charcoal-400">No signature is configured for the sending account, so none is shown here.</p>
            )}
          </>
        ) : null}
      </div>
    </Modal>
  )
}
