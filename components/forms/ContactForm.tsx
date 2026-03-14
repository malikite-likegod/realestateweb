'use client'

import { useState } from 'react'
import { Button, Input, Textarea } from '@/components/ui'

export function ContactForm() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', message: '' })
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    await fetch('/api/contacts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, source: 'contact_page' }) })
    setSent(true)
    setLoading(false)
  }

  if (sent) return <p className="text-emerald-600 font-medium">Message sent! We&apos;ll be in touch soon.</p>

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Input label="Your Name" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
      <Input label="Email" type="email" required value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
      <Input label="Phone" type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
      <Textarea label="Message" required value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} rows={5} />
      <Button type="submit" variant="gold" loading={loading} fullWidth>Send Message</Button>
    </form>
  )
}
