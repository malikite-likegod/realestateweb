import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getPipelineReport } from '@/lib/pipeline/pipeline-service'
import { DashboardLayout } from '@/components/dashboard'
import { PageHeader } from '@/components/layout'
import { Card } from '@/components/layout'
import { StatsCard, TrafficChart, LeadSourceChart, ConversionChart } from '@/components/analytics'
import { Users, TrendingUp, Eye, DollarSign, MessageSquare, Mail, Phone, Target } from 'lucide-react'

export default async function AnalyticsPage() {
  const session = await getSession()
  if (!session) redirect('/admin/login')

  const now        = new Date()
  const day7Ago    = new Date(now); day7Ago.setDate(now.getDate() - 6); day7Ago.setHours(0, 0, 0, 0)
  const month6Ago  = new Date(now); month6Ago.setMonth(now.getMonth() - 5); month6Ago.setDate(1); month6Ago.setHours(0, 0, 0, 0)


  const [
    contactCount,
    dealCount,
    pageViews,
    searchCount,
    leadSources,
    pipelineReport,
    smsSent,
    smsReceived,
    emailsSent,
    callsLogged,
    activeEnrollments,
    visitorsByDay,
    newLeadsByDay,
  ] = await Promise.all([
    prisma.contact.count(),
    prisma.deal.count(),
    prisma.visitorLog.count(),
    prisma.propertySearchLog.count(),
    prisma.contact.groupBy({ by: ['source'], _count: { id: true } }),
    getPipelineReport(),
    prisma.smsMessage.count({ where: { direction: 'outbound' } }),
    prisma.smsMessage.count({ where: { direction: 'inbound' } }),
    prisma.emailMessage.count({ where: { direction: 'outbound' } }),
    prisma.callLog.count(),
    prisma.campaignEnrollment.count({ where: { status: 'active' } }),
    // Real visitor traffic: group by day for last 7 days
    prisma.visitorLog.findMany({
      where: { occurredAt: { gte: day7Ago } },
      select: { occurredAt: true },
    }),
    // New leads by day for last 7 days
    prisma.contact.findMany({
      where: { createdAt: { gte: day7Ago } },
      select: { createdAt: true },
    }),
  ])

  const leadSourceData = leadSources.map(s => ({
    source: s.source ?? 'unknown',
    count:  s._count.id,
  }))

  // Build 7-day traffic data from real logs
  const trafficData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(day7Ago)
    d.setDate(d.getDate() + i)
    const dateStr = d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })
    const dayStart = new Date(d); dayStart.setHours(0, 0, 0, 0)
    const dayEnd   = new Date(d); dayEnd.setHours(23, 59, 59, 999)

    const visitors = visitorsByDay.filter(v =>
      v.occurredAt >= dayStart && v.occurredAt <= dayEnd,
    ).length

    const leads = newLeadsByDay.filter(c =>
      c.createdAt >= dayStart && c.createdAt <= dayEnd,
    ).length

    return { date: dateStr, visitors, leads }
  })

  // Build 6-month conversion trend from real closed deals + contact counts
  const conversionData = await Promise.all(
    Array.from({ length: 6 }, async (_, i) => {
      const d = new Date(month6Ago)
      d.setMonth(d.getMonth() + i)
      const mStart = new Date(d.getFullYear(), d.getMonth(), 1)
      const mEnd   = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999)
      const label  = d.toLocaleDateString('en-CA', { month: 'short' })

      const [newLeads, closedDeals] = await Promise.all([
        prisma.contact.count({ where: { createdAt: { gte: mStart, lte: mEnd } } }),
        prisma.deal.count({ where: { closedAt: { gte: mStart, lte: mEnd } } }),
      ])

      const rate = newLeads === 0 ? 0 : parseFloat(((closedDeals / newLeads) * 100).toFixed(1))
      return { month: label, rate }
    }),
  )

  return (
    <DashboardLayout user={session}>
      <PageHeader
        title="Analytics"
        breadcrumbs={[{ label: 'Dashboard', href: '/admin/dashboard' }, { label: 'Analytics' }]}
      />

      <div className="flex flex-col gap-6">
        {/* Top KPI stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard title="Total Contacts"   value={contactCount}              icon={<Users      size={20} />} change={12} />
          <StatsCard title="Active Deals"     value={dealCount}                 icon={<TrendingUp size={20} />} change={5}  />
          <StatsCard title="Page Views"       value={pageViews.toLocaleString()} icon={<Eye       size={20} />} />
          <StatsCard title="Searches"         value={searchCount.toLocaleString()} icon={<DollarSign size={20} />} />
        </div>

        {/* Communication channel stats */}
        <div>
          <h2 className="text-sm font-semibold text-charcoal-500 uppercase tracking-wide mb-3">Communications</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatsCard title="SMS Sent"           value={smsSent}           icon={<MessageSquare size={20} />} />
            <StatsCard title="SMS Received"       value={smsReceived}       icon={<MessageSquare size={20} />} />
            <StatsCard title="Emails Sent"        value={emailsSent}        icon={<Mail          size={20} />} />
            <StatsCard title="Calls Logged"       value={callsLogged}       icon={<Phone         size={20} />} />
          </div>
        </div>

        {/* Pipeline summary stats */}
        <div>
          <h2 className="text-sm font-semibold text-charcoal-500 uppercase tracking-wide mb-3">Pipeline</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatsCard
              title="Weighted Revenue"
              value={`$${(pipelineReport.weightedRevenue / 1000).toFixed(0)}K`}
              icon={<TrendingUp size={20} />}
            />
            <StatsCard
              title="Total Pipeline Value"
              value={`$${(pipelineReport.totalValue / 1000).toFixed(0)}K`}
              icon={<DollarSign size={20} />}
            />
            <StatsCard
              title="Closed This Month"
              value={pipelineReport.closedThisMonth}
              icon={<TrendingUp size={20} />}
            />
            <StatsCard
              title="Active Enrollments"
              value={activeEnrollments}
              icon={<Target size={20} />}
            />
          </div>
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
          <h3 className="font-semibold text-charcoal-900 mb-4">Lead-to-Close Conversion Rate (Last 6 Months)</h3>
          <ConversionChart data={conversionData} />
        </Card>

        {/* Pipeline stage breakdown */}
        {pipelineReport.stageReports.length > 0 && (
          <Card>
            <h3 className="font-semibold text-charcoal-900 mb-4">Pipeline Stage Breakdown</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-charcoal-400 uppercase tracking-wide border-b border-charcoal-100">
                    <th className="text-left pb-2 font-medium">Stage</th>
                    <th className="text-right pb-2 font-medium">Deals</th>
                    <th className="text-right pb-2 font-medium">Value</th>
                    <th className="text-right pb-2 font-medium">Weighted</th>
                    <th className="text-right pb-2 font-medium">Avg Days</th>
                    <th className="text-right pb-2 font-medium">Conv. Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-charcoal-50">
                  {pipelineReport.stageReports.map(sr => (
                    <tr key={sr.stage.id} className="text-charcoal-700">
                      <td className="py-2.5 flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: sr.stage.color }}
                        />
                        {sr.stage.name}
                      </td>
                      <td className="py-2.5 text-right">{sr.dealCount}</td>
                      <td className="py-2.5 text-right">${(sr.totalValue / 1000).toFixed(0)}K</td>
                      <td className="py-2.5 text-right">${(sr.weightedValue / 1000).toFixed(0)}K</td>
                      <td className="py-2.5 text-right">{sr.avgDaysInStage}d</td>
                      <td className="py-2.5 text-right">
                        <span className={`font-medium ${sr.conversionRate >= 50 ? 'text-green-600' : 'text-charcoal-500'}`}>
                          {sr.conversionRate}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </DashboardLayout>
  )
}
