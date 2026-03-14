import Link from 'next/link'
import { TaskCard } from '@/components/crm'
import { Card } from '@/components/layout'

interface Task {
  id: string
  title: string
  status: string
  priority: string
  dueAt: Date | null
  assignee?: { name: string } | null
  contact?: { firstName: string; lastName: string } | null
}

interface TasksWidgetProps {
  tasks: Task[]
}

export function TasksWidget({ tasks }: TasksWidgetProps) {
  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-charcoal-900">Upcoming Tasks</h3>
        <Link href="/admin/tasks" className="text-xs text-gold-600 hover:text-gold-700 font-medium">View all</Link>
      </div>
      <div className="flex flex-col gap-2">
        {tasks.slice(0, 5).map(task => <TaskCard key={task.id} task={task} />)}
      </div>
    </Card>
  )
}
