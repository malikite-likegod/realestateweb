import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { DashboardLayout } from '@/components/dashboard'
import { PageHeader } from '@/components/layout'
import { BudgetManager } from '@/components/budget'

export default async function BudgetPage() {
  const session = await getSession()
  if (!session) redirect('/admin/login')

  return (
    <DashboardLayout user={session}>
      <PageHeader
        title="Budget"
        subtitle="Track income, expenses, and net worth"
        breadcrumbs={[
          { label: 'Dashboard', href: '/admin/dashboard' },
          { label: 'Budget' },
        ]}
      />
      <BudgetManager />
    </DashboardLayout>
  )
}
