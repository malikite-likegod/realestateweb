'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle } from 'lucide-react'
import { Button, Input, Select, Textarea } from '@/components/ui'

interface LeadCaptureFormProps {
  title?: string
  subtitle?: string
  source?: string
  onSuccess?: () => void
  variant?: 'light' | 'dark'
}

export function LeadCaptureForm({ title = 'Get in Touch', subtitle, source = 'website', onSuccess, variant = 'light' }: LeadCaptureFormProps) {
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', interest: '', message: '' })
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, source }),
      })
      if (!res.ok) throw new Error('Failed to submit')
      setSuccess(true)
      onSuccess?.()
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center gap-4 py-8 text-center">
        <CheckCircle size={48} className="text-emerald-500" />
        <h3 className="font-serif text-2xl font-bold text-charcoal-900">Thank you!</h3>
        <p className="text-charcoal-500">We&apos;ll be in touch shortly.</p>
      </motion.div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {(title || subtitle) && (
        <div className="mb-2">
          {title && <h3 className="font-serif text-2xl font-bold text-charcoal-900">{title}</h3>}
          {subtitle && <p className="mt-1 text-charcoal-500">{subtitle}</p>}
        </div>
      )}
      <div className="grid grid-cols-2 gap-4">
        <Input label="First Name" required value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} />
        <Input label="Last Name" required value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} />
      </div>
      <Input label="Email" type="email" required value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
      <Input label="Phone" type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
      <Select
        label="I'm looking to…"
        value={form.interest}
        onChange={e => setForm(f => ({ ...f, interest: e.target.value }))}
        options={[
          { value: 'buy', label: 'Buy a Home' },
          { value: 'sell', label: 'Sell a Home' },
          { value: 'invest', label: 'Invest in Real Estate' },
          { value: 'rent', label: 'Rent' },
          { value: 'other', label: 'Other' },
        ]}
        placeholder="Select an option"
      />
      <Textarea label="Message (optional)" value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} rows={3} />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" variant="gold" size="lg" loading={loading} fullWidth>
        Send Message
      </Button>
    </form>
  )
}
