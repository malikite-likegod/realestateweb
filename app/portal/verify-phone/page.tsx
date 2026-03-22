'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function VerifyPhonePage() {
  const router = useRouter()
  const [code,    setCode]    = useState('')
  const [error,   setError]   = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [resent,  setResent]  = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res  = await fetch('/api/portal/verify-phone', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ code }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Verification failed'); return }
      router.push('/portal')
    } finally {
      setLoading(false)
    }
  }

  async function handleResend() {
    setResent(false)
    setError(null)
    const res = await fetch('/api/portal/verify-phone', { method: 'DELETE' })
    if (res.ok) setResent(true)
    else setError('Could not resend code')
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
        <h1 className="text-2xl font-semibold text-gray-900 mb-1">Verify Your Phone</h1>
        <p className="text-sm text-gray-500 mb-6">Enter the 6-digit code sent to your phone number.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
            placeholder="000000"
            required
            className="w-full rounded-lg border border-gray-300 px-3 py-3 text-center text-2xl tracking-widest focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
          {error  && <p className="text-sm text-red-600">{error}</p>}
          {resent && <p className="text-sm text-emerald-600">Code resent!</p>}
          <button type="submit" disabled={loading}
            className="w-full bg-amber-600 hover:bg-amber-700 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors disabled:opacity-50">
            {loading ? 'Verifying…' : 'Verify'}
          </button>
          <button type="button" onClick={handleResend}
            className="w-full text-sm text-gray-500 hover:text-gray-700">
            Resend code
          </button>
        </form>
      </div>
    </div>
  )
}
