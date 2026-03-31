'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

type Step =
  | { name: 'email' }
  | { name: 'password';   firstName: string }
  | { name: 'send_code';  firstName: string; maskedPhone?: string; emailVal: string }
  | { name: 'enter_phone'; firstName: string; emailVal: string }
  | { name: 'verify';     emailVal: string }

function LoginFlow() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const redirectTo   = searchParams.get('redirect') ?? '/portal'

  const [step,     setStep]     = useState<Step>({ name: 'email' })
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [phone,    setPhone]    = useState('')
  const [code,     setCode]     = useState('')
  const [newPass,  setNewPass]  = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [error,    setError]    = useState<string | null>(null)
  const [loading,  setLoading]  = useState(false)
  const [resent,   setResent]   = useState(false)

  function err(msg: string) { setError(msg); setLoading(false) }

  // ── Step 1: email lookup ─────────────────────────────────────────────────
  async function handleEmailContinue(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError(null)
    try {
      const res  = await fetch('/api/portal/claim/lookup', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const json = await res.json()
      if (!res.ok) { err(json.error ?? 'Something went wrong'); return }

      if (json.status === 'has_account') {
        setStep({ name: 'password', firstName: json.firstName ?? '' })
      } else if (json.status === 'crm_has_phone') {
        setStep({ name: 'send_code', firstName: json.firstName ?? '', maskedPhone: json.maskedPhone, emailVal: email })
      } else if (json.status === 'crm_no_phone') {
        setStep({ name: 'enter_phone', firstName: json.firstName ?? '', emailVal: email })
      } else {
        err('No account found for that email address. Please contact your agent.')
      }
    } finally {
      setLoading(false)
    }
  }

  // ── Step 2a: existing password login ────────────────────────────────────
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError(null)
    try {
      const res  = await fetch('/api/portal/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const json = await res.json()
      if (!res.ok) { err(json.error ?? 'Login failed'); return }
      router.push(redirectTo)
    } finally {
      setLoading(false)
    }
  }

  // ── Step 2b: send OTP (has phone on file) ───────────────────────────────
  async function handleSendCode(emailVal: string, phoneVal?: string) {
    setLoading(true); setError(null); setResent(false)
    try {
      const res  = await fetch('/api/portal/claim/send-code', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailVal, phone: phoneVal }),
      })
      const json = await res.json()
      if (!res.ok) { err(json.error ?? 'Could not send code'); return }
      setStep({ name: 'verify', emailVal })
    } finally {
      setLoading(false)
    }
  }

  // ── Step 2c: phone entry (no phone on file) ──────────────────────────────
  async function handlePhoneSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (step.name !== 'enter_phone') return
    await handleSendCode(step.emailVal, phone)
  }

  // ── Step 3: verify code + set password ──────────────────────────────────
  async function handleActivate(e: React.FormEvent) {
    e.preventDefault()
    if (newPass !== confirm) { setError('Passwords do not match'); return }
    setLoading(true); setError(null)
    try {
      const res  = await fetch('/api/portal/claim/activate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, password: newPass }),
      })
      const json = await res.json()
      if (!res.ok) { err(json.error ?? 'Verification failed'); return }
      router.push(redirectTo)
    } finally {
      setLoading(false)
    }
  }

  async function handleResend() {
    if (step.name !== 'verify') return
    setResent(false); setError(null)
    const res = await fetch('/api/portal/verify-phone', { method: 'DELETE' })
    if (res.ok) setResent(true)
    else setError('Could not resend code')
  }

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-gray-200 p-8">

        {/* ── Email step ── */}
        {step.name === 'email' && (
          <>
            <h1 className="text-2xl font-semibold text-gray-900 mb-1">Client Portal</h1>
            <p className="text-sm text-gray-500 mb-6">Enter your email address to continue</p>
            <form onSubmit={handleEmailContinue} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoFocus
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button type="submit" disabled={loading}
                className="w-full bg-amber-600 hover:bg-amber-700 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors disabled:opacity-50">
                {loading ? 'Looking up…' : 'Continue'}
              </button>
            </form>
          </>
        )}

        {/* ── Password step (existing account) ── */}
        {step.name === 'password' && (
          <>
            <h1 className="text-2xl font-semibold text-gray-900 mb-1">
              Welcome back{step.firstName ? `, ${step.firstName}` : ''}
            </h1>
            <p className="text-sm text-gray-500 mb-6">{email}</p>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} required autoFocus
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button type="submit" disabled={loading}
                className="w-full bg-amber-600 hover:bg-amber-700 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors disabled:opacity-50">
                {loading ? 'Signing in…' : 'Sign In'}
              </button>
            </form>
            <button onClick={() => { setStep({ name: 'email' }); setError(null) }}
              className="mt-3 w-full text-sm text-gray-400 hover:text-gray-600">
              ← Use a different email
            </button>
          </>
        )}

        {/* ── Send code step (phone on file) ── */}
        {step.name === 'send_code' && (
          <>
            <h1 className="text-2xl font-semibold text-gray-900 mb-1">
              Hi{step.firstName ? ` ${step.firstName}` : ''}!
            </h1>
            <p className="text-sm text-gray-500 mb-2">We found your account.</p>
            <p className="text-sm text-gray-700 mb-6">
              We'll send a verification code to <span className="font-medium">{step.maskedPhone}</span> to confirm your identity and set up your password.
            </p>
            {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
            <button onClick={() => handleSendCode(step.emailVal)} disabled={loading}
              className="w-full bg-amber-600 hover:bg-amber-700 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors disabled:opacity-50">
              {loading ? 'Sending…' : 'Send Verification Code'}
            </button>
            <button onClick={() => { setStep({ name: 'email' }); setError(null) }}
              className="mt-3 w-full text-sm text-gray-400 hover:text-gray-600">
              ← Use a different email
            </button>
          </>
        )}

        {/* ── Enter phone step (no phone on file) ── */}
        {step.name === 'enter_phone' && (
          <>
            <h1 className="text-2xl font-semibold text-gray-900 mb-1">
              Hi{step.firstName ? ` ${step.firstName}` : ''}!
            </h1>
            <p className="text-sm text-gray-500 mb-6">
              Enter your mobile number to verify your identity and set up your password.
            </p>
            <form onSubmit={handlePhoneSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mobile Number</label>
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} required autoFocus
                  placeholder="+1 (416) 555-0100"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button type="submit" disabled={loading}
                className="w-full bg-amber-600 hover:bg-amber-700 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors disabled:opacity-50">
                {loading ? 'Sending…' : 'Send Verification Code'}
              </button>
            </form>
            <button onClick={() => { setStep({ name: 'email' }); setError(null) }}
              className="mt-3 w-full text-sm text-gray-400 hover:text-gray-600">
              ← Use a different email
            </button>
          </>
        )}

        {/* ── Verify code + set password step ── */}
        {step.name === 'verify' && (
          <>
            <h1 className="text-2xl font-semibold text-gray-900 mb-1">Verify & Set Password</h1>
            <p className="text-sm text-gray-500 mb-6">Enter the 6-digit code sent to your phone, then choose a password.</p>
            <form onSubmit={handleActivate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Verification Code</label>
                <input type="text" inputMode="numeric" maxLength={6} value={code}
                  onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000" required autoFocus
                  className="w-full rounded-lg border border-gray-300 px-3 py-3 text-center text-2xl tracking-widest focus:outline-none focus:ring-2 focus:ring-amber-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                <input type="password" value={newPass} onChange={e => setNewPass(e.target.value)} required minLength={8}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
                <p className="text-xs text-gray-400 mt-1">Minimum 8 characters</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
                <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
              </div>
              {error  && <p className="text-sm text-red-600">{error}</p>}
              {resent && <p className="text-sm text-emerald-600">Code resent!</p>}
              <button type="submit" disabled={loading}
                className="w-full bg-amber-600 hover:bg-amber-700 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors disabled:opacity-50">
                {loading ? 'Activating…' : 'Activate Account'}
              </button>
              <button type="button" onClick={handleResend}
                className="w-full text-sm text-gray-400 hover:text-gray-600">
                Resend code
              </button>
            </form>
          </>
        )}

      </div>
    </div>
  )
}

export default function PortalLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-sm text-gray-500">Loading…</div>}>
      <LoginFlow />
    </Suspense>
  )
}
