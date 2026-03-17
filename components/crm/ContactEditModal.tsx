'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { Modal, Button, useToast } from '@/components/ui'

// Internal form state — all strings, no nulls, no DB metadata
type PhoneEntry   = { label: string; number: string; isPrimary: boolean }
type AddressEntry = { label: string; street: string; city: string; province: string; postalCode: string; country: string; isPrimary: boolean }

// What the parent passes — matches Prisma output shapes directly
interface IncomingPhone {
  label:     string
  number:    string
  isPrimary: boolean
  // Prisma adds id, contactId, createdAt — accepted via structural typing
}

interface IncomingAddress {
  label:      string
  street:     string | null
  city:       string | null
  province:   string | null
  postalCode: string | null
  country:    string
  isPrimary:  boolean
}

interface ContactData {
  id:         string
  firstName:  string
  lastName:   string
  email:      string | null
  company:    string | null
  jobTitle:   string | null
  source:     string | null
  status:     string
  birthday:   Date | null
  notes:      string | null
  // legacy single-value fields (used to seed state if new arrays are empty)
  phone:      string | null
  address:    string | null
  city:       string | null
  province:   string | null
  postalCode: string | null
  country:    string
  phones:     IncomingPhone[]
  addresses:  IncomingAddress[]
  emailOptOut: boolean
  smsOptOut:   boolean
}

interface Props {
  contact: ContactData
}

const SELECT_CLASS = 'rounded-lg border border-charcoal-200 bg-white px-3 py-2.5 text-sm text-charcoal-900 focus:outline-none focus:ring-2 focus:ring-charcoal-900'
const INPUT_CLASS  = 'w-full rounded-lg border border-charcoal-200 bg-white px-3 py-2.5 text-sm text-charcoal-900 focus:outline-none focus:ring-2 focus:ring-charcoal-900'

