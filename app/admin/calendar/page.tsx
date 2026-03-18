import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { DashboardLayout } from '@/components/dashboard'
import { PageHeader } from '@/components/layout'
import { CalendarView } from '@/components/calendar'

export const metadata = { title: 'Calendar' }

export default async function CalendarPage() {
  const session = await getSession()
  if (!session) redirect('/admin/login')

  return (
    <DashboardLayout user={session}>
      <PageHeader
        title="Calendar"
        subtitle="Tasks, showings, and client birthdays"
        breadcrumbs={[{ label: 'Dashboard', href: '/admin/dashboard' }, { label: 'Calendar' }]}
      />
      <CalendarView />
    </DashboardLayout>
  )
}
