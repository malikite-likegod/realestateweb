'use client'

import { useState } from 'react'
import { Button, Input, Select } from '@/components/ui'

export function HomeValuationForm() {
  const [form, setForm] = useState({ address: '', city: '', propertyType: '', bedrooms: '', email: '', name: '', phone: '' })
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    await fetch('/api/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, source: 'home_valuation', interest: 'sell' }),
    })
    setSent(true)
    setLoading(false)
  }

  if (sent) return (
    <div className="py-8 text-center">
      <p className="text-xl font-serif font-bold text-charcoal-900 mb-2">Request Received!</p>
      <p className="text-charcoal-500">We&apos;ll prepare your free valuation report and be in touch within 24 hours.</p>
    </div>
  )

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Input label="Property Address" required value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
      <Input label="City" required value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} />
      <div className="grid grid-cols-2 gap-4">
        <Select label="Property Type" value={form.propertyType} onChange={e => setForm(f => ({ ...f, propertyType: e.target.value }))}
          options={[{ value: 'detached', label: 'Detached' }, { value: 'semi', label: 'Semi-Detached' }, { value: 'condo', label: 'Condo' }, { value: 'townhouse', label: 'Townhouse' }]}
          placeholder="Select type"
        />
        <Select label="Bedrooms" value={form.bedrooms} onChange={e => setForm(f => ({ ...f, bedrooms: e.target.value }))}
          options={[1,2,3,4,5].map(n => ({ value: String(n), label: `${n}+` }))}
          placeholder="Select"
        />
      </div>
      <Input label="Your Name" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
      <Input label="Email" type="email" required value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
      <Input label="Phone" type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
      <Button type="submit" variant="gold" size="lg" loading={loading} fullWidth>Get Free Valuation</Button>
    </form>
  )
}
