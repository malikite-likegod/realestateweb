import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { DashboardLayout } from '@/components/dashboard'
import { PageHeader } from '@/components/layout'
import { Badge, Button } from '@/components/ui'
import { formatDate } from '@/lib/utils'
import { Plus, Eye, Edit } from 'lucide-react'
import Link from 'next/link'

export default async function BlogManagerPage() {
  const session = await getSession()
  if (!session) redirect('/admin/login')

  const posts = await prisma.blogPost.findMany({ orderBy: { createdAt: 'desc' } })

  return (
    <DashboardLayout user={session}>
      <PageHeader
        title="Blog CMS"
        subtitle={`${posts.length} posts`}
        breadcrumbs={[{ label: 'Dashboard', href: '/admin/dashboard' }, { label: 'Blog' }]}
        actions={
          <Button variant="primary" leftIcon={<Plus size={16} />} asChild>
            <Link href="/admin/blog/new">New Post</Link>
          </Button>
        }
      />
      <div className="overflow-x-auto rounded-xl border border-charcoal-100">
        <table className="w-full text-sm">
          <thead className="bg-charcoal-50 border-b border-charcoal-100">
            <tr>
              {['Title', 'Status', 'Author', 'Views', 'Published', 'Actions'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-charcoal-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-charcoal-100 bg-white">
            {posts.map(post => (
              <tr key={post.id} className="hover:bg-charcoal-50 transition-colors">
                <td className="px-4 py-3 font-medium text-charcoal-900">{post.title}</td>
                <td className="px-4 py-3">
                  <Badge variant={post.status === 'published' ? 'success' : 'default'} className="capitalize">{post.status}</Badge>
                </td>
                <td className="px-4 py-3 text-charcoal-500">{post.authorName ?? '—'}</td>
                <td className="px-4 py-3 text-charcoal-600">{post.views.toLocaleString()}</td>
                <td className="px-4 py-3 text-charcoal-400 text-xs">
                  {post.publishedAt ? formatDate(post.publishedAt, { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                </td>
                <td className="px-4 py-3 flex items-center gap-2">
                  {post.status === 'published' && (
                    <Link href={`/blog/${post.slug}`} className="p-1.5 text-charcoal-400 hover:text-charcoal-700" target="_blank"><Eye size={16} /></Link>
                  )}
                  <Link href={`/admin/blog/${post.id}`} className="p-1.5 text-charcoal-400 hover:text-charcoal-700"><Edit size={16} /></Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DashboardLayout>
  )
}
