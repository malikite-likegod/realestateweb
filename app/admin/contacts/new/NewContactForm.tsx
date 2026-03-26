'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Plus, Trash2 } from 'lucide-react'
import { Button, useToast } from '@/components/ui'

type PhoneEntry   = { label: string; number: string; isPrimary: boolean }
type AddressEntry = { label: string; street: string; city: string; province: string; postalCode: string; country: string; isPrimary: boolean }

const INPUT_CLASS  = 'w-full rounded-lg border border-charcoal-200 bg-white px-3 py-2.5 text-sm text-charcoal-900 focus:outline-none focus:ring-2 focus:ring-charcoal-900'
const SELECT_CLASS = 'w-full rounded-lg border border-charcoal-200 bg-white px-3 py-2.5 text-sm text-charcoal-900 focus:outline-none focus:ring-2 focus:ring-charcoal-900'

export function NewContactForm() {
  const router    = useRouter()
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    firstName: '',
    lastName:  '',
    email:     '',
    company:   '',
    jobTitle:  '',
    source:    '',
    status:    'lead',
    birthday:  '',
    notes:     '',
  })

  const [phones,    setPhones]    = useState<PhoneEntry[]>([])
  const [addresses, setAddresses] = useState<AddressEntry[]>([])

  // ── Phone helpers ───────────────────────────────────────────────────────────
  function addPhone() {
    setPhones(prev => [...prev, { label: 'mobile', number: '', isPrimary: prev.length === 0 }])
  }
  function removePhone(i: number) {
    setPhones(prev => {
      const next = prev.filter((_, idx) => idx !== i)
      if (next.length > 0 && !next.some(p => p.isPrimary)) {
        return next.map((p, idx) => idx === 0 ? { ...p, isPrimary: true } : p)
      }
      return next
    })
  }
  function setPhonePrimary(i: number) {
    setPhones(prev => prev.map((p, idx) => ({ ...p, isPrimary: idx === i })))
  }
  function updatePhone(i: number, field: 'label' | 'number', value: string) {
    setPhones(prev => prev.map((p, idx) => idx === i ? { ...p, [field]: value } : p))
  }

  // ── Address helpers ─────────────────────────────────────────────────────────
  function addAddress() {
    setAddresses(prev => [
      ...prev,
      { label: 'home', street: '', city: '', province: '', postalCode: '', country: 'CA', isPrimary: prev.length === 0 },
    ])
  }
  function removeAddress(i: number) {
    setAddresses(prev => {
      const next = prev.filter((_, idx) => idx !== i)
      if (next.length > 0 && !next.some(a => a.isPrimary)) {
        return next.map((a, idx) => idx === 0 ? { ...a, isPrimary: true } : a)
      }
      return next
    })
  }
  function setAddressPrimary(i: number) {
    setAddresses(prev => prev.map((a, idx) => ({ ...a, isPrimary: idx === i })))
  }
  function updateAddress(i: number, field: keyof Omit<AddressEntry, 'isPrimary'>, value: string) {
    setAddresses(prev => prev.map((a, idx) => idx === i ? { ...a, [field]: value } : a))
  }

  // ── Submit ──────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!form.firstName.trim() || !form.lastName.trim()) {
      toast('error', 'First and last name are required')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/contacts', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: form.firstName.trim(),
          lastName:  form.lastName.trim(),
          email:     form.email    || null,
          company:   form.company  || null,
          jobTitle:  form.jobTitle || null,
          source:    form.source   || null,
          status:    form.status,
          birthday:  form.birthday || null,
          notes:     form.notes    || null,
          phones,
          addresses,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Failed to create contact')
      }
      const { data } = await res.json()
      toast('success', 'Contact created')
      router.push(`/admin/contacts/${data.id}`)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Please try again.'
      toast('error', 'Failed to create contact', message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto pb-16 flex flex-col gap-6">

      {/* Basic info ──────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-charcoal-100 bg-white p-6 flex flex-col gap-4">
        <p className="text-xs font-semibold text-charcoal-500 uppercase tracking-wide">Basic Information</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-charcoal-700">First name <span className="text-red-500">*</span></label>
            <input className={INPUT_CLASS} value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} placeholder="Jane" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-charcoal-700">Last name <span className="text-red-500">*</span></label>
            <input className={INPUT_CLASS} value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} placeholder="Smith" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-charcoal-700">Email</label>
            <input className={INPUT_CLASS} type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="jane@example.com" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-charcoal-700">Company</label>
            <input className={INPUT_CLASS} value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} placeholder="Acme Inc." />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-charcoal-700">Job title</label>
            <input className={INPUT_CLASS} value={form.jobTitle} onChange={e => setForm(f => ({ ...f, jobTitle: e.target.value }))} placeholder="Sales Manager" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-charcoal-700">Birthday</label>
            <input className={INPUT_CLASS} type="date" value={form.birthday} onChange={e => setForm(f => ({ ...f, birthday: e.target.value }))} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-charcoal-700">Status</label>
            <select className={SELECT_CLASS} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
              <option value="lead">Lead</option>
              <option value="prospect">Prospect</option>
              <option value="client">Client</option>
              <option value="past_client">Past Client</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-charcoal-700">Source</label>
            <select className={SELECT_CLASS} value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))}>
              <option value="">— None —</option>
              <option value="website">Website</option>
              <option value="referral">Referral</option>
              <option value="idx">IDX</option>
              <option value="manual">Manual</option>
              <option value="social">Social</option>
            </select>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-charcoal-700">Notes</label>
          <textarea
            rows={3}
            className="w-full rounded-lg border border-charcoal-200 bg-white px-3 py-2.5 text-sm text-charcoal-900 focus:outline-none focus:ring-2 focus:ring-charcoal-900 resize-none"
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            placeholder="Any additional notes…"
          />
        </div>
      </div>

      {/* Phone numbers ───────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-charcoal-100 bg-white p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-charcoal-500 uppercase tracking-wide">Phone Numbers</p>
          <button onClick={addPhone} className="flex items-center gap-1 text-xs font-medium text-gold-600 hover:text-gold-700">
            <Plus size={12} /> Add phone
          </button>
        </div>
        {phones.length === 0 && <p className="text-xs text-charcoal-400 italic">No phone numbers yet.</p>}
        <div className="flex flex-col gap-2">
          {phones.map((phone, i) => (
            <div key={i} className="flex items-center gap-2">
              <select
                value={phone.label}
                onChange={e => updatePhone(i, 'label', e.target.value)}
                className="w-24 shrink-0 rounded-lg border border-charcoal-200 bg-white px-2 py-2.5 text-sm text-charcoal-900 focus:outline-none focus:ring-2 focus:ring-charcoal-900"
              >
                <option value="mobile">Mobile</option>
                <option value="home">Home</option>
                <option value="work">Work</option>
                <option value="other">Other</option>
              </select>
              <input
                type="tel"
                placeholder="+1 (555) 000-0000"
                value={phone.number}
                onChange={e => updatePhone(i, 'number', e.target.value)}
                className="flex-1 rounded-lg border border-charcoal-200 bg-white px-3 py-2.5 text-sm text-charcoal-900 focus:outline-none focus:ring-2 focus:ring-charcoal-900"
              />
              <label className="flex items-center gap-1 text-xs text-charcoal-500 cursor-pointer shrink-0">
                <input type="radio" name="primaryPhone" checked={phone.isPrimary} onChange={() => setPhonePrimary(i)} className="accent-gold-500" />
                Primary
              </label>
              <button onClick={() => removePhone(i)} className="text-charcoal-300 hover:text-red-500 transition-colors shrink-0">
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Addresses ───────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-charcoal-100 bg-white p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-charcoal-500 uppercase tracking-wide">Addresses</p>
          <button onClick={addAddress} className="flex items-center gap-1 text-xs font-medium text-gold-600 hover:text-gold-700">
            <Plus size={12} /> Add address
          </button>
        </div>
        {addresses.length === 0 && <p className="text-xs text-charcoal-400 italic">No addresses yet.</p>}
        <div className="flex flex-col gap-3">
          {addresses.map((addr, i) => (
            <div key={i} className="rounded-xl border border-charcoal-100 bg-charcoal-50/40 p-3 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <select
                    value={addr.label}
                    onChange={e => updateAddress(i, 'label', e.target.value)}
                    className="rounded-lg border border-charcoal-200 bg-white px-2 py-1.5 text-xs text-charcoal-900 focus:outline-none focus:ring-2 focus:ring-charcoal-900"
                  >
                    <option value="home">Home</option>
                    <option value="work">Work</option>
                    <option value="other">Other</option>
                  </select>
                  <label className="flex items-center gap-1.5 text-xs text-charcoal-500 cursor-pointer">
                    <input type="radio" name="primaryAddress" checked={addr.isPrimary} onChange={() => setAddressPrimary(i)} className="accent-gold-500" />
                    Primary
                  </label>
                </div>
                <button onClick={() => removeAddress(i)} className="text-charcoal-300 hover:text-red-500 transition-colors">
                  <Trash2 size={14} />
                </button>
              </div>
              <input
                placeholder="Street address"
                value={addr.street}
                onChange={e => updateAddress(i, 'street', e.target.value)}
                className="w-full rounded-lg border border-charcoal-200 bg-white px-3 py-2 text-sm text-charcoal-900 focus:outline-none focus:ring-2 focus:ring-charcoal-900"
              />
              <div className="grid grid-cols-2 gap-2">
                <input placeholder="City"             value={addr.city}       onChange={e => updateAddress(i, 'city',       e.target.value)} className="rounded-lg border border-charcoal-200 bg-white px-3 py-2 text-sm text-charcoal-900 focus:outline-none focus:ring-2 focus:ring-charcoal-900" />
                <input placeholder="Province / State" value={addr.province}   onChange={e => updateAddress(i, 'province',   e.target.value)} className="rounded-lg border border-charcoal-200 bg-white px-3 py-2 text-sm text-charcoal-900 focus:outline-none focus:ring-2 focus:ring-charcoal-900" />
                <input placeholder="Postal / ZIP"     value={addr.postalCode} onChange={e => updateAddress(i, 'postalCode', e.target.value)} className="rounded-lg border border-charcoal-200 bg-white px-3 py-2 text-sm text-charcoal-900 focus:outline-none focus:ring-2 focus:ring-charcoal-900" />
                <input placeholder="Country"          value={addr.country}    onChange={e => updateAddress(i, 'country',    e.target.value)} className="rounded-lg border border-charcoal-200 bg-white px-3 py-2 text-sm text-charcoal-900 focus:outline-none focus:ring-2 focus:ring-charcoal-900" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Actions ─────────────────────────────────────────────────────────── */}
      <div className="flex justify-end gap-3">
        <Button variant="ghost" asChild>
          <Link href="/admin/contacts">Cancel</Link>
        </Button>
        <Button onClick={handleSave} loading={saving}>
          Create Contact
        </Button>
      </div>

    </div>
  )
}
