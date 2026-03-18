'use client'

import { useState } from 'react'
import { Card } from '@/components/layout'
import { Button, Input } from '@/components/ui'
import { ShieldCheck } from 'lucide-react'

interface TwoFactorCardProps {
  initialEnabled: boolean
  userEmail: string
}

export function TwoFactorCard({ initialEnabled, userEmail }: TwoFactorCardProps) {
  const [enabled, setEnabled] = useState(initialEnabled)
  const [stage, setStage] = useState<'idle' | 'verifying'>('idle')
  const [pendingAction, setPendingAction] = useState<'enable' | 'disable' | null>(null)
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const startFlow = async (action: 'enable' | 'disable') => {
    setError('')
    setSuccess('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/2fa/enable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed to send verification code')
        return
      }
      setPendingAction(action)
      setStage('verifying')
      setCode('')
    } finally {
      setLoading(false)
    }
  }

  const confirmCode = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pendingAction) return
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/2fa/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, action: pendingAction }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Verification failed')
        return
      }
      setEnabled(data.totpEnabled)
      setStage('idle')
      setPendingAction(null)
      setCode('')
      setSuccess(
        data.totpEnabled
          ? 'Two-factor authentication enabled.'
          : 'Two-factor authentication disabled.'
      )
    } finally {
      setLoading(false)
    }
  }

  const cancel = () => {
    setStage('idle')
    setPendingAction(null)
    setCode('')
    setError('')
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-charcoal-900">Two-Factor Authentication</h3>
        {enabled && (
          <span className="flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-2 py-1 rounded-full">
            <ShieldCheck size={12} /> Active
          </span>
        )}
      </div>

      {stage === 'idle' && (
        <>
          {enabled ? (
            <p className="text-sm text-charcoal-500 mb-4">
              Verification codes are sent to <strong>{userEmail}</strong>.
            </p>
          ) : (
            <p className="text-sm text-charcoal-500 mb-4">
              Require an email verification code on each login for extra security. Codes are sent to{' '}
              <strong>{userEmail}</strong>.
            </p>
          )}
          {success && <p className="text-sm text-green-600 mb-3">{success}</p>}
          {error && <p className="text-sm text-red-500 mb-3">{error}</p>}
          {enabled ? (
            <Button variant="outline" onClick={() => startFlow('disable')} loading={loading}>
              Disable Two-Factor Authentication
            </Button>
          ) : (
            <Button variant="primary" onClick={() => startFlow('enable')} loading={loading}>
              Enable Two-Factor Authentication
            </Button>
          )}
        </>
      )}

      {stage === 'verifying' && (
        <form onSubmit={confirmCode} className="flex flex-col gap-4">
          <p className="text-sm text-charcoal-500">
            Enter the 6-digit code sent to <strong>{userEmail}</strong>.
          </p>
          <Input
            label="Verification code"
            type="text"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            required
            value={code}
            onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          />
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex gap-3">
            <Button type="submit" variant="primary" loading={loading}>
              Verify
            </Button>
            <Button type="button" variant="ghost" onClick={cancel} disabled={loading}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </Card>
  )
}
