import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getPipelineReport } from '@/lib/pipeline/pipeline-service'
import { DashboardLayout } from '@/components/dashboard'
import { StatsCard } from '@/components/analytics'
import {
  RecentLeadsWidget,
  TasksWidget,
  TodayCalendarWidget,
  CommunicationsWidget,
  PipelineSummaryWidget,
  RecentPortalLoginsWidget,
} from '@/components/dashboard'
import { Users, Briefcase, Building2, CheckSquare } from 'lucide-react'
import type { ContactWithTags } from '@/types'

export default async function DashboardPage() {
  const session = await getSession()
  if (!session) redirect('/admin/login')

  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)

  // Resolve agent MLS name before the main query so we can filter RESO listings
  const agentMlsNameRow = await prisma.siteSettings.findUnique({ where: { key: 'listing_agent_mls_name' } })
  const agentMlsName = agentMlsNameRow?.value?.trim() || null

  const [
    contactCount,
    dealCount,
    manualListingCount,
    resoListingCount,
    taskCount,
    recentContacts,
    recentTasks,
    pipelineReport,
    inboundSms,
    missedCalls,
    inboundEmails,
    recentPortalLogins,
  ] = await Promise.all([
    prisma.contact.count(),
    prisma.deal.count(),
    prisma.property.count({ where: { status: 'active' } }),
    agentMlsName
      ? prisma.resoProperty.count({
          where: {
            standardStatus: 'Active',
            OR: [
              { listAgentFullName: { contains: agentMlsName, mode: 'insensitive' } },
              { listAgentName:     { contains: agentMlsName, mode: 'insensitive' } },
            ],
          },
        })
      : Promise.resolve(0),
    prisma.task.count({ where: { status: { not: 'done' } } }),
    prisma.contact.findMany({
      orderBy: { createdAt: 'desc' },
      take: 8,
      include: {
        tags:   { include: { tag: true } },
        phones: { orderBy: { createdAt: 'asc' } },
      },
    }),
    prisma.task.findMany({
      where: { status: { not: 'done' } },
      orderBy: [{ dueAt: 'asc' }, { createdAt: 'desc' }],
      take: 5,
      include: {
        assignee: { select: { name: true } },
        contact:  { select: { firstName: true, lastName: true } },
      },
    }),
    getPipelineReport(),
    prisma.smsMessage.findMany({
      where: { direction: 'inbound' },
      orderBy: { sentAt: 'desc' },
      take: 5,
      include: { contact: { select: { id: true, firstName: true, lastName: true } } },
    }),
    prisma.callLog.findMany({
      where: { status: 'missed' },
      orderBy: { occurredAt: 'desc' },
      take: 5,
      include: { contact: { select: { id: true, firstName: true, lastName: true } } },
    }),
    prisma.emailMessage.findMany({
      where: { direction: 'inbound' },
      orderBy: { sentAt: 'desc' },
      take: 5,
      include: { contact: { select: { id: true, firstName: true, lastName: true } } },
    }),
    prisma.securityAuditLog.findMany({
      where: {
        event:     'portal_login_success',
        createdAt: { gte: threeDaysAgo },
        contactId: { not: null },
      },
      distinct:  ['contactId'],
      orderBy:   { createdAt: 'desc' },
      take:      10,
      include: {
        contact: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    }),
  ])

  const listingCount = manualListingCount + resoListingCount

  const leads = recentContacts as ContactWithTags[]

  const portalLogins = recentPortalLogins.map(l => ({
    contactId:   l.contactId!,
    lastLoginAt: l.createdAt,
    contact:     l.contact,
  }))

  // Build inbox items sorted newest-first, capped at 8
  type InboxItem = {
    id:          string
    channel:     'sms' | 'call' | 'email'
    contactName: string
    contactId:   string | null
    preview:     string
    occurredAt:  Date | string
  }

  const inboxItems: InboxItem[] = [
    ...inboundSms.map(m => ({
      id:          m.id,
      channel:     'sms' as const,
      contactName: m.contact ? `${m.contact.firstName} ${m.contact.lastName}`.trim() : (m.fromNumber ?? 'Unknown'),
      contactId:   m.contactId,
      preview:     m.body.slice(0, 80),
      occurredAt:  m.sentAt,
    })),
    ...missedCalls.map(c => ({
      id:          c.id,
      channel:     'call' as const,
      contactName: c.contact ? `${c.contact.firstName} ${c.contact.lastName}`.trim() : 'Unknown',
      contactId:   c.contactId,
      preview:     'Missed call',
      occurredAt:  c.occurredAt,
    })),
    ...inboundEmails.map(e => ({
      id:          e.id,
      channel:     'email' as const,
      contactName: e.contact ? `${e.contact.firstName} ${e.contact.lastName}`.trim() : (e.fromEmail ?? 'Unknown'),
      contactId:   e.contactId,
      preview:     e.subject,
      occurredAt:  e.sentAt,
    })),
  ]
    .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
    .slice(0, 8)

  return (
    <DashboardLayout user={session}>
      <div className="flex flex-col gap-6">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard title="Total Contacts"  value={contactCount}  icon={<Users      size={20} />} change={12} />
          <StatsCard title="Active Deals"    value={dealCount}     icon={<Briefcase  size={20} />} change={5}  />
          <StatsCard title="Active Listings" value={listingCount}  icon={<Building2  size={20} />} change={-2} />
          <StatsCard title="Open Tasks"      value={taskCount}     icon={<CheckSquare size={20} />} />
        </div>

        {/* Top row widgets */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <RecentLeadsWidget leads={leads} />
          </div>
          <div className="lg:col-span-1">
            <TasksWidget tasks={recentTasks} />
          </div>
          <div className="lg:col-span-1">
            <TodayCalendarWidget />
          </div>
        </div>

        {/* Bottom row widgets */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <CommunicationsWidget items={inboxItems} />
          <PipelineSummaryWidget report={pipelineReport} />
          <RecentPortalLoginsWidget logins={portalLogins} />
        </div>
      </div>
    </DashboardLayout>
  )
}
