import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { DashboardLayout } from '@/components/dashboard'
import { PageHeader } from '@/components/layout'
import { Card } from '@/components/layout'
import { StatsCard, TrafficChart, LeadSourceChart, ConversionChart } from '@/components/analytics'
import { Users, TrendingUp, Eye, DollarSign } from 'lucide-react'

export default async function AnalyticsPage() {
  const session = await getSession()
  if (!session) return null

  const [contactCount, dealCount, pageViews, searchCount] = await Promise.all([
    prisma.contact.count(),
    prisma.deal.count(),
    prisma.visitorLog.count(),
    prisma.propertySearchLog.count(),
  ])

  // Lead sources
  const leadSources = await prisma.contact.groupBy({
    by: ['source'],
    _count: { id: true },
  })

  const leadSourceData = leadSources.map(s => ({
    source: s.source ?? 'unknown',
    count: s._count.id,
  }))

  // Mock traffic data (replace with real analytics in production)
  const trafficData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    return {
      date: d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' }),
      visitors: Math.floor(Math.random() * 200 + 100),
      leads: Math.floor(Math.random() * 20 + 5),
    }
  })

  const conversionData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date()
    d.setMonth(d.getMonth() - (5 - i))
    return {
      month: d.toLocaleDateString('en-CA', { month: 'short' }),
      rate: parseFloat((Math.random() * 4 + 2).toFixed(1)),
    }
  })

  return (
    <DashboardLayout user={session}>
      <PageHeader
        title="Analytics"
        breadcrumbs={[{ label: 'Dashboard', href: '/admin/dashboard' }, { label: 'Analytics' }]}
      />

      <div className="flex flex-col gap-6">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard title="Total Contacts" value={contactCount} icon={<Users size={20} />} change={12} />
          <StatsCard title="Active Deals" value={dealCount} icon={<TrendingUp size={20} />} change={5} />
          <StatsCard title="Page Views" value={pageViews.toLocaleString()} icon={<Eye size={20} />} />
          <StatsCard title="Searches" value={searchCount.toLocaleString()} icon={<DollarSign size={20} />} />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <h3 className="font-semibold text-charcoal-900 mb-4">Website Traffic (Last 7 Days)</h3>
            <TrafficChart data={trafficData} />
          </Card>
          <Card>
            <h3 className="font-semibold text-charcoal-900 mb-4">Lead Sources</h3>
            <LeadSourceChart data={leadSourceData.length ? leadSourceData : [{ source: 'website', count: 1 }]} />
          </Card>
        </div>

        <Card>
          <h3 className="font-semibold text-charcoal-900 mb-4">Conversion Rate Trend</h3>
          <ConversionChart data={conversionData} />
        </Card>
      </div>
    </DashboardLayout>
  )
}
