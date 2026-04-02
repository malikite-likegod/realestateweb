'use client'

import { useState } from 'react'
import { Card } from '@/components/layout'
import { Button, useToast } from '@/components/ui'

interface Props {
  initialEmailSignature: string | null
  initialSmsSignature:   string | null
}

export function SignatureSettingsCard({ initialEmailSignature, initialSmsSignature }: Props) {
  const { toast } = useToast()
  const [emailSig, setEmailSig] = useState(initialEmailSignature ?? '')
  const [smsSig,   setSmsSig]   = useState(initialSmsSignature   ?? '')
  const [saving,   setSaving]   = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch('/api/settings/signature', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          emailSignature: emailSig.trim() || null,
          smsSignature:   smsSig.trim()   || null,
        }),
      })
      if (!res.ok) throw new Error('Failed to save')
      toast('success', 'Signatures saved')
    } catch {
      toast('error', 'Failed to save signatures', 'Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <h3 className="font-semibold text-charcoal-900 mb-1">Communication Signatures</h3>
      <p className="text-sm text-charcoal-400 mb-5">
        Automatically appended to outbound emails and SMS messages.
      </p>

      <div className="flex flex-col gap-5">
        {/* Email signature */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-charcoal-700">Email Signature</label>
          <p className="text-xs text-charcoal-400">HTML is supported. Will be appended after a separator (—) below your message.</p>
          <textarea
            rows={5}
            value={emailSig}
            onChange={e => setEmailSig(e.target.value)}
            placeholder={"Best regards,\nJane Smith\nRE/MAX — (555) 000-0000"}
            className="w-full rounded-lg border border-charcoal-200 bg-white px-3 py-2.5 text-sm text-charcoal-900 placeholder:text-charcoal-400 focus:outline-none focus:ring-2 focus:ring-charcoal-900 resize-none font-mono"
          />
        </div>

        {/* SMS signature */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-charcoal-700">SMS Signature</label>
          <p className="text-xs text-charcoal-400">
            Plain text only. Keep it short — SMS messages are limited to 160 characters.
            {smsSig.trim() && (
              <span className={`ml-1 font-medium ${smsSig.trim().length > 40 ? 'text-amber-600' : 'text-charcoal-500'}`}>
                ({smsSig.trim().length} chars)
              </span>
            )}
          </p>
          <input
            type="text"
            value={smsSig}
            onChange={e => setSmsSig(e.target.value)}
            maxLength={80}
            placeholder="- Jane Smith, RE/MAX"
            className="w-full rounded-lg border border-charcoal-200 bg-white px-3 py-2.5 text-sm text-charcoal-900 placeholder:text-charcoal-400 focus:outline-none focus:ring-2 focus:ring-charcoal-900"
          />
        </div>

        <Button variant="primary" className="self-start" onClick={handleSave} loading={saving}>
          Save Signatures
        </Button>
      </div>
    </Card>
  )
}
