import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { DashboardLayout } from '@/components/dashboard'
import { PageHeader } from '@/components/layout'
import { ActivityTimeline } from '@/components/crm'
import type { ActivityFeedItem } from '@/types'

export default async function ActivitiesPage() {
  const session = await getSession()
  if (!session) return null

  const activities = await prisma.activity.findMany({
    orderBy: { occurredAt: 'desc' },
    take: 50,
    include: {
      contact: { select: { firstName: true, lastName: true } },
      user:    { select: { name: true } },
    },
  })

  const items: ActivityFeedItem[] = activities.map(a => ({
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
      <PageHeader
        title="Activity Timeline"
        subtitle="All CRM activities"
        breadcrumbs={[{ label: 'Dashboard', href: '/admin/dashboard' }, { label: 'Activities' }]}
      />
      <div className="bg-white rounded-2xl border border-charcoal-100 p-6">
        <ActivityTimeline activities={items} />
      </div>
    </DashboardLayout>
  )
}
