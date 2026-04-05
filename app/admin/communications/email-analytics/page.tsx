import { redirect }            from 'next/navigation'
import { getSession }          from '@/lib/auth'
import { prisma }              from '@/lib/prisma'
import { DashboardLayout }     from '@/components/dashboard'
import { PageHeader, Card }    from '@/components/layout'
import { CampaignStatsCards }  from '@/components/communications/CampaignStatsCards'
import { formatDate }          from '@/lib/utils'
import Link                    from 'next/link'

export default async function EmailAnalyticsPage() {
  const session = await getSession()
  if (!session) redirect('/admin/login')

  const campaigns = await prisma.emailCampaign.findMany({
    orderBy: { sentAt: 'desc' },
    include: { emails: { select: { openCount: true, clickCount: true } } },
  })

  // Per-campaign stats
  const rows = campaigns.map(c => {
    const opens     = c.emails.filter(e => e.openCount  > 0).length
    const clicks    = c.emails.filter(e => e.clickCount > 0).length
    const openRate  = c.recipientCount > 0
      ? (opens  / c.recipientCount * 100).toFixed(1) + '%'
      : '—'
    const clickRate = c.recipientCount > 0
      ? (clicks / c.recipientCount * 100).toFixed(1) + '%'
      : '—'
    return { ...c, opens, clicks, openRate, clickRate }
  })

  // Aggregate top-level stats
  const totalSent    = campaigns.reduce((sum, c) => sum + c.recipientCount, 0)
  const rateRows     = rows.filter(r => r.recipientCount > 0)
  const avgOpenRate  = rateRows.length > 0
    ? (rateRows.reduce((sum, r) => sum + (r.opens / r.recipientCount * 100), 0) / rateRows.length).toFixed(1) + '%'
    : '—'
  const avgClickRate = rateRows.length > 0
    ? (rateRows.reduce((sum, r) => sum + (r.clicks / r.recipientCount * 100), 0) / rateRows.length).toFixed(1) + '%'
    : '—'

  return (
    <DashboardLayout user={session}>
      <PageHeader
        title="Email Analytics"
        subtitle="Campaign open and click rates"
        breadcrumbs={[
          { label: 'Dashboard',      href: '/admin/dashboard' },
          { label: 'Communications', href: '/admin/communications' },
          { label: 'Email Analytics' },
        ]}
      />

      <CampaignStatsCards stats={[
        { label: 'Total Campaigns', value: campaigns.length },
        { label: 'Total Sent',      value: totalSent },
        { label: 'Avg Open Rate',   value: avgOpenRate },
        { label: 'Avg Click Rate',  value: avgClickRate },
      ]} />

      <Card padding="none">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-charcoal-100 text-left text-xs text-charcoal-500 uppercase tracking-wide">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Sent</th>
              <th className="px-4 py-3 text-right">Recipients</th>
              <th className="px-4 py-3 text-right">Opens</th>
              <th className="px-4 py-3 text-right">Open Rate</th>
              <th className="px-4 py-3 text-right">Clicks</th>
              <th className="px-4 py-3 text-right">Click Rate</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-charcoal-400">
                  No campaigns yet
                </td>
              </tr>
            ) : rows.map(row => (
              <tr key={row.id} className="border-b border-charcoal-50 hover:bg-charcoal-50 transition-colors">
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/communications/email-analytics/${row.id}`}
                    className="text-gold-600 hover:underline font-medium"
                  >
                    {row.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-charcoal-500">
                  {formatDate(row.sentAt, { month: 'short', day: 'numeric', year: 'numeric' })}
                </td>
                <td className="px-4 py-3 text-right text-charcoal-700">{row.recipientCount}</td>
                <td className="px-4 py-3 text-right text-charcoal-700">{row.opens}</td>
                <td className="px-4 py-3 text-right font-medium text-charcoal-900">{row.openRate}</td>
                <td className="px-4 py-3 text-right text-charcoal-700">{row.clicks}</td>
                <td className="px-4 py-3 text-right font-medium text-charcoal-900">{row.clickRate}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </DashboardLayout>
  )
}
