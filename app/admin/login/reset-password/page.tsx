'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Input, Button } from '@/components/ui'
import { KeyRound } from 'lucide-react'

function ResetPasswordForm() {
  const router = useRouter()
  const params = useSearchParams()
  const token = params.get('token') ?? ''
  const email = params.get('email') ?? ''

  const [status, setStatus] = useState<'checking' | 'invalid' | 'ready' | 'success'>('checking')
  const [form, setForm] = useState({ newPassword: '', confirmPassword: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token || !email) { setStatus('invalid'); return }

    fetch('/api/auth/reset-password/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, email }),
    })
      .then(r => r.json())
      .then(data => setStatus(data.valid ? 'ready' : 'invalid'))
      .catch(() => setStatus('invalid'))
  }, [token, email])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (form.newPassword.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    if (form.newPassword !== form.confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, email, ...form }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Something went wrong')
      } else {
        setStatus('success')
        setTimeout(() => router.push('/admin/login?reset=1'), 1000)
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-charcoal-950 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        <div className="text-center mb-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-charcoal-800 mx-auto mb-4">
            <KeyRound size={20} className="text-gold-400" />
          </div>
          <h1 className="font-serif text-2xl font-bold text-white">New Password</h1>
        </div>

        <div className="rounded-2xl bg-charcoal-900 border border-charcoal-700 p-6">
          {status === 'checking' && (
            <p className="text-charcoal-400 text-sm text-center">Verifying link…</p>
          )}
          {status === 'invalid' && (
            <div className="text-center">
              <p className="text-red-400 text-sm mb-4">This link is invalid or has expired.</p>
              <Link href="/admin/login/forgot-password" className="text-gold-400 hover:text-gold-300 text-sm">
                Request a new reset link
              </Link>
            </div>
          )}
          {(status === 'ready' || status === 'success') && (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <Input
                label="New password"
                type="password"
                required
                value={form.newPassword}
                onChange={e => setForm(f => ({ ...f, newPassword: e.target.value }))}
                className="bg-charcoal-800 border-charcoal-600 text-white"
              />
              <Input
                label="Confirm new password"
                type="password"
                required
                value={form.confirmPassword}
                onChange={e => setForm(f => ({ ...f, confirmPassword: e.target.value }))}
                className="bg-charcoal-800 border-charcoal-600 text-white"
              />
              {error && <p className="text-sm text-red-400">{error}</p>}
              {status === 'success' && <p className="text-sm text-green-400">Password reset! Redirecting…</p>}
              <Button type="submit" variant="gold" size="lg" loading={loading} fullWidth>
                Reset Password
              </Button>
            </form>
          )}
        </div>

        <p className="text-center mt-4 text-sm">
          <Link href="/admin/login" className="text-charcoal-400 hover:text-white transition-colors">
            ← Back to login
          </Link>
        </p>
      </motion.div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-charcoal-950" />}>
      <ResetPasswordForm />
    </Suspense>
  )
}
