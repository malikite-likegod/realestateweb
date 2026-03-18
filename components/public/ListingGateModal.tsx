'use client'

import { useState } from 'react'

type State = 'gate' | 'pending' | 'error'

interface Props {
  initialState: State
  returnUrl:    string
}

export function ListingGateModal({ initialState, returnUrl }: Props) {
  const [state,     setState]     = useState<State>(initialState)
  const [firstName, setFirstName] = useState('')
  const [lastName,  setLastName]  = useState('')
  const [email,     setEmail]     = useState('')
  const [pendingEmail, setPendingEmail] = useState('')
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')
  const [resent,    setResent]    = useState(false)
  const [resending, setResending] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await fetch('/api/gate/submit', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ firstName, lastName, email, returnUrl }),
    })
    setLoading(false)
    if (res.ok) {
      setPendingEmail(email)
      setState('pending')
    } else {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'Something went wrong. Please try again.')
    }
  }

  async function handleResend() {
    setResending(true)
    await fetch('/api/gate/resend', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email: pendingEmail }),
    })
    setResending(false)
    setResent(true)
    setTimeout(() => setResent(false), 5000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md mx-4 bg-white rounded-2xl shadow-2xl p-8">
        {state === 'gate' && (
          <>
            <h2 className="font-serif text-2xl font-bold text-charcoal-900 mb-2">
              Unlock Full Access
            </h2>
            <p className="text-charcoal-500 text-sm mb-6">
              Enter your details to continue browsing listings without limits.
            </p>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-charcoal-700 mb-1">First Name</label>
                  <input
                    required
                    value={firstName}
                    onChange={e => setFirstName(e.target.value)}
                    className="w-full rounded-lg border border-charcoal-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-charcoal-700 mb-1">Last Name</label>
                  <input
                    required
                    value={lastName}
                    onChange={e => setLastName(e.target.value)}
                    className="w-full rounded-lg border border-charcoal-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-charcoal-700 mb-1">Email</label>
                <input
                  required
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-charcoal-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500"
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-gold-500 hover:bg-gold-600 text-white font-semibold py-2.5 transition-colors disabled:opacity-60"
              >
                {loading ? 'Sending…' : 'Get Full Access'}
              </button>
              <p className="text-center text-xs text-charcoal-400">
                We&apos;ll send you a quick verification link — then you can browse freely.
              </p>
            </form>
          </>
        )}

        {state === 'pending' && (
          <>
            <div className="text-center mb-6">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gold-50">
                <svg className="h-7 w-7 text-gold-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className="font-serif text-2xl font-bold text-charcoal-900 mb-2">Check Your Inbox</h2>
              <p className="text-charcoal-500 text-sm">
                We sent a verification link to <strong>{pendingEmail}</strong>.<br />
                Click it to start browsing freely.
              </p>
            </div>
            <button
              type="button"
              onClick={handleResend}
              disabled={resending}
              className="w-full text-sm text-charcoal-500 hover:text-gold-600 transition-colors disabled:opacity-60"
            >
              {resent ? 'Email resent!' : resending ? 'Resending…' : 'Resend verification email'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
