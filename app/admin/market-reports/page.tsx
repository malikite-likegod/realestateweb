import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { DashboardLayout } from '@/components/dashboard'
import { PageHeader } from '@/components/layout'
import { Badge, Button } from '@/components/ui'
import { formatDate } from '@/lib/utils'
import { Plus, Eye, Edit } from 'lucide-react'
import Link from 'next/link'

export default async function MarketReportsPage() {
  const session = await getSession()
  if (!session) return null

  const reports = await prisma.marketReport.findMany({ orderBy: { createdAt: 'desc' } })

  return (
    <DashboardLayout user={session}>
      <PageHeader
        title="Market Reports"
        subtitle={`${reports.length} report${reports.length !== 1 ? 's' : ''}`}
        breadcrumbs={[{ label: 'Dashboard', href: '/admin/dashboard' }, { label: 'Market Reports' }]}
        actions={
          <Button variant="primary" leftIcon={<Plus size={16} />} asChild>
            <Link href="/admin/market-reports/new">New Report</Link>
          </Button>
        }
      />
      <div className="overflow-x-auto rounded-xl border border-charcoal-100">
        <table className="w-full text-sm">
          <thead className="bg-charcoal-50 border-b border-charcoal-100">
            <tr>
              {['Title', 'Area', 'Period', 'Status', 'Leads', 'Views', 'Published', 'Actions'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-charcoal-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-charcoal-100 bg-white">
            {reports.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-charcoal-400">No market reports yet. Create your first one.</td>
              </tr>
            )}
            {reports.map(report => (
              <tr key={report.id} className="hover:bg-charcoal-50 transition-colors">
                <td className="px-4 py-3 font-medium text-charcoal-900">{report.title}</td>
                <td className="px-4 py-3 text-charcoal-500">{report.area ?? '—'}</td>
                <td className="px-4 py-3 text-charcoal-500">{report.reportMonth ?? '—'}</td>
                <td className="px-4 py-3">
                  <Badge variant={report.status === 'published' ? 'success' : 'default'} className="capitalize">{report.status}</Badge>
                </td>
                <td className="px-4 py-3 text-charcoal-600">{report.leads.toLocaleString()}</td>
                <td className="px-4 py-3 text-charcoal-600">{report.views.toLocaleString()}</td>
                <td className="px-4 py-3 text-charcoal-400 text-xs">
                  {report.publishedAt ? formatDate(report.publishedAt, { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                </td>
                <td className="px-4 py-3 flex items-center gap-2">
                  {report.status === 'published' && (
                    <Link href={`/market-report/${report.slug}`} className="p-1.5 text-charcoal-400 hover:text-charcoal-700" target="_blank"><Eye size={16} /></Link>
                  )}
                  <Link href={`/admin/market-reports/${report.id}`} className="p-1.5 text-charcoal-400 hover:text-charcoal-700"><Edit size={16} /></Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DashboardLayout>
  )
}
