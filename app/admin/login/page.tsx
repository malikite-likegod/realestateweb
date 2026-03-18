'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { Input, Button } from '@/components/ui'
import { APP_NAME } from '@/lib/constants'
import { Lock } from 'lucide-react'
import Link from 'next/link'

function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const [form, setForm] = useState({ email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [resetSuccess, setResetSuccess] = useState(false)

  useEffect(() => {
    if (params.get('reset') === '1') {
      setResetSuccess(true)
      router.replace('/admin/login')
    }
  }, [params, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })

    if (res.ok) {
      const data = await res.json()
      if (data.requires2fa) {
        router.push('/admin/login/verify')
      } else {
        router.push('/admin/dashboard')
      }
    } else {
      const data = await res.json()
      setError(data.error ?? 'Login failed')
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
            <Lock size={20} className="text-gold-400" />
          </div>
          <h1 className="font-serif text-2xl font-bold text-white">{APP_NAME} CRM</h1>
          <p className="text-charcoal-400 text-sm mt-1">Sign in to your account</p>
        </div>

        {resetSuccess && (
          <div className="mb-4 rounded-xl bg-green-900/40 border border-green-700 px-4 py-3 text-sm text-green-300">
            Your password has been reset. Please sign in.
          </div>
        )}

        <div className="rounded-2xl bg-charcoal-900 border border-charcoal-700 p-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              label="Email"
              type="email"
              required
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              className="bg-charcoal-800 border-charcoal-600 text-white placeholder:text-charcoal-500"
            />
            <Input
              label="Password"
              type="password"
              required
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              className="bg-charcoal-800 border-charcoal-600 text-white"
            />
            {error && <p className="text-sm text-red-400">{error}</p>}
            <Button type="submit" variant="gold" size="lg" loading={loading} fullWidth>
              Sign In
            </Button>
          </form>
        </div>

        <p className="text-center mt-4 text-sm">
          <Link href="/admin/login/forgot-password" className="text-charcoal-500 hover:text-charcoal-300 transition-colors">
            Forgot your password?
          </Link>
        </p>
      </motion.div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-charcoal-950" />}>
      <LoginForm />
    </Suspense>
  )
}
