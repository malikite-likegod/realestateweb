import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { DashboardLayout } from '@/components/dashboard'
import { StatsCard } from '@/components/analytics'
import { RecentLeadsWidget, TasksWidget, RecentActivitiesWidget } from '@/components/dashboard'
import { Users, Briefcase, Building2, CheckSquare } from 'lucide-react'
import type { ContactWithTags } from '@/types'
import type { ActivityFeedItem } from '@/types'

export default async function DashboardPage() {
  const session = await getSession()
  if (!session) return null

  const [contactCount, dealCount, listingCount, taskCount, recentContacts, recentTasks, recentActivities] = await Promise.all([
    prisma.contact.count(),
    prisma.deal.count(),
    prisma.property.count({ where: { status: 'active' } }),
    prisma.task.count({ where: { status: { not: 'done' } } }),
    prisma.contact.findMany({
      orderBy: { createdAt: 'desc' },
      take: 8,
      include: { tags: { include: { tag: true } } },
    }),
    prisma.task.findMany({
      where: { status: { not: 'done' } },
      orderBy: [{ dueAt: 'asc' }, { createdAt: 'desc' }],
      take: 5,
      include: { assignee: { select: { name: true } }, contact: { select: { firstName: true, lastName: true } } },
    }),
    prisma.activity.findMany({
      orderBy: { occurredAt: 'desc' },
      take: 10,
      include: { contact: { select: { firstName: true, lastName: true } }, user: { select: { name: true } } },
    }),
  ])

  const leads = recentContacts as ContactWithTags[]

  const activities: ActivityFeedItem[] = recentActivities.map(a => ({
    id: a.id,
    type: a.type as ActivityFeedItem['type'],
    subject: a.subject,
    body: a.body,
    contact: a.contact,
    user: a.user,
    occurredAt: a.occurredAt,
  }))

  return (
    <DashboardLayout user={session}>
      <div className="flex flex-col gap-6">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard title="Total Contacts" value={contactCount} icon={<Users size={20} />} change={12} />
          <StatsCard title="Active Deals" value={dealCount} icon={<Briefcase size={20} />} change={5} />
          <StatsCard title="Active Listings" value={listingCount} icon={<Building2 size={20} />} change={-2} />
          <StatsCard title="Open Tasks" value={taskCount} icon={<CheckSquare size={20} />} />
        </div>

        {/* Widgets */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <RecentLeadsWidget leads={leads} />
          </div>
          <div className="lg:col-span-1">
            <TasksWidget tasks={recentTasks} />
          </div>
          <div className="lg:col-span-1">
            <RecentActivitiesWidget activities={activities} />
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
