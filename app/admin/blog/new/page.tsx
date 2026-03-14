'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/dashboard'
import { PageHeader } from '@/components/layout'
import { Card } from '@/components/layout'
import { Input, Textarea, Select, Button } from '@/components/ui'
import { useToast } from '@/components/ui'

export default function NewBlogPostPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ title: '', excerpt: '', body: '', authorName: '', status: 'draft', coverImage: '', metaTitle: '', metaDesc: '' })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/blog', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      if (!res.ok) throw new Error()
      toast('success', 'Post created!')
      router.push('/admin/blog')
    } catch {
      toast('error', 'Failed to create post')
    } finally {
      setLoading(false)
    }
  }

  const user = { name: 'Admin', email: '', avatarUrl: null }

  return (
    <DashboardLayout user={user}>
      <PageHeader title="New Blog Post" breadcrumbs={[{ label: 'Dashboard', href: '/admin/dashboard' }, { label: 'Blog', href: '/admin/blog' }, { label: 'New' }]} />
      <Card className="max-w-3xl">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input label="Title" required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          <Input label="Excerpt" value={form.excerpt} onChange={e => setForm(f => ({ ...f, excerpt: e.target.value }))} />
          <Textarea label="Body (HTML or Markdown supported)" required rows={12} value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} />
          <Input label="Cover Image URL" value={form.coverImage} onChange={e => setForm(f => ({ ...f, coverImage: e.target.value }))} />
          <Input label="Author Name" value={form.authorName} onChange={e => setForm(f => ({ ...f, authorName: e.target.value }))} />
          <Select label="Status" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
            options={[{ value: 'draft', label: 'Draft' }, { value: 'published', label: 'Publish Now' }]}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={() => router.back()}>Cancel</Button>
            <Button type="submit" variant="primary" loading={loading}>Save Post</Button>
          </div>
        </form>
      </Card>
    </DashboardLayout>
  )
}
