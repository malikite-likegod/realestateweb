'use client'

import { CheckSquare, Square, Clock, User } from 'lucide-react'
import { Badge } from '@/components/ui'
import { cn, formatDate } from '@/lib/utils'

const priorityVariants: Record<string, 'default' | 'warning' | 'danger' | 'info'> = {
  low: 'default', normal: 'info', high: 'warning', urgent: 'danger',
}

interface Task {
  id: string
  title: string
  status: string
  priority: string
  dueAt: Date | null
  assignee?: { name: string } | null
  contact?: { firstName: string; lastName: string } | null
}

interface TaskCardProps {
  task: Task
  onToggle?: (id: string, done: boolean) => void
}

export function TaskCard({ task, onToggle }: TaskCardProps) {
  const done = task.status === 'done'
  const overdue = task.dueAt && new Date(task.dueAt) < new Date() && !done

  return (
    <div className={cn(
      'flex items-start gap-3 rounded-xl border border-charcoal-100 bg-white p-4 transition-colors',
      done && 'opacity-60',
    )}>
      <button
        onClick={() => onToggle?.(task.id, !done)}
        className="mt-0.5 shrink-0 text-charcoal-400 hover:text-charcoal-700 transition-colors"
      >
        {done ? <CheckSquare size={18} className="text-emerald-500" /> : <Square size={18} />}
      </button>
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm font-medium text-charcoal-900', done && 'line-through text-charcoal-400')}>
          {task.title}
        </p>
        <div className="flex flex-wrap items-center gap-2 mt-1.5">
          <Badge variant={priorityVariants[task.priority] ?? 'default'} className="capitalize">{task.priority}</Badge>
          {task.dueAt && (
            <span className={cn('flex items-center gap-1 text-xs', overdue ? 'text-red-500' : 'text-charcoal-400')}>
              <Clock size={11} />
              {formatDate(task.dueAt, { month: 'short', day: 'numeric' })}
            </span>
          )}
          {task.assignee && (
            <span className="flex items-center gap-1 text-xs text-charcoal-400">
              <User size={11} /> {task.assignee.name}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
