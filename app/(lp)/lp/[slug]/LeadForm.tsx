'use client'

import { useState } from 'react'

interface Props {
  slug:        string
  ctaTitle:    string
  ctaSubtitle: string
}

export function LeadForm({ slug, ctaTitle, ctaSubtitle }: Props) {
  const [form, setForm]   = useState({ firstName: '', lastName: '', email: '', phone: '', message: '' })
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [error, setError] = useState<string>('')

  const set = (f: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [f]: e.target.value }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('loading')
    try {
      const res = await fetch(`/api/landing-pages/${slug}/lead`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(form),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        if (body?.error?.includes('valid email')) {
          setError(body.error)
        } else {
          setError('Something went wrong — please try again.')
        }
        setStatus('error')
        return
      }
      setStatus('success')
    } catch {
      setError('Something went wrong — please try again.')
      setStatus('error')
    }
  }

  if (status === 'success') {
    return (
      <div className="text-center py-10">
        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-xl font-semibold text-charcoal-900 mb-2">Thank you!</h3>
        <p className="text-charcoal-500">We&apos;ve received your details and will be in touch shortly.</p>
      </div>
    )
  }

  const inputCls = 'w-full rounded-xl border border-charcoal-200 px-4 py-3 text-sm text-charcoal-900 placeholder-charcoal-400 focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-transparent transition-shadow'

  return (
    <div>
      {ctaTitle    && <h2 className="font-serif text-3xl font-bold text-charcoal-900 mb-2">{ctaTitle}</h2>}
      {ctaSubtitle && <p className="text-charcoal-500 mb-8">{ctaSubtitle}</p>}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-charcoal-700">First Name <span className="text-red-500">*</span></label>
            <input required type="text" value={form.firstName} onChange={set('firstName')} placeholder="Jane" className={inputCls} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-charcoal-700">Last Name</label>
            <input type="text" value={form.lastName} onChange={set('lastName')} placeholder="Smith" className={inputCls} />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-charcoal-700">Email Address <span className="text-red-500">*</span></label>
          <input required type="email" value={form.email} onChange={set('email')} placeholder="jane@example.com" className={inputCls} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-charcoal-700">Phone Number</label>
          <input type="tel" value={form.phone} onChange={set('phone')} placeholder="+1 (416) 555-0100" className={inputCls} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-charcoal-700">Message <span className="text-charcoal-400">(optional)</span></label>
          <textarea rows={3} value={form.message} onChange={set('message')} placeholder="Tell me a bit about what you're looking for…" className={`${inputCls} resize-none`} />
        </div>

        {status === 'error' && error && (
          <p className="text-sm text-red-600">{error}</p>
        )}

        <button
          type="submit"
          disabled={status === 'loading'}
          className="w-full rounded-xl bg-gold-600 hover:bg-gold-700 disabled:opacity-60 text-white font-semibold py-4 px-6 text-base transition-colors mt-1"
        >
          {status === 'loading' ? 'Sending…' : 'Get in Touch'}
        </button>

        <p className="text-xs text-charcoal-400 text-center">
          Your information is kept private and never shared.
        </p>
      </form>
    </div>
  )
}
