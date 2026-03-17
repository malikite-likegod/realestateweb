'use client'

import { useState } from 'react'

interface Props {
  reportTitle: string
  reportSlug: string
  ctaTitle: string
  ctaSubtitle: string
}

export function MarketReportLeadForm({ reportTitle, reportSlug, ctaTitle, ctaSubtitle }: Props) {
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', areaOfInterest: '' })
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('loading')
    try {
      const res = await fetch(`/api/market-reports/${reportSlug}/lead`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          phone: form.phone,
          areaOfInterest: form.areaOfInterest,
        }),
      })
      if (!res.ok) throw new Error()
      setStatus('success')
    } catch {
      setStatus('error')
    }
  }

  if (status === 'success') {
    return (
      <div className="text-center py-8">
        <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-xl font-semibold text-charcoal-900 mb-2">You&apos;re all set!</h3>
        <p className="text-charcoal-500">We&apos;ll send you the full in-depth market report shortly. Keep an eye on your inbox.</p>
      </div>
    )
  }

  return (
    <div>
      <h2 className="font-serif text-2xl font-bold text-charcoal-900 mb-2">{ctaTitle}</h2>
      {ctaSubtitle && <p className="text-charcoal-500 mb-6">{ctaSubtitle}</p>}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-charcoal-700">First Name *</label>
            <input
              required
              type="text"
              value={form.firstName}
              onChange={set('firstName')}
              placeholder="Jane"
              className="rounded-lg border border-charcoal-200 px-3 py-2.5 text-sm text-charcoal-900 placeholder-charcoal-400 focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-transparent"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-charcoal-700">Last Name *</label>
            <input
              required
              type="text"
              value={form.lastName}
              onChange={set('lastName')}
              placeholder="Smith"
              className="rounded-lg border border-charcoal-200 px-3 py-2.5 text-sm text-charcoal-900 placeholder-charcoal-400 focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-charcoal-700">Email Address *</label>
          <input
            required
            type="email"
            value={form.email}
            onChange={set('email')}
            placeholder="jane@example.com"
            className="rounded-lg border border-charcoal-200 px-3 py-2.5 text-sm text-charcoal-900 placeholder-charcoal-400 focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-transparent"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-charcoal-700">Phone Number</label>
          <input
            type="tel"
            value={form.phone}
            onChange={set('phone')}
            placeholder="+1 (416) 555-0100"
            className="rounded-lg border border-charcoal-200 px-3 py-2.5 text-sm text-charcoal-900 placeholder-charcoal-400 focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-transparent"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-charcoal-700">Area of Interest</label>
          <input
            type="text"
            value={form.areaOfInterest}
            onChange={set('areaOfInterest')}
            placeholder="e.g. Downtown Toronto, Scarborough…"
            className="rounded-lg border border-charcoal-200 px-3 py-2.5 text-sm text-charcoal-900 placeholder-charcoal-400 focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-transparent"
          />
        </div>

        {status === 'error' && (
          <p className="text-sm text-red-600">Something went wrong. Please try again.</p>
        )}

        <button
          type="submit"
          disabled={status === 'loading'}
          className="mt-1 w-full rounded-lg bg-gold-600 hover:bg-gold-700 disabled:opacity-60 text-white font-semibold py-3 px-6 transition-colors"
        >
          {status === 'loading' ? 'Sending…' : 'Send Me the Full Report'}
        </button>

        <p className="text-xs text-charcoal-400 text-center">We respect your privacy. Your details will never be shared.</p>
      </form>
    </div>
  )
}
