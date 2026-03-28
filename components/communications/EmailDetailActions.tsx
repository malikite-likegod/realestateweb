'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Reply, Forward, Trash2, Loader2 } from 'lucide-react'
import { ComposeEmailModal } from './ComposeEmailModal'

interface Props {
  emailId:   string
  fromEmail: string | null
  subject:   string
  body:      string
}

export function EmailDetailActions({ emailId, fromEmail, subject, body }: Props) {
  const router = useRouter()
  const [modal,    setModal]    = useState<'reply' | 'forward' | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    if (!confirm('Delete this email? This cannot be undone.')) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/emails/${emailId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      router.push('/admin/communications')
      router.refresh()
    } catch {
      alert('Failed to delete email. Please try again.')
      setDeleting(false)
    }
  }

  const quotedBody = `
    <br/><br/>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0"/>
    <p style="color:#6b7280;font-size:12px">-------- Original message --------</p>
    ${body}
  `

  const replyDefaults = {
    to:      fromEmail ?? '',
    subject: subject.startsWith('Re:') ? subject : `Re: ${subject}`,
    body:    quotedBody,
  }

  const forwardDefaults = {
    to:      '',
    subject: subject.startsWith('Fwd:') ? subject : `Fwd: ${subject}`,
    body:    quotedBody,
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setModal('reply')}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-charcoal-200 text-charcoal-700 hover:bg-charcoal-50 transition-colors"
        >
          <Reply size={14} /> Reply
        </button>

        <button
          onClick={() => setModal('forward')}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-charcoal-200 text-charcoal-700 hover:bg-charcoal-50 transition-colors"
        >
          <Forward size={14} /> Forward
        </button>

        <button
          onClick={handleDelete}
          disabled={deleting}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors ml-auto"
        >
          {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
          {deleting ? 'Deleting…' : 'Delete'}
        </button>
      </div>

      {modal && (
        <ComposeEmailModal
          onClose={() => setModal(null)}
          defaults={modal === 'reply' ? replyDefaults : forwardDefaults}
        />
      )}
    </>
  )
}
