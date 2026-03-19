'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { CheckCircle, Loader2 } from 'lucide-react'

function EmailVerifiedContent() {
  const params     = useSearchParams()
  const phoneParam = params.get('phone')
  // showOtp is true when the server sent an OTP — the phone_session HttpOnly cookie
  // is set automatically by the browser and sent with the POST; no token in the URL.
  const showOtp    = phoneParam === 'true'

  const [code, setCode]      = useState('')
  const [status, setStatus]  = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [errorMsg, setError] = useState('')

  async function handleVerifyPhone(e: React.FormEvent) {
    e.preventDefault()
    setStatus('loading')
    setError('')
    try {
      const res = await fetch('/api/verify/phone', {
        method:      'POST',
        headers:     { 'Content-Type': 'application/json' },
        credentials: 'same-origin', // ensures cookies are sent
        body:        JSON.stringify({ code }),
      })
      const data = await res.json()
      if (res.ok) {
        setStatus('done')
      } else {
        setError(data.message ?? 'Something went wrong.')
        setStatus('error')
      }
    } catch {
      setError('Something went wrong. Please try again.')
      setStatus('error')
    }
  }

  return (
    <div className="min-h-screen bg-charcoal-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-sm border border-charcoal-100 max-w-md w-full p-8 text-center">

        {/* Email confirmed icon */}
        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-8 h-8 text-emerald-600" />
        </div>

        <h1 className="text-2xl font-bold text-charcoal-900 mb-2">Email address confirmed!</h1>
        <p className="text-charcoal-500 mb-6">Thank you for confirming your email address.</p>

        {showOtp && status !== 'done' && (
          <div className="border-t border-charcoal-100 pt-6">
            <p className="text-sm text-charcoal-600 mb-4">
              We also sent a 6-digit code to your phone number. Enter it below to verify it.
            </p>
            <form onSubmit={handleVerifyPhone} className="flex flex-col gap-3">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                className="w-full rounded-xl border border-charcoal-200 px-4 py-3 text-center text-2xl tracking-widest font-mono text-charcoal-900 placeholder-charcoal-300 focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-transparent"
                required
              />
              {(status === 'error') && (
                <p className="text-sm text-red-600">{errorMsg}</p>
              )}
              <button
                type="submit"
                disabled={status === 'loading' || code.length < 6}
                className="w-full rounded-xl bg-gold-600 hover:bg-gold-700 disabled:opacity-60 text-white font-semibold py-3 px-6 text-base transition-colors flex items-center justify-center gap-2"
              >
                {status === 'loading' && <Loader2 className="w-4 h-4 animate-spin" />}
                Verify Phone Number
              </button>
            </form>
          </div>
        )}

        {showOtp && status === 'done' && (
          <div className="border-t border-charcoal-100 pt-6">
            <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <CheckCircle className="w-6 h-6 text-emerald-600" />
            </div>
            <p className="text-sm font-medium text-emerald-700">Phone number verified!</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default function EmailVerifiedPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-charcoal-50 flex items-center justify-center"><div className="text-charcoal-500">Loading...</div></div>}>
      <EmailVerifiedContent />
    </Suspense>
  )
}
