'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/dashboard'
import { PageHeader } from '@/components/layout'
import { Card } from '@/components/layout'
import { Input, Textarea, Select, Button } from '@/components/ui'
import { useToast } from '@/components/ui'

const defaultForm = {
  title: '',
  reportMonth: '',
  area: '',
  excerpt: '',
  body: '',
  coverImage: '',
  authorName: '',
  status: 'draft',
  ctaTitle: 'Get the Full In-Depth Report',
  ctaSubtitle: 'Enter your details below and we\'ll send you a comprehensive market analysis.',
  metaTitle: '',
  metaDesc: '',
}

export default function NewMarketReportPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState(defaultForm)
  const intentRef = useRef<'draft' | 'published'>('draft')

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/market-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, status: intentRef.current }),
      })
      if (!res.ok) throw new Error()
      toast('success', 'Market report created!')
      router.push('/admin/market-reports')
    } catch {
      toast('error', 'Failed to create report')
    } finally {
      setLoading(false)
    }
  }

  const user = { name: 'Admin', email: '', avatarUrl: null }

  return (
    <DashboardLayout user={user}>
      <PageHeader
        title="New Market Report"
        breadcrumbs={[
          { label: 'Dashboard', href: '/admin/dashboard' },
          { label: 'Market Reports', href: '/admin/market-reports' },
          { label: 'New' },
        ]}
      />
      <form onSubmit={handleSubmit} className="flex flex-col gap-6 max-w-3xl">
        {/* Core details */}
        <Card>
          <h2 className="text-sm font-semibold text-charcoal-700 mb-4">Report Details</h2>
          <div className="flex flex-col gap-4">
            <Input label="Title *" required value={form.title} onChange={set('title')} placeholder="e.g. Toronto Real Estate Market Update" />
            <div className="grid grid-cols-2 gap-4">
              <Input label="Reporting Period" value={form.reportMonth} onChange={set('reportMonth')} placeholder="e.g. March 2026" />
              <Input label="Area / Neighbourhood" value={form.area} onChange={set('area')} placeholder="e.g. Downtown Toronto" />
            </div>
            <Input label="Author Name" value={form.authorName} onChange={set('authorName')} placeholder="e.g. Jane Smith" />
            <Input label="Cover Image URL" value={form.coverImage} onChange={set('coverImage')} placeholder="https://..." />
          </div>
        </Card>

        {/* Market overview content */}
        <Card>
          <h2 className="text-sm font-semibold text-charcoal-700 mb-4">Market Overview (Public Content)</h2>
          <div className="flex flex-col gap-4">
            <Input label="Excerpt" value={form.excerpt} onChange={set('excerpt')} placeholder="Short summary shown in listings and previews" />
            <Textarea
              label="Body (HTML supported) *"
              required
              rows={16}
              value={form.body}
              onChange={set('body')}
              placeholder="Write the market overview here. This is the public-facing content visitors will read before being prompted to request the full report."
            />
          </div>
        </Card>

        {/* Lead capture CTA */}
        <Card>
          <h2 className="text-sm font-semibold text-charcoal-700 mb-1">Lead Capture Form Copy</h2>
          <p className="text-xs text-charcoal-400 mb-4">These appear above the contact form at the bottom of the report page.</p>
          <div className="flex flex-col gap-4">
            <Input label="CTA Headline" value={form.ctaTitle} onChange={set('ctaTitle')} />
            <Input label="CTA Subtitle" value={form.ctaSubtitle} onChange={set('ctaSubtitle')} />
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
        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={() => router.back()}>Cancel</Button>
          <Button type="submit" variant="secondary" loading={loading} onClick={() => { intentRef.current = 'draft' }}>Save as Draft</Button>
          <Button type="submit" variant="primary" loading={loading} onClick={() => { intentRef.current = 'published' }}>Publish</Button>
        </div>
      </form>
    </DashboardLayout>
  )
}
