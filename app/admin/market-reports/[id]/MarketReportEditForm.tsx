'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/dashboard'
import { PageHeader } from '@/components/layout'
import { Card } from '@/components/layout'
import { Input, Textarea, Select, Button } from '@/components/ui'
import { useToast } from '@/components/ui'
import type { MarketReport } from '@prisma/client'

interface Props { report: MarketReport }

export function MarketReportEditForm({ report }: Props) {
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    title: report.title,
    reportMonth: report.reportMonth ?? '',
    area: report.area ?? '',
    excerpt: report.excerpt ?? '',
    body: report.body,
    coverImage: report.coverImage ?? '',
    authorName: report.authorName ?? '',
    status: report.status,
    ctaTitle: report.ctaTitle ?? 'Get the Full In-Depth Report',
    ctaSubtitle: report.ctaSubtitle ?? "Enter your details below and we'll send you a comprehensive market analysis.",
    metaTitle: report.metaTitle ?? '',
    metaDesc: report.metaDesc ?? '',
  })

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch(`/api/market-reports/${report.slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error()
      toast('success', 'Report updated!')
      router.push('/admin/market-reports')
    } catch {
      toast('error', 'Failed to update report')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Delete this market report? This cannot be undone.')) return
    try {
      await fetch(`/api/market-reports/${report.slug}`, { method: 'DELETE' })
      toast('success', 'Report deleted')
      router.push('/admin/market-reports')
    } catch {
      toast('error', 'Failed to delete report')
    }
  }

  const user = { name: 'Admin', email: '', avatarUrl: null }

  return (
    <DashboardLayout user={user}>
      <PageHeader
        title="Edit Market Report"
        breadcrumbs={[
          { label: 'Dashboard', href: '/admin/dashboard' },
          { label: 'Market Reports', href: '/admin/market-reports' },
          { label: report.title },
        ]}
      />
      <form onSubmit={handleSubmit} className="flex flex-col gap-6 max-w-3xl">
        <Card>
          <h2 className="text-sm font-semibold text-charcoal-700 mb-4">Report Details</h2>
          <div className="flex flex-col gap-4">
            <Input label="Title *" required value={form.title} onChange={set('title')} />
            <div className="grid grid-cols-2 gap-4">
              <Input label="Reporting Period" value={form.reportMonth} onChange={set('reportMonth')} placeholder="e.g. March 2026" />
              <Input label="Area / Neighbourhood" value={form.area} onChange={set('area')} />
            </div>
            <Input label="Author Name" value={form.authorName} onChange={set('authorName')} />
            <Input label="Cover Image URL" value={form.coverImage} onChange={set('coverImage')} />
            <Select
              label="Status"
              value={form.status}
              onChange={set('status')}
              options={[{ value: 'draft', label: 'Draft' }, { value: 'published', label: 'Published' }]}
            />
          </div>
        </Card>

        <Card>
          <h2 className="text-sm font-semibold text-charcoal-700 mb-4">Market Overview (Public Content)</h2>
          <div className="flex flex-col gap-4">
            <Input label="Excerpt" value={form.excerpt} onChange={set('excerpt')} />
            <Textarea label="Body (HTML supported) *" required rows={16} value={form.body} onChange={set('body')} />
          </div>
        </Card>

        <Card>
          <h2 className="text-sm font-semibold text-charcoal-700 mb-1">Lead Capture Form Copy</h2>
          <p className="text-xs text-charcoal-400 mb-4">These appear above the contact form on the report page.</p>
          <div className="flex flex-col gap-4">
            <Input label="CTA Headline" value={form.ctaTitle} onChange={set('ctaTitle')} />
            <Input label="CTA Subtitle" value={form.ctaSubtitle} onChange={set('ctaSubtitle')} />
          </div>
        </Card>

        <Card>
          <h2 className="text-sm font-semibold text-charcoal-700 mb-4">SEO (optional)</h2>
          <div className="flex flex-col gap-4">
            <Input label="Meta Title" value={form.metaTitle} onChange={set('metaTitle')} />
            <Input label="Meta Description" value={form.metaDesc} onChange={set('metaDesc')} />
          </div>
        </Card>

        <div className="flex justify-between gap-3">
          <Button type="button" variant="ghost" onClick={handleDelete} className="text-red-500 hover:text-red-700">Delete Report</Button>
          <div className="flex gap-3">
            <Button type="button" variant="ghost" onClick={() => router.back()}>Cancel</Button>
            <Button type="submit" variant="primary" loading={loading}>Save Changes</Button>
          </div>
        </div>
      </form>
    </DashboardLayout>
  )
}