export function ContactEditModal({ contact }: Props) {
  const router      = useRouter()
  const { toast }   = useToast()
  const [open, setOpen]     = useState(false)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    firstName: contact.firstName,
    lastName:  contact.lastName,
    email:     contact.email     ?? '',
    company:   contact.company   ?? '',
    jobTitle:  contact.jobTitle  ?? '',
    source:    contact.source    ?? '',
    status:    contact.status,
    birthday:  contact.birthday
      ? new Date(contact.birthday).toISOString().split('T')[0]
      : '',
    notes: contact.notes ?? '',
  })

  const [emailOptOut, setEmailOptOut] = useState(contact.emailOptOut)
  const [smsOptOut,   setSmsOptOut]   = useState(contact.smsOptOut)
  const [emailReason, setEmailReason] = useState('')
  const [smsReason,   setSmsReason]   = useState('')

  // Seed phones — strip extra Prisma fields (id, contactId, createdAt) to clean form state
  const [phones, setPhones] = useState<PhoneEntry[]>(() =>
    contact.phones.length > 0
      ? contact.phones.map(p => ({ label: p.label, number: p.number, isPrimary: p.isPrimary }))
      : contact.phone
        ? [{ label: 'mobile', number: contact.phone, isPrimary: true }]
        : [],
  )

  // Seed addresses — null-coalesce nullable DB fields to empty strings for form state
  const [addresses, setAddresses] = useState<AddressEntry[]>(() =>
    contact.addresses.length > 0
      ? contact.addresses.map(a => ({
          label:      a.label,
          street:     a.street     ?? '',
          city:       a.city       ?? '',
          province:   a.province   ?? '',
          postalCode: a.postalCode ?? '',
          country:    a.country,
          isPrimary:  a.isPrimary,
        }))
      : contact.address || contact.city
        ? [{
            label:      'home',
            street:     contact.address   ?? '',
            city:       contact.city      ?? '',
            province:   contact.province  ?? '',
            postalCode: contact.postalCode ?? '',
            country:    contact.country   ?? 'CA',
            isPrimary:  true,
          }]
        : [],
  )

  // ── Phone helpers ──────────────────────────────────────────────────────────
  function addPhone() {
    setPhones(prev => [...prev, { label: 'mobile', number: '', isPrimary: prev.length === 0 }])
  }

  function removePhone(i: number) {
    setPhones(prev => {
      const next = prev.filter((_, idx) => idx !== i)
      // If no primary remains, promote the first entry — create new object, don't mutate
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

  // ── Address helpers ────────────────────────────────────────────────────────
  function addAddress() {
    setAddresses(prev => [
      ...prev,
      { label: 'home', street: '', city: '', province: '', postalCode: '', country: 'CA', isPrimary: prev.length === 0 },
    ])
  }

  function removeAddress(i: number) {
    setAddresses(prev => {
      const next = prev.filter((_, idx) => idx !== i)
      // If no primary remains, promote the first entry — create new object, don't mutate
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

  // ── Save ───────────────────────────────────────────────────────────────────
  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch(`/api/contacts/${contact.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          email:    form.email    || null,
          company:  form.company  || null,
          jobTitle: form.jobTitle || null,
          source:   form.source   || null,
          birthday: form.birthday || null,
          notes:    form.notes    || null,
          phones,
          addresses,
          emailOptOut,
          smsOptOut,
          emailOptOutReason: emailReason || undefined,
          smsOptOutReason:   smsReason   || undefined,
        }),
      })
      if (!res.ok) throw new Error('Save failed')
      toast('success', 'Contact updated')
      setOpen(false)
      router.refresh()
    } catch {
      toast('error', 'Failed to save', 'Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        leftIcon={<Pencil size={13} />}
        onClick={() => setOpen(true)}
      >
        Edit
      </Button>

      <Modal open={open} onClose={() => setOpen(false)} title="Edit Contact" size="lg">
        <div className="max-h-[68vh] overflow-y-auto pr-1 flex flex-col gap-6">

          {/* Basic info ────────────────────────────────────────────────────── */}
          <section>
            <p className="text-xs font-semibold text-charcoal-500 uppercase tracking-wide mb-3">Basic Information</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-charcoal-700">First name</label>
                <input className={INPUT_CLASS} value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-charcoal-700">Last name</label>
                <input className={INPUT_CLASS} value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-charcoal-700">Email</label>
                <input className={INPUT_CLASS} type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-charcoal-700">Company</label>
                <input className={INPUT_CLASS} value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-charcoal-700">Job title</label>
                <input className={INPUT_CLASS} value={form.jobTitle} onChange={e => setForm(f => ({ ...f, jobTitle: e.target.value }))} />
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
            <div className="mt-3 flex flex-col gap-1.5">
              <label className="text-sm font-medium text-charcoal-700">Notes</label>
              <textarea
                rows={3}
                className="w-full rounded-lg border border-charcoal-200 bg-white px-3 py-2.5 text-sm text-charcoal-900 focus:outline-none focus:ring-2 focus:ring-charcoal-900 resize-none"
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </section>

          {/* Phone numbers ──────────────────────────────────────────────────── */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-charcoal-500 uppercase tracking-wide">Phone Numbers</p>
              <button
                onClick={addPhone}
                className="flex items-center gap-1 text-xs font-medium text-gold-600 hover:text-gold-700"
              >
                <Plus size={12} /> Add phone
              </button>
            </div>
            {phones.length === 0 && (
              <p className="text-xs text-charcoal-400 italic">No phone numbers yet.</p>
            )}
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
                    <input
                      type="radio"
                      name="primaryPhone"
                      checked={phone.isPrimary}
                      onChange={() => setPhonePrimary(i)}
                      className="accent-gold-500"
                    />
                    Primary
                  </label>
                  <button
                    onClick={() => removePhone(i)}
                    className="text-charcoal-300 hover:text-red-500 transition-colors shrink-0"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* Addresses ──────────────────────────────────────────────────────── */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-charcoal-500 uppercase tracking-wide">Addresses</p>
              <button
                onClick={addAddress}
                className="flex items-center gap-1 text-xs font-medium text-gold-600 hover:text-gold-700"
              >
                <Plus size={12} /> Add address
              </button>
            </div>
            {addresses.length === 0 && (
              <p className="text-xs text-charcoal-400 italic">No addresses yet.</p>
            )}
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
                        <input
                          type="radio"
                          name="primaryAddress"
                          checked={addr.isPrimary}
                          onChange={() => setAddressPrimary(i)}
                          className="accent-gold-500"
                        />
                        Primary
                      </label>
                    </div>
                    <button
                      onClick={() => removeAddress(i)}
                      className="text-charcoal-300 hover:text-red-500 transition-colors"
                    >
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
                    <input placeholder="City"            value={addr.city}       onChange={e => updateAddress(i, 'city',       e.target.value)} className="rounded-lg border border-charcoal-200 bg-white px-3 py-2 text-sm text-charcoal-900 focus:outline-none focus:ring-2 focus:ring-charcoal-900" />
                    <input placeholder="Province / State" value={addr.province}   onChange={e => updateAddress(i, 'province',   e.target.value)} className="rounded-lg border border-charcoal-200 bg-white px-3 py-2 text-sm text-charcoal-900 focus:outline-none focus:ring-2 focus:ring-charcoal-900" />
                    <input placeholder="Postal / ZIP"    value={addr.postalCode} onChange={e => updateAddress(i, 'postalCode', e.target.value)} className="rounded-lg border border-charcoal-200 bg-white px-3 py-2 text-sm text-charcoal-900 focus:outline-none focus:ring-2 focus:ring-charcoal-900" />
                    <input placeholder="Country"         value={addr.country}    onChange={e => updateAddress(i, 'country',    e.target.value)} className="rounded-lg border border-charcoal-200 bg-white px-3 py-2 text-sm text-charcoal-900 focus:outline-none focus:ring-2 focus:ring-charcoal-900" />
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Communication preferences */}
          <div className="pt-2 border-t border-charcoal-100">
            <p className="text-xs font-semibold text-charcoal-500 uppercase tracking-wide mb-3">
              Communication Preferences
            </p>
            <div className="flex flex-col gap-3">

              {/* Email toggle */}
              <div>
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-sm text-charcoal-700">Receive email communications</span>
                  <button
                    type="button"
                    onClick={() => { setEmailOptOut(v => !v); setEmailReason('') }}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
                      emailOptOut ? 'bg-red-500' : 'bg-green-500'
                    }`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                      emailOptOut ? 'translate-x-1' : 'translate-x-4'
                    }`} />
                  </button>
                </label>
                {emailOptOut && !contact.emailOptOut && (
                  <input
                    type="text"
                    value={emailReason}
                    onChange={e => setEmailReason(e.target.value)}
                    placeholder="Reason (optional)…"
                    className={INPUT_CLASS}
                  />
                )}
              </div>

              {/* SMS toggle */}
              <div>
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-sm text-charcoal-700">Receive SMS communications</span>
                  <button
                    type="button"
                    onClick={() => { setSmsOptOut(v => !v); setSmsReason('') }}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
                      smsOptOut ? 'bg-red-500' : 'bg-green-500'
                    }`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                      smsOptOut ? 'translate-x-1' : 'translate-x-4'
                    }`} />
                  </button>
                </label>
                {smsOptOut && !contact.smsOptOut && (
                  <input
                    type="text"
                    value={smsReason}
                    onChange={e => setSmsReason(e.target.value)}
                    placeholder="Reason (optional)…"
                    className={INPUT_CLASS}
                  />
                )}
              </div>

            </div>
          </div>

        </div>

        <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-charcoal-100">
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleSave} loading={saving}>Save changes</Button>
        </div>
      </Modal>
    </>
  )
}
