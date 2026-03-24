'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { DashboardLayout } from '@/components/dashboard'
import { PageHeader, Card } from '@/components/layout'
import { Input, Textarea, Button, useToast } from '@/components/ui'

interface CommunityData {
  id:           string
  name:         string
  slug:         string
  city:         string
  description:  string | null
  displayOrder: number
  imageUrl:     string | null
}

interface Props {
  initial?: CommunityData
}

function generateSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export function CommunityForm({ initial }: Props) {
  const router = useRouter()
  const { toast } = useToast()
  const isEdit = Boolean(initial)

  const [form, setForm] = useState({
    name:         initial?.name         ?? '',
    slug:         initial?.slug         ?? '',
    city:         initial?.city         ?? '',
    description:  initial?.description  ?? '',
    displayOrder: String(initial?.displayOrder ?? 0),
  })
  const [imageUrl, setImageUrl]               = useState(initial?.imageUrl ?? '')
  const [uploading, setUploading]             = useState(false)
  const [loading, setLoading]                 = useState(false)
  const [slugManuallyEdited, setSlugEdited]   = useState(isEdit)

  // Auto-populate slug from name on create only
  useEffect(() => {
    if (!slugManuallyEdited) {
      setForm(f => ({ ...f, slug: generateSlug(f.name) }))
    }
  }, [form.name, slugManuallyEdited])

  const set = (field: string) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [field]: e.target.value }))

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/uploads', { method: 'POST', body: fd })
      if (!res.ok) throw new Error()
      const json = await res.json() as { data: { url: string } }
      setImageUrl(json.data.url)
      toast('success', 'Image uploaded')
    } catch {
      toast('error', 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const url    = isEdit ? `/api/admin/communities/${initial!.id}` : '/api/admin/communities'
      const method = isEdit ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:         form.name,
          slug:         form.slug,
          city:         form.city,
          description:  form.description || null,
          displayOrder: Number(form.displayOrder) || 0,
          imageUrl:     imageUrl || null,
        }),
      })
      if (res.status === 409) {
        toast('error', 'Slug already taken — choose a different one')
        return
      }
      if (!res.ok) throw new Error()
      toast('success', isEdit ? 'Community updated!' : 'Community created!')
      router.push('/admin/communities')
    } catch {
      toast('error', 'Failed to save community')
    } finally {
      setLoading(false)
    }
  }

  // Client component has no session; match BlogPostForm pattern
  const user = { name: 'Admin', email: '', avatarUrl: null }

  return (
    <DashboardLayout user={user}>
      <PageHeader
        title={isEdit ? 'Edit Community' : 'New Community'}
        breadcrumbs={[
          { label: 'Dashboard',    href: '/admin/dashboard' },
          { label: 'Communities', href: '/admin/communities' },
          { label: isEdit ? initial!.name : 'New' },
        ]}
      />

      <form onSubmit={handleSubmit} className="flex flex-col gap-6 max-w-3xl">
        <Card>
          <h2 className="text-sm font-semibold text-charcoal-700 mb-4">Community Details</h2>
          <div className="flex flex-col gap-4">
            <Input label="Name *" required value={form.name} onChange={set('name')} />
            <Input
              label="Slug *"
              required
              value={form.slug}
              onChange={e => { setSlugEdited(true); set('slug')(e) }}
              placeholder="auto-generated from name"
            />
            <Input
              label="City *"
              required
              value={form.city}
              onChange={set('city')}
              placeholder="e.g. Toronto"
            />
            <Textarea
              label="Description"
              value={form.description}
              onChange={set('description')}
              rows={3}
            />
            <Input
              label="Display Order"
              type="number"
              value={form.displayOrder}
              onChange={set('displayOrder')}
            />
          </div>
        </Card>

        <Card>
          <h2 className="text-sm font-semibold text-charcoal-700 mb-4">Community Image</h2>
          {imageUrl && (
            <div className="relative h-40 w-full rounded-lg overflow-hidden bg-charcoal-100 mb-4">
              <Image src={imageUrl} alt="Community image" fill className="object-cover" />
            </div>
          )}
          <input
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            disabled={uploading}
            className="text-sm text-charcoal-600"
          />
          {uploading && <p className="text-sm text-charcoal-400 mt-2">Uploading…</p>}
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={() => router.back()}>Cancel</Button>
          <Button type="submit" variant="primary" loading={loading}>
            {isEdit ? 'Save Changes' : 'Create Community'}
          </Button>
        </div>
      </form>
    </DashboardLayout>
  )
}
