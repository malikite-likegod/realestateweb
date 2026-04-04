'use client'

import { useState, useRef } from 'react'
import { Upload, Image }    from 'lucide-react'
import { Card }             from '@/components/layout'
import { Button, Input, useToast } from '@/components/ui'

interface Props {
  initialLogoUrl: string
}

export function BrandLogoCard({ initialLogoUrl }: Props) {
  const { toast } = useToast()

  const [logoUrl,   setLogoUrl]   = useState(initialLogoUrl)
  const [saving,    setSaving]    = useState(false)
  const [uploading, setUploading] = useState(false)

  const fileRef = useRef<HTMLInputElement>(null)

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res  = await fetch('/api/uploads', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Upload failed')
      setLogoUrl(data.url)
      toast('success', 'Logo uploaded')
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
        body:    JSON.stringify({ brand_logo: logoUrl }),
      })
      if (!res.ok) throw new Error('Failed to save')
      toast('success', 'Brand logo saved')
    } catch {
      toast('error', 'Failed to save', 'Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <h3 className="font-semibold text-charcoal-900 mb-1">Brand Logo</h3>
      <p className="text-sm text-charcoal-400 mb-5">
        Used in email templates via the{' '}
        <code className="rounded bg-charcoal-100 px-1 py-0.5 text-xs">{'{{brandLogo}}'}</code>{' '}
        merge tag. Use a hosted image URL (PNG or SVG recommended, max 300px wide).
      </p>

      <div className="flex items-center gap-4">
        {/* Preview */}
        <div className="shrink-0 h-16 w-40 rounded-xl border border-charcoal-200 overflow-hidden bg-charcoal-50 flex items-center justify-center">
          {logoUrl
            ? <img src={logoUrl} alt="Brand logo" className="max-h-full max-w-full object-contain p-2" />
            : <Image size={24} className="text-charcoal-300" />
          }
        </div>

        {/* URL input + upload */}
        <div className="flex flex-col gap-1.5 min-w-0 flex-1">
          <label className="text-xs font-semibold uppercase tracking-wide text-charcoal-600">
            Logo URL
          </label>
          <div className="flex gap-2">
            <Input
              value={logoUrl}
              onChange={e => setLogoUrl(e.target.value)}
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
              onChange={handleUpload}
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-4">
        <Button variant="primary" onClick={handleSave} loading={saving}>
          Save Logo
        </Button>
      </div>
    </Card>
  )
}
