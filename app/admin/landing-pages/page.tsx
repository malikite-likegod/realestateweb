import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { DashboardLayout } from '@/components/dashboard'
import { PageHeader } from '@/components/layout'
import { Badge, Button } from '@/components/ui'
import { formatDate } from '@/lib/utils'
import { Plus, Eye, Edit, Link2 } from 'lucide-react'
import Link from 'next/link'
import { APP_URL } from '@/lib/constants'

export default async function LandingPagesPage() {
  const session = await getSession()
  if (!session) return null

  const pages = await prisma.landingPage.findMany({ orderBy: { createdAt: 'desc' } })

  return (
    <DashboardLayout user={session}>
      <PageHeader
        title="Landing Pages"
        subtitle={`${pages.length} page${pages.length !== 1 ? 's' : ''}`}
        breadcrumbs={[{ label: 'Dashboard', href: '/admin/dashboard' }, { label: 'Landing Pages' }]}
        actions={
          <Button variant="primary" leftIcon={<Plus size={16} />} asChild>
            <Link href="/admin/landing-pages/new">New Page</Link>
          </Button>
        }
      />
      <div className="overflow-x-auto rounded-xl border border-charcoal-100">
        <table className="w-full text-sm">
          <thead className="bg-charcoal-50 border-b border-charcoal-100">
            <tr>
              {['Title', 'URL', 'Status', 'Leads', 'Views', 'Published', 'Actions'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-charcoal-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-charcoal-100 bg-white">
            {pages.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-charcoal-400">No landing pages yet. Create your first one.</td>
              </tr>
            )}
            {pages.map(p => (
              <tr key={p.id} className="hover:bg-charcoal-50 transition-colors">
                <td className="px-4 py-3 font-medium text-charcoal-900">{p.title}</td>
                <td className="px-4 py-3">
                  <span className="flex items-center gap-1 text-xs text-charcoal-400 font-mono">
                    <Link2 size={11} />
                    /lp/{p.slug}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <Badge variant={p.status === 'published' ? 'success' : 'default'} className="capitalize">{p.status}</Badge>
                </td>
                <td className="px-4 py-3 text-charcoal-600">{p.leads.toLocaleString()}</td>
                <td className="px-4 py-3 text-charcoal-600">{p.views.toLocaleString()}</td>
                <td className="px-4 py-3 text-charcoal-400 text-xs">
                  {p.publishedAt ? formatDate(p.publishedAt, { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                </td>
                <td className="px-4 py-3 flex items-center gap-2">
                  {p.status === 'published' && (
                    <a href={`${APP_URL}/lp/${p.slug}`} className="p-1.5 text-charcoal-400 hover:text-charcoal-700" target="_blank" rel="noreferrer">
                      <Eye size={16} />
                    </a>
                  )}
                  <Link href={`/admin/landing-pages/${p.id}`} className="p-1.5 text-charcoal-400 hover:text-charcoal-700">
                    <Edit size={16} />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DashboardLayout>
  )
}
