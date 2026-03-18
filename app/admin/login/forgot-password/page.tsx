'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Input, Button } from '@/components/ui'
import { Mail } from 'lucide-react'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
    } catch {
      // Silently swallow — we always show the same message
    } finally {
      setSubmitted(true)
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
            <Mail size={20} className="text-gold-400" />
          </div>
          <h1 className="font-serif text-2xl font-bold text-white">Reset Password</h1>
          <p className="text-charcoal-400 text-sm mt-1">
            {submitted ? '' : "Enter your email and we'll send you a reset link."}
          </p>
        </div>

        <div className="rounded-2xl bg-charcoal-900 border border-charcoal-700 p-6">
          {submitted ? (
            <div className="text-center">
              <p className="text-charcoal-300 text-sm leading-relaxed">
                If that email is registered, you&apos;ll receive a reset link shortly.
              </p>
              <p className="text-charcoal-500 text-xs mt-3">Check your spam folder if it doesn&apos;t arrive.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <Input
                label="Email"
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="bg-charcoal-800 border-charcoal-600 text-white placeholder:text-charcoal-500"
              />
              <Button type="submit" variant="gold" size="lg" loading={loading} fullWidth>
                Send Reset Link
              </Button>
            </form>
          )}
        </div>

        <p className="text-center mt-4 text-sm text-charcoal-500">
          <Link href="/admin/login" className="text-charcoal-400 hover:text-white transition-colors">
            ← Back to login
          </Link>
        </p>
      </motion.div>
    </div>
  )
}
