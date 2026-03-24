'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle, Settings } from 'lucide-react'

export default function SetupPage() {
  const router = useRouter()
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' })
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    fetch('/api/setup')
      .then(r => r.json())
      .then(data => {
        if (data.configured) router.replace('/')
        else setChecking(false)
      })
      .catch(() => setChecking(false))
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (form.password !== form.confirm) { setError('Passwords do not match.'); return }
    if (form.password.length < 8) { setError('Password must be at least 8 characters.'); return }

    setLoading(true)
    try {
      const res = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminName: form.name, adminEmail: form.email, adminPassword: form.password }),
      })
      const data = await res.json()
      if (!res.ok) setError(data.error ?? 'Setup failed.')
      else setDone(true)
    } finally {
      setLoading(false)
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen bg-charcoal-950 flex items-center justify-center">
        <div className="text-charcoal-500 text-sm">Checking configuration…</div>
      </div>
    )
  }

  if (done) {
    return (
      <div className="min-h-screen bg-charcoal-950 flex items-center justify-center p-4">
        <div className="w-full max-w-sm text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-green-900/40 border border-green-700 mx-auto mb-6">
            <CheckCircle size={28} className="text-green-400" />
          </div>
          <h1 className="font-serif text-2xl font-bold text-white mb-2">Setup Complete</h1>
          <p className="text-charcoal-400 text-sm mb-6">Your admin account has been created.</p>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-xl bg-gold-500 hover:bg-gold-400 text-charcoal-950 font-semibold text-sm px-6 py-2.5 transition-colors"
          >
            Go to Homepage
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-charcoal-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-charcoal-800 mx-auto mb-4">
            <Settings size={20} className="text-gold-400" />
          </div>
          <h1 className="font-serif text-3xl font-bold text-white">Create Admin Account</h1>
          <p className="text-charcoal-400 text-sm mt-2">Set up your administrator login to get started.</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {[
            { label: 'Full Name', key: 'name', type: 'text', placeholder: 'Jane Smith' },
            { label: 'Email', key: 'email', type: 'email', placeholder: 'admin@yoursite.com' },
            { label: 'Password', key: 'password', type: 'password', placeholder: 'Min 8 characters' },
            { label: 'Confirm Password', key: 'confirm', type: 'password', placeholder: 'Repeat password' },
          ].map(({ label, key, type, placeholder }) => (
            <div key={key} className="flex flex-col gap-1">
              <label className="text-sm font-medium text-charcoal-200">{label}</label>
              <input
                type={type}
                value={form[key as keyof typeof form]}
                onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                placeholder={placeholder}
                required
                className="rounded-lg border border-charcoal-600 bg-charcoal-800 px-3 py-2 text-sm text-white placeholder:text-charcoal-500 focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-gold-500"
              />
            </div>
          ))}

          {error && (
            <div className="rounded-xl border border-red-700 bg-red-900/20 px-4 py-3">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-gold-500 hover:bg-gold-400 disabled:opacity-50 disabled:cursor-not-allowed text-charcoal-950 font-semibold text-sm px-6 py-3 transition-colors mt-2"
          >
            {loading ? 'Creating account…' : 'Create Admin Account'}
          </button>
        </form>
      </div>
    </div>
  )
}
