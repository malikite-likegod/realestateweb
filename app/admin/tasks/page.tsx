import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { DashboardLayout } from '@/components/dashboard'
import { PageHeader } from '@/components/layout'
import { TaskList } from '@/components/crm'
import { Button } from '@/components/ui'
import { Plus } from 'lucide-react'

export default async function TasksPage() {
  const session = await getSession()
  if (!session) return null

  const tasks = await prisma.task.findMany({
    where: { status: { not: 'done' } },
    orderBy: [{ dueAt: 'asc' }, { priority: 'asc' }],
    include: {
      assignee: { select: { name: true } },
      contact:  { select: { firstName: true, lastName: true } },
    },
  })

  return (
    <DashboardLayout user={session}>
      <PageHeader
        title="Tasks"
        subtitle={`${tasks.length} open tasks`}
        breadcrumbs={[{ label: 'Dashboard', href: '/admin/dashboard' }, { label: 'Tasks' }]}
        actions={<Button variant="primary" leftIcon={<Plus size={16} />}>New Task</Button>}
      />
      <TaskList tasks={tasks} />
    </DashboardLayout>
  )
}
