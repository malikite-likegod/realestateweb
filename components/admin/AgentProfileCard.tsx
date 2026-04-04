'use client'

import { useState, useRef } from 'react'
import { Upload, User }     from 'lucide-react'
import { Card }             from '@/components/layout'
import { Button, Input, Textarea, useToast } from '@/components/ui'

export interface AgentProfileSettings {
  agent_name:        string
  agent_designation: string
  agent_bio:         string
  agent_phone:       string
  agent_brokerage:   string
  office_address:    string
  agent_email:       string
  agent_image:       string
}

interface Props {
  initial: AgentProfileSettings
}

export function AgentProfileCard({ initial }: Props) {
  const { toast } = useToast()

  const [form,      setForm]      = useState<AgentProfileSettings>(initial)
  const [saving,    setSaving]    = useState(false)
  const [uploading, setUploading] = useState(false)

  const fileRef = useRef<HTMLInputElement>(null)

  function set(key: keyof AgentProfileSettings, value: string) {
    setForm(f => ({ ...f, [key]: value }))
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res  = await fetch('/api/uploads', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Upload failed')
      set('agent_image', data.url)
      toast('success', 'Image uploaded')
    } catch (err) {
      toast('error', err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/settings', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(form),
      })
      if (!res.ok) throw new Error('Failed to save')
      toast('success', 'Agent profile saved')
    } catch {
      toast('error', 'Failed to save', 'Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <h3 className="font-semibold text-charcoal-900 mb-1">Agent Profile</h3>
      <p className="text-sm text-charcoal-400 mb-5">
        These values are available as merge tags in all email templates
        (e.g.&nbsp;<code className="rounded bg-charcoal-100 px-1 py-0.5 text-xs">{'{{agentName}}'}</code>).
      </p>

      <div className="flex flex-col gap-4">

        {/* Image preview + upload */}
        <div className="flex items-center gap-4">
          <div className="shrink-0 h-20 w-20 rounded-xl border border-charcoal-200 overflow-hidden bg-charcoal-50 flex items-center justify-center">
            {form.agent_image
              ? <img src={form.agent_image} alt="Agent" className="h-full w-full object-cover" />
              : <User size={28} className="text-charcoal-300" />
            }
          </div>
          <div className="flex flex-col gap-1.5 min-w-0 flex-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-charcoal-600">
              Agent Photo
            </label>
            <div className="flex gap-2">
              <Input
                value={form.agent_image}
                onChange={e => set('agent_image', e.target.value)}
                placeholder="https://… or upload below"
                className="text-xs"
              />
              <Button
                variant="outline"
                size="sm"
                className="shrink-0"
                loading={uploading}
                onClick={() => fileRef.current?.click()}
              >
                <Upload size={13} className="mr-1" />
                Upload
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageUpload}
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-charcoal-600">
              Full Name
            </label>
            <Input
              value={form.agent_name}
              onChange={e => set('agent_name', e.target.value)}
              placeholder="e.g. Michael Taylor"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-charcoal-600">
              Designation / Title
            </label>
            <Input
              value={form.agent_designation}
              onChange={e => set('agent_designation', e.target.value)}
              placeholder="e.g. REALTOR®, Broker of Record"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-charcoal-600">
              Email
            </label>
            <Input
              type="email"
              value={form.agent_email}
              onChange={e => set('agent_email', e.target.value)}
              placeholder="agent@example.com"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-charcoal-600">
              Phone
            </label>
            <Input
              value={form.agent_phone}
              onChange={e => set('agent_phone', e.target.value)}
              placeholder="(416) 555-0100"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-charcoal-600">
              Brokerage
            </label>
            <Input
              value={form.agent_brokerage}
              onChange={e => set('agent_brokerage', e.target.value)}
              placeholder="e.g. LuxeRealty Inc., Brokerage"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-charcoal-600">
              Office Address
            </label>
            <Input
              value={form.office_address}
              onChange={e => set('office_address', e.target.value)}
              placeholder="e.g. 123 King St W, Toronto, ON"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold uppercase tracking-wide text-charcoal-600">
            Bio
          </label>
          <Textarea
            value={form.agent_bio}
            onChange={e => set('agent_bio', e.target.value)}
            placeholder="A short bio used in email footers and templates…"
            rows={4}
          />
        </div>

        <div className="flex justify-end pt-1">
          <Button variant="primary" onClick={handleSave} loading={saving}>
            Save Profile
          </Button>
        </div>
      </div>
    </Card>
  )
}
