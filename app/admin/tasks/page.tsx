import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { DashboardLayout } from '@/components/dashboard'
import { PageHeader } from '@/components/layout'
import { TasksManager } from './TasksManager'

export const metadata = { title: 'Tasks' }

export default async function TasksPage() {
  const session = await getSession()
  if (!session) redirect('/admin/login')

  // Fetch pending tasks (all) + completed tasks from the last 90 days
  const ninetyDaysAgo = new Date()
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

  const include = {
    assignee: { select: { name: true } },
    contact:  { select: { firstName: true, lastName: true } },
  } as const

  const [pending, completed] = await Promise.all([
    prisma.task.findMany({
      where:   { status: { in: ['todo', 'in_progress'] } },
      orderBy: [{ dueAt: 'asc' }, { priority: 'asc' }],
      include,
    }),
    prisma.task.findMany({
      where:   { status: 'done', completedAt: { gte: ninetyDaysAgo } },
      orderBy: { completedAt: 'desc' },
      include,
    }),
  ])

  return (
    <DashboardLayout user={session}>
      <PageHeader
        title="Tasks"
        subtitle={`${pending.length} pending · ${completed.length} completed (last 90 days)`}
        breadcrumbs={[{ label: 'Dashboard', href: '/admin/dashboard' }, { label: 'Tasks' }]}
      />
      <TasksManager initialPending={pending} initialCompleted={completed} />
    </DashboardLayout>
  )
}
