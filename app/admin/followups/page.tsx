import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { getFollowUpRules } from '@/lib/followups/rule-service'
import { previewOverdueContacts } from '@/lib/followups/analyzer-service'
import { DashboardLayout } from '@/components/dashboard'
import { PageHeader } from '@/components/layout'
import { FollowUpsManager } from '@/components/crm/FollowUpsManager'

export default async function FollowUpsPage() {
  const session = await getSession()
  if (!session) redirect('/admin/login')

  const [rules, overdue] = await Promise.all([
    getFollowUpRules(),
    previewOverdueContacts(),
  ])

  return (
    <DashboardLayout user={session}>
      <PageHeader
        title="Follow-Ups"
        subtitle="Contacts overdue for a touch, by segment cadence, with configurable rules"
        breadcrumbs={[{ label: 'Dashboard', href: '/admin/dashboard' }, { label: 'Follow-Ups' }]}
      />
      <FollowUpsManager initialRules={rules} initialOverdue={overdue} />
    </DashboardLayout>
  )
}
