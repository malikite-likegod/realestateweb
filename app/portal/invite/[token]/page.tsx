'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams, useParams } from 'next/navigation'

export default function InviteSetupPage() {
  const router      = useRouter()
  const params      = useParams()
  const searchParams= useSearchParams()
  const token       = params.token as string
  const contactId   = searchParams.get('contactId') ?? ''

  const [valid,      setValid]      = useState<boolean | null>(null)
  const [firstName,  setFirstName]  = useState('')

  const [password,   setPassword]   = useState('')
  const [confirm,    setConfirm]    = useState('')
  const [phone,      setPhone]      = useState('')
  const [street,     setStreet]     = useState('')
  const [city,       setCity]       = useState('')
  const [province,   setProvince]   = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [error,      setError]      = useState<string | null>(null)
  const [loading,    setLoading]    = useState(false)

  useEffect(() => {
    if (!contactId || !token) { setValid(false); return }
    fetch(`/api/portal/invite/validate?contactId=${contactId}&token=${token}`)
      .then(r => r.json())
      .then(j => {
        setValid(j.valid)
        if (j.valid) {
          setFirstName(j.firstName ?? '')
          setPhone(j.prefill?.phone ?? '')
          setStreet(j.prefill?.address?.street ?? '')
          setCity(j.prefill?.address?.city ?? '')
          setProvince(j.prefill?.address?.province ?? '')
          setPostalCode(j.prefill?.address?.postalCode ?? '')
        }
      })
      .catch(() => setValid(false))
  }, [contactId, token])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) { setError('Passwords do not match'); return }
    setLoading(true)
    setError(null)
    try {
      const res  = await fetch('/api/portal/setup', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ contactId, token, password, phone, street, city, province, postalCode }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Setup failed'); return }
      router.push('/portal/verify-phone')
    } finally {
      setLoading(false)
    }
  }

  if (valid === null) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-gray-500">Validating invitation…</div>
  }

  if (!valid) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Invalid or Expired Invitation</h1>
          <p className="text-sm text-gray-500">Please contact your agent for a new invitation link.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
        <h1 className="text-2xl font-semibold text-gray-900 mb-1">Set Up Your Account</h1>
        <p className="text-sm text-gray-500 mb-6">Welcome{firstName ? `, ${firstName}` : ''}! Create your password and confirm your details.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
            <p className="text-xs text-gray-400 mt-1">Minimum 8 characters</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
            <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Street Address</label>
            <input type="text" value={street} onChange={e => setStreet(e.target.value)} required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
              <input type="text" value={city} onChange={e => setCity(e.target.value)} required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Province</label>
              <input type="text" value={province} onChange={e => setProvince(e.target.value)} required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Postal Code</label>
            <input type="text" value={postalCode} onChange={e => setPostalCode(e.target.value)} required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={loading}
            className="w-full bg-amber-600 hover:bg-amber-700 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors disabled:opacity-50">
            {loading ? 'Setting up…' : 'Continue'}
          </button>
        </form>
      </div>
    </div>
  )
}
