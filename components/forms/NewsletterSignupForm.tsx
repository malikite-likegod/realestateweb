'use client'

import { useState } from 'react'
import { Button, Input } from '@/components/ui'

export function NewsletterSignupForm() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    await fetch('/api/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, source: 'newsletter' }),
    })
    setDone(true)
    setLoading(false)
  }

  if (done) return <p className="text-white/80 text-sm">You&apos;re subscribed!</p>

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 max-w-sm">
      <Input type="email" required placeholder="Enter your email" value={email} onChange={e => setEmail(e.target.value)} className="bg-white/10 border-white/20 text-white placeholder:text-white/40" />
      <Button type="submit" variant="gold" loading={loading}>Subscribe</Button>
    </form>
  )
}
