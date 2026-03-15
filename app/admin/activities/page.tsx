import { getSession } from '@/lib/auth'
import { getUserActivityFeed } from '@/lib/communications/timeline-service'
import { DashboardLayout } from '@/components/dashboard'
import { PageHeader } from '@/components/layout'
import { UnifiedTimeline } from '@/components/crm'

export default async function ActivitiesPage() {
  const session = await getSession()
  if (!session) return null

  const feed = await getUserActivityFeed(session.id, { limit: 150 })

  return (
    <DashboardLayout user={session}>
      <PageHeader
        title="My Activity"
        subtitle={`All actions logged by ${session.name}`}
        breadcrumbs={[{ label: 'Dashboard', href: '/admin/dashboard' }, { label: 'My Activity' }]}
      />
      <div className="bg-white rounded-2xl border border-charcoal-100 p-6">
        <UnifiedTimeline entries={feed} />
      </div>
    </DashboardLayout>
  )
}
