'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/dashboard'
import { PageHeader } from '@/components/layout'
import { Card } from '@/components/layout'
import { Input, Textarea, Button } from '@/components/ui'
import { useToast } from '@/components/ui'
import { Eye, EyeOff } from 'lucide-react'

interface LandingPageData {
  id:          string
  slug:        string
  title:       string
  content:     string
  status:      string
  ctaTitle:    string | null
  ctaSubtitle: string | null
  autoTags:    string | null
  agentName:   string | null
  agentTitle:  string | null
  agentPhone:  string | null
  agentEmail:  string | null
  agentPhoto:  string | null
  agentBio:    string | null
  metaTitle:   string | null
  metaDesc:    string | null
}

interface Props {
  initial?: LandingPageData
}

const AGENT_DEFAULTS = {
  agentName:  'Michael Taylor',
  agentTitle: 'Real Estate Agent',
  agentPhone: '(416) 888-8352',
  agentEmail: 'miketaylor.realty@gmail.com',
  agentPhoto: '',
  agentBio:   'Helping first time home buyers & upsizers transition into a new home across Toronto and the GTA.',
}

export function LandingPageForm({ initial }: Props) {
  const router  = useRouter()
  const { toast } = useToast()
  const isEdit  = Boolean(initial)
  const intentRef = useRef<'draft' | 'published'>('draft')

  function tagsToString(json: string | null) {
    if (!json) return ''
    try { return (JSON.parse(json) as string[]).join(', ') } catch { return '' }
  }

  const [form, setForm] = useState({
    title:       initial?.title       ?? '',
    slug:        initial?.slug        ?? '',
    content:     initial?.content     ?? '',
    ctaTitle:    initial?.ctaTitle    ?? 'Ready to Take the Next Step?',
    ctaSubtitle: initial?.ctaSubtitle ?? "Fill in your details and I'll be in touch shortly.",
    tagsInput:   tagsToString(initial?.autoTags ?? null),
    agentName:   initial?.agentName   ?? AGENT_DEFAULTS.agentName,
    agentTitle:  initial?.agentTitle  ?? AGENT_DEFAULTS.agentTitle,
    agentPhone:  initial?.agentPhone  ?? AGENT_DEFAULTS.agentPhone,
    agentEmail:  initial?.agentEmail  ?? AGENT_DEFAULTS.agentEmail,
    agentPhoto:  initial?.agentPhoto  ?? AGENT_DEFAULTS.agentPhoto,
    agentBio:    initial?.agentBio    ?? AGENT_DEFAULTS.agentBio,
    metaTitle:   initial?.metaTitle   ?? '',
    metaDesc:    initial?.metaDesc    ?? '',
  })

  const [loading,     setLoading]     = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  const set = (field: string) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [field]: e.target.value }))

  // Auto-generate slug from title (only when creating)
  function handleTitleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const title = e.target.value
    setForm(f => ({
      ...f,
      title,
      slug: isEdit ? f.slug : title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const autoTags = JSON.stringify(
      form.tagsInput.split(',').map(t => t.trim()).filter(Boolean)
    )

    const payload = {
      title:       form.title,
      slug:        form.slug || undefined,
      content:     form.content,
      status:      intentRef.current,
      ctaTitle:    form.ctaTitle,
      ctaSubtitle: form.ctaSubtitle,
      autoTags,
      agentName:   form.agentName,
      agentTitle:  form.agentTitle,
      agentPhone:  form.agentPhone,
      agentEmail:  form.agentEmail,
      agentPhoto:  form.agentPhoto,
      agentBio:    form.agentBio,
      metaTitle:   form.metaTitle,
      metaDesc:    form.metaDesc,
    }

    try {
      const url    = isEdit ? `/api/landing-pages/${initial!.slug}` : '/api/landing-pages'
      const method = isEdit ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error()
      toast('success', isEdit ? 'Page updated!' : 'Landing page created!')
      router.push('/admin/landing-pages')
    } catch {
      toast('error', 'Failed to save landing page')
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete() {
    if (!confirm('Delete this landing page? This cannot be undone.')) return
    try {
      const res = await fetch(`/api/landing-pages/${initial!.slug}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast('success', 'Page deleted')
      router.push('/admin/landing-pages')
    } catch {
      toast('error', 'Failed to delete page')
    }
  }

  const user = { name: 'Admin', email: '', avatarUrl: null }

  return (
    <DashboardLayout user={user}>
      <PageHeader
        title={isEdit ? 'Edit Landing Page' : 'New Landing Page'}
        breadcrumbs={[
          { label: 'Dashboard', href: '/admin/dashboard' },
          { label: 'Landing Pages', href: '/admin/landing-pages' },
          { label: isEdit ? initial!.title : 'New' },
        ]}
      />

      <form onSubmit={handleSubmit} className="flex flex-col gap-6 max-w-4xl">

        {/* Page identity */}
        <Card>
          <h2 className="text-sm font-semibold text-charcoal-700 mb-4">Page Details</h2>
          <div className="flex flex-col gap-4">
            <Input label="Page Title *" required value={form.title} onChange={handleTitleChange} placeholder="e.g. First-Time Buyer Free Consultation" />
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-charcoal-600">URL Slug</label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-charcoal-400 shrink-0">/lp/</span>
                <input
                  type="text"
                  value={form.slug}
                  onChange={set('slug')}
                  placeholder="first-time-buyer"
                  className="flex-1 rounded-lg border border-charcoal-200 px-3 py-2 text-sm text-charcoal-900 placeholder-charcoal-400 focus:outline-none focus:ring-2 focus:ring-gold-500"
                />
              </div>
            </div>
          </div>
        </Card>

        {/* HTML Content */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-charcoal-700">HTML Content *</h2>
              <p className="text-xs text-charcoal-400 mt-0.5">Paste your HTML here — it will be rendered exactly as-is above the lead form.</p>
            </div>
            <button
              type="button"
              onClick={() => setShowPreview(v => !v)}
              className="flex items-center gap-1.5 text-xs text-charcoal-500 hover:text-charcoal-800 transition-colors"
            >
              {showPreview ? <EyeOff size={14} /> : <Eye size={14} />}
              {showPreview ? 'Hide preview' : 'Show preview'}
            </button>
          </div>

          <textarea
            required
            rows={18}
            value={form.content}
            onChange={set('content')}
            placeholder={'<section style="background:#1a1a2e;padding:80px 40px;text-align:center">\n  <h1 style="color:#fff;font-size:2.5rem">Your Headline Here</h1>\n  <p style="color:#ccc;margin-top:1rem">Supporting copy goes here.</p>\n</section>'}
            className="w-full rounded-lg border border-charcoal-200 px-3 py-2.5 text-sm font-mono text-charcoal-900 placeholder-charcoal-400 focus:outline-none focus:ring-2 focus:ring-gold-500 resize-y"
          />

          {showPreview && form.content && (
            <div className="mt-4">
              <p className="text-xs text-charcoal-400 mb-2">Preview (sandboxed):</p>
              <iframe
                srcDoc={form.content}
                sandbox="allow-scripts"
                className="w-full rounded-lg border border-charcoal-200 bg-white"
                style={{ height: '400px' }}
                title="HTML preview"
              />
            </div>
          )}
        </Card>

        {/* Lead form settings */}
        <Card>
          <h2 className="text-sm font-semibold text-charcoal-700 mb-1">Lead Capture Form</h2>
          <p className="text-xs text-charcoal-400 mb-4">Shown below your HTML content. Tags are automatically applied to every contact who submits this form.</p>
          <div className="flex flex-col gap-4">
            <Input label="Form Headline" value={form.ctaTitle} onChange={set('ctaTitle')} placeholder="Ready to Take the Next Step?" />
            <Input label="Form Sub-copy" value={form.ctaSubtitle} onChange={set('ctaSubtitle')} placeholder="Fill in your details and I'll be in touch shortly." />
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-charcoal-600">Auto-apply Tags <span className="text-charcoal-400">(comma-separated)</span></label>
              <input
                type="text"
                value={form.tagsInput}
                onChange={set('tagsInput')}
                placeholder="e.g. buyer-lead, facebook-ad, july-campaign"
                className="rounded-lg border border-charcoal-200 px-3 py-2 text-sm text-charcoal-900 placeholder-charcoal-400 focus:outline-none focus:ring-2 focus:ring-gold-500"
              />
              <p className="text-xs text-charcoal-400">These tags will be created if they don&apos;t exist, then applied to every lead from this page.</p>
            </div>
          </div>
        </Card>

        {/* Agent info */}
        <Card>
          <h2 className="text-sm font-semibold text-charcoal-700 mb-1">Agent Info</h2>
          <p className="text-xs text-charcoal-400 mb-4">Displayed below the form as a trust-builder. Defaults to your profile info.</p>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Name" value={form.agentName} onChange={set('agentName')} />
            <Input label="Title / Designation" value={form.agentTitle} onChange={set('agentTitle')} />
            <Input label="Phone" value={form.agentPhone} onChange={set('agentPhone')} />
            <Input label="Email" value={form.agentEmail} onChange={set('agentEmail')} />
            <div className="col-span-2">
              <Input label="Photo URL" value={form.agentPhoto} onChange={set('agentPhoto')} placeholder="https://..." />
            </div>
            <div className="col-span-2">
              <Textarea label="Bio / Tagline" rows={3} value={form.agentBio} onChange={set('agentBio')} />
            </div>
          </div>
        </Card>

        {/* SEO */}
        <Card>
          <h2 className="text-sm font-semibold text-charcoal-700 mb-4">SEO (optional)</h2>
          <div className="flex flex-col gap-4">
            <Input label="Meta Title" value={form.metaTitle} onChange={set('metaTitle')} />
            <Input label="Meta Description" value={form.metaDesc} onChange={set('metaDesc')} />
          </div>
        </Card>

        {/* Actions */}
        <div className="flex justify-between gap-3">
          {isEdit && (
            <Button type="button" variant="ghost" onClick={handleDelete} className="text-red-500 hover:text-red-700">
              Delete Page
            </Button>
          )}
          <div className="flex gap-3 ml-auto">
            <Button type="button" variant="ghost" onClick={() => router.back()}>Cancel</Button>
            <Button type="submit" variant="secondary" loading={loading} onClick={() => { intentRef.current = 'draft' }}>
              Save as Draft
            </Button>
            <Button type="submit" variant="primary" loading={loading} onClick={() => { intentRef.current = 'published' }}>
              Publish
            </Button>
          </div>
        </div>
      </form>
    </DashboardLayout>
  )
}
