'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/dashboard'
import { PageHeader } from '@/components/layout'
import { Card } from '@/components/layout'
import { Input, Textarea, Button } from '@/components/ui'
import { useToast } from '@/components/ui'

interface BlogPostData {
  id:         string
  slug:       string
  title:      string
  excerpt:    string | null
  body:       string
  coverImage: string | null
  authorName: string | null
  status:     string
  metaTitle:  string | null
  metaDesc:   string | null
}

interface Props {
  initial?: BlogPostData
}

export function BlogPostForm({ initial }: Props) {
  const router = useRouter()
  const { toast } = useToast()
  const isEdit = Boolean(initial)
  const intentRef = useRef<'draft' | 'published'>('draft')

  const [form, setForm] = useState({
    title:      initial?.title      ?? '',
    excerpt:    initial?.excerpt    ?? '',
    body:       initial?.body       ?? '',
    coverImage: initial?.coverImage ?? '',
    authorName: initial?.authorName ?? '',
    metaTitle:  initial?.metaTitle  ?? '',
    metaDesc:   initial?.metaDesc   ?? '',
  })
  const [loading, setLoading] = useState(false)

  const set = (field: string) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [field]: e.target.value }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const url    = isEdit ? `/api/blog/${initial!.slug}` : '/api/blog'
      const method = isEdit ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, status: intentRef.current }),
      })
      if (!res.ok) throw new Error()
      toast('success', isEdit ? 'Post updated!' : 'Post created!')
      router.push('/admin/blog')
    } catch {
      toast('error', 'Failed to save post')
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete() {
    if (!confirm('Delete this post? This cannot be undone.')) return
    try {
      const res = await fetch(`/api/blog/${initial!.slug}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast('success', 'Post deleted')
      router.push('/admin/blog')
    } catch {
      toast('error', 'Failed to delete post')
    }
  }

  const user = { name: 'Admin', email: '', avatarUrl: null }

  return (
    <DashboardLayout user={user}>
      <PageHeader
        title={isEdit ? 'Edit Blog Post' : 'New Blog Post'}
        breadcrumbs={[
          { label: 'Dashboard', href: '/admin/dashboard' },
          { label: 'Blog', href: '/admin/blog' },
          { label: isEdit ? initial!.title : 'New' },
        ]}
      />

      <form onSubmit={handleSubmit} className="flex flex-col gap-6 max-w-3xl">
        <Card>
          <h2 className="text-sm font-semibold text-charcoal-700 mb-4">Post Details</h2>
          <div className="flex flex-col gap-4">
            <Input label="Title *" required value={form.title} onChange={set('title')} />
            <Input label="Excerpt" value={form.excerpt} onChange={set('excerpt')} />
            <Input label="Cover Image URL" value={form.coverImage} onChange={set('coverImage')} placeholder="https://..." />
            <Input label="Author Name" value={form.authorName} onChange={set('authorName')} />
          </div>
        </Card>

        <Card>
          <h2 className="text-sm font-semibold text-charcoal-700 mb-2">Content *</h2>
          <p className="text-xs text-charcoal-400 mb-3">HTML or Markdown supported.</p>
          <Textarea required rows={16} value={form.body} onChange={set('body')}
            className="font-mono text-sm"
          />
        </Card>

        <Card>
          <h2 className="text-sm font-semibold text-charcoal-700 mb-4">SEO (optional)</h2>
          <div className="flex flex-col gap-4">
            <Input label="Meta Title" value={form.metaTitle} onChange={set('metaTitle')} />
            <Input label="Meta Description" value={form.metaDesc} onChange={set('metaDesc')} />
          </div>
        </Card>

        <div className="flex justify-between gap-3">
          {isEdit && (
            <Button type="button" variant="ghost" onClick={handleDelete} className="text-red-500 hover:text-red-700">
              Delete Post
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
