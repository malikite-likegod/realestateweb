'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Input, Button } from '@/components/ui'
import { ShieldCheck } from 'lucide-react'

export default function VerifyPage() {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/2fa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      const data = await res.json()
      if (res.ok) {
        router.push('/admin/dashboard')
      } else {
        const msg = data.error ?? 'Verification failed'
        setError(msg)
        // Auto-redirect for fatal errors (expired session or locked out)
        if (msg.includes('expired') || msg.includes('Too many')) {
          setTimeout(() => router.push('/admin/login'), 3000)
        }
      }
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
            <ShieldCheck size={20} className="text-gold-400" />
          </div>
          <h1 className="font-serif text-2xl font-bold text-white">Verify your identity</h1>
          <p className="text-charcoal-400 text-sm mt-1">Enter the 6-digit code sent to your email</p>
        </div>

        <div className="rounded-2xl bg-charcoal-900 border border-charcoal-700 p-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              label="Verification code"
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="bg-charcoal-800 border-charcoal-600 text-white text-center text-xl tracking-widest"
            />
            {error && <p className="text-sm text-red-400">{error}</p>}
            <Button type="submit" variant="gold" size="lg" loading={loading} fullWidth>
              Verify
            </Button>
          </form>
        </div>

        <p className="text-center mt-4 text-sm">
          <a
            href="/api/auth/2fa/clear"
            className="text-charcoal-500 hover:text-charcoal-300 transition-colors"
          >
            ← Back to login
          </a>
        </p>
      </motion.div>
    </div>
  )
}
