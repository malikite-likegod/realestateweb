'use client'

import { TaskCard } from './TaskCard'

interface Task {
  id: string
  title: string
  status: string
  priority: string
  dueAt: Date | null
  assignee?: { name: string } | null
  contact?: { firstName: string; lastName: string } | null
}

interface TaskListProps {
  tasks: Task[]
  onToggle?: (id: string, done: boolean) => void
}

export function TaskList({ tasks, onToggle }: TaskListProps) {
  if (tasks.length === 0) return <p className="text-sm text-charcoal-400 py-4">No tasks.</p>
  return (
    <div className="flex flex-col gap-2">
      {tasks.map(task => <TaskCard key={task.id} task={task} onToggle={onToggle} />)}
    </div>
  )
}
