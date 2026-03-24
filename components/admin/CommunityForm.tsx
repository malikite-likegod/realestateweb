'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { DashboardLayout } from '@/components/dashboard'
import { PageHeader, Card } from '@/components/layout'
import { Input, Textarea, Button, Select, useToast } from '@/components/ui'

interface CommunityData {
  id:           string
  name:         string
  slug:         string
  city:         string
  description:  string | null
  imageUrl:     string | null
  displayOrder: number
  municipality:  string | null
  neighbourhood: string | null
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
    municipality:  initial?.municipality  ?? null,
    neighbourhood: initial?.neighbourhood ?? null,
  })
  const [imageUrl, setImageUrl]               = useState(initial?.imageUrl ?? '')
  const [uploading, setUploading]             = useState(false)
  const [loading, setLoading]                 = useState(false)
  const [slugManuallyEdited, setSlugEdited]   = useState(isEdit)

  const [areas, setAreas]                               = useState<string[]>([])
  const [municipalityOptions, setMunicipalityOptions]   = useState<string[]>([])
  const [neighbourhoodOptions, setNeighbourhoodOptions] = useState<string[]>([])
  const [fetchingMunicipality, setFetchingMunicipality] = useState(false)
  const [fetchingNeighbourhood, setFetchingNeighbourhood] = useState(false)
  const [showSuggestions, setShowSuggestions]           = useState(false)

  const cityMountRef         = useRef(true)
  const municipalityMountRef = useRef(true)

  // Auto-populate slug from name on create only
  useEffect(() => {
    if (!slugManuallyEdited) {
      setForm(f => ({ ...f, slug: generateSlug(f.name) }))
    }
  }, [form.name, slugManuallyEdited])

  // Fetch all areas on mount for the city combobox
  useEffect(() => {
    fetch('/api/admin/communities/locations')
      .then(r => r.json())
      .then(d => setAreas(d.areas ?? []))
      .catch(() => {})
  }, [])

  // Fetch municipalities when city changes
  useEffect(() => {
    // Consume ref before early exit — ensures first non-empty value triggers reset
    const isMount = cityMountRef.current
    cityMountRef.current = false

    if (!form.city) { setMunicipalityOptions([]); return }

    if (!isMount) {
      setForm(f => ({ ...f, municipality: null, neighbourhood: null }))
      setNeighbourhoodOptions([])
    }

    setFetchingMunicipality(true)
    fetch(`/api/admin/communities/locations?area=${encodeURIComponent(form.city)}`)
      .then(r => r.json())
      .then(d => setMunicipalityOptions(d.municipalities ?? []))
      .catch(() => {})
      .finally(() => setFetchingMunicipality(false))
  }, [form.city])

  // Fetch neighbourhoods when municipality changes
  // form.city is in deps because it is used in the fetch URL — omitting it
  // would capture a stale city value if the user changed city and municipality together.
  useEffect(() => {
    // Consume ref before early exit — same reason as cityMountRef above
    const isMount = municipalityMountRef.current
    municipalityMountRef.current = false

    if (!form.municipality) { setNeighbourhoodOptions([]); return }

    if (!isMount) {
      setForm(f => ({ ...f, neighbourhood: null }))
    }

    setFetchingNeighbourhood(true)
    fetch(
      `/api/admin/communities/locations?area=${encodeURIComponent(form.city)}&municipality=${encodeURIComponent(form.municipality)}`
    )
      .then(r => r.json())
      .then(d => setNeighbourhoodOptions(d.neighbourhoods ?? []))
      .catch(() => {})
      .finally(() => setFetchingNeighbourhood(false))
  }, [form.municipality, form.city])

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
          municipality:  form.municipality  || null,
          neighbourhood: form.neighbourhood || null,
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

  const filteredAreas = areas.filter(a =>
    a.toLowerCase().includes(form.city.toLowerCase())
  )

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
            <div className="relative">
              <Input
                label="City (Area) *"
                required
                value={form.city}
                placeholder="e.g. Toronto"
                onChange={(e) => {
                  const value = e.target.value
                  setForm(f => ({ ...f, city: value, municipality: null, neighbourhood: null }))
                  setMunicipalityOptions([])
                  setNeighbourhoodOptions([])
                  setShowSuggestions(true)
                }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              />
              {showSuggestions && filteredAreas.length > 0 && (
                <ul className="absolute z-10 mt-1 w-full bg-white border border-charcoal-200 rounded-lg shadow-sm max-h-48 overflow-y-auto">
                  {filteredAreas.map(suggestion => (
                    <li
                      key={suggestion}
                      className="px-3 py-2 text-sm cursor-pointer hover:bg-charcoal-50"
                      onMouseDown={(e) => {
                        e.preventDefault()
                        setForm(f => ({ ...f, city: suggestion, municipality: null, neighbourhood: null }))
                        setMunicipalityOptions([])
                        setNeighbourhoodOptions([])
                        setShowSuggestions(false)
                      }}
                    >
                      {suggestion}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {municipalityOptions.length > 0 ? (
              <Select
                label="Municipality"
                value={form.municipality ?? ''}
                disabled={fetchingMunicipality}
                placeholder="— select —"
                options={municipalityOptions.map(m => ({ value: m, label: m }))}
                onChange={(e) => {
                  const v = (e.target as HTMLSelectElement).value || null
                  setForm(f => ({ ...f, municipality: v, neighbourhood: null }))
                  setNeighbourhoodOptions([])
                }}
              />
            ) : (
              <Input
                label="Municipality"
                value={form.municipality ?? ''}
                disabled={fetchingMunicipality}
                onChange={(e) => setForm(f => ({ ...f, municipality: e.target.value || null }))}
                placeholder="e.g. Toronto C01"
              />
            )}

            {neighbourhoodOptions.length > 0 ? (
              <Select
                label="Neighbourhood"
                value={form.neighbourhood ?? ''}
                disabled={fetchingNeighbourhood}
                placeholder="— select —"
                options={neighbourhoodOptions.map(n => ({ value: n, label: n }))}
                onChange={(e) => setForm(f => ({ ...f, neighbourhood: (e.target as HTMLSelectElement).value || null }))}
              />
            ) : (
              <Input
                label="Neighbourhood"
                value={form.neighbourhood ?? ''}
                disabled={fetchingNeighbourhood}
                onChange={(e) => setForm(f => ({ ...f, neighbourhood: e.target.value || null }))}
                placeholder="e.g. Annex"
              />
            )}
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
