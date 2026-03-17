'use client'

/**
 * TasksManager
 *
 * Client component for the /admin/tasks page.
 * - Toggle between Pending and Completed views
 * - Filter by time period (Today / This Week / This Month / All)
 * - Mark tasks complete / undo complete inline with optimistic updates
 * - Create new tasks via TaskModal
 */

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { CheckSquare, Square, Clock, User, Plus, RotateCcw } from 'lucide-react'
import { Button, Badge } from '@/components/ui'
import { TaskModal } from '@/components/calendar'
import { cn, formatDate } from '@/lib/utils'
import { useToast } from '@/components/ui'

// ── Types ─────────────────────────────────────────────────────────────────────

type Task = {
  id:          string
  title:       string
  description: string | null
  status:      string
  priority:    string
  dueAt:       Date | string | null
  completedAt: Date | string | null
  taskTypeId:  string | null
  assignee:    { name: string } | null
  contact:     { firstName: string; lastName: string } | null
}

type Period = 'today' | 'week' | 'month' | 'all'
type View   = 'pending' | 'completed'

interface Props {
  initialPending:   Task[]
  initialCompleted: Task[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const priorityVariants: Record<string, 'default' | 'warning' | 'danger' | 'info'> = {
  low: 'default', normal: 'info', high: 'warning', urgent: 'danger',
}

function startOf(period: Period): Date | null {
  const now = new Date()
  if (period === 'today') {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate())
  }
  if (period === 'week') {
    const d = new Date(now)
    d.setDate(d.getDate() - d.getDay())
    d.setHours(0, 0, 0, 0)
    return d
  }
  if (period === 'month') {
    return new Date(now.getFullYear(), now.getMonth(), 1)
  }
  return null // 'all'
}

function filterByPeriod(tasks: Task[], period: Period, dateKey: 'dueAt' | 'completedAt'): Task[] {
  const from = startOf(period)
  if (!from) return tasks
  return tasks.filter(t => {
    const val = t[dateKey]
    // Pending tasks with no due date have no deadline, so always include them.
    // Completed tasks with no completedAt are excluded from period views.
    if (!val) return dateKey === 'dueAt'
    return new Date(val) >= from
  })
}

const PERIOD_LABELS: Record<Period, string> = {
  today: 'Today',
  week:  'This Week',
  month: 'This Month',
  all:   'All Time',
}

// ── TaskRow ───────────────────────────────────────────────────────────────────

function TaskRow({
  task,
  onToggle,
  toggling,
}: {
  task:     Task
  onToggle: (id: string, markDone: boolean) => void
  toggling: string | null
}) {
  const done    = task.status === 'done'
  const overdue = task.dueAt && new Date(task.dueAt) < new Date() && !done
  const busy    = toggling === task.id

  return (
    <div className={cn(
      'flex items-start gap-3 rounded-xl border bg-white p-4 transition-all',
      done ? 'border-charcoal-100 opacity-70' : 'border-charcoal-200',
    )}>
      {/* Checkbox */}
      <button
        onClick={() => onToggle(task.id, !done)}
        disabled={busy}
        className={cn(
          'mt-0.5 shrink-0 transition-colors',
          busy ? 'opacity-40 cursor-wait' : 'text-charcoal-400 hover:text-emerald-600',
        )}
        title={done ? 'Mark as pending' : 'Mark as complete'}
      >
        {done
          ? <CheckSquare size={18} className="text-emerald-500" />
          : <Square size={18} />
        }
      </button>

      {/* Body */}
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm font-medium text-charcoal-900', done && 'line-through text-charcoal-400')}>
          {task.title}
        </p>
        {task.description && (
          <p className="text-xs text-charcoal-400 mt-0.5 truncate">{task.description}</p>
        )}
        <div className="flex flex-wrap items-center gap-2 mt-1.5">
          <Badge variant={priorityVariants[task.priority] ?? 'default'} className="capitalize text-xs">
            {task.priority}
          </Badge>
          {task.dueAt && !done && (
            <span className={cn('flex items-center gap-1 text-xs', overdue ? 'text-red-500 font-medium' : 'text-charcoal-400')}>
              <Clock size={11} />
              Due {formatDate(new Date(task.dueAt), { month: 'short', day: 'numeric' })}
              {overdue && ' · Overdue'}
            </span>
          )}
          {task.completedAt && done && (
            <span className="flex items-center gap-1 text-xs text-charcoal-400">
              <CheckSquare size={11} />
              Completed {formatDate(new Date(task.completedAt), { month: 'short', day: 'numeric' })}
            </span>
          )}
          {task.contact && (
            <span className="flex items-center gap-1 text-xs text-charcoal-400">
              <User size={11} />
              {task.contact.firstName} {task.contact.lastName}
            </span>
          )}
          {task.assignee && (
            <span className="text-xs text-charcoal-400">· {task.assignee.name}</span>
          )}
        </div>
      </div>

      {/* Undo button for completed tasks */}
      {done && (
        <button
          onClick={() => onToggle(task.id, false)}
          disabled={busy}
          className="shrink-0 flex items-center gap-1 text-xs text-charcoal-400 hover:text-charcoal-700 transition-colors disabled:opacity-40"
          title="Mark as pending"
        >
          <RotateCcw size={13} /> Undo
        </button>
      )}
    </div>
  )
}

// ── TasksManager ──────────────────────────────────────────────────────────────

export function TasksManager({ initialPending, initialCompleted }: Props) {
  const { toast }  = useToast()
  const router     = useRouter()

  const [pending,   setPending]   = useState<Task[]>(initialPending)
  const [completed, setCompleted] = useState<Task[]>(initialCompleted)
  const [view,      setView]      = useState<View>('pending')
  const [period,    setPeriod]    = useState<Period>('all')
  const [toggling,  setToggling]  = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  // ── Mark complete / undo ─────────────────────────────────────────────────────

  async function handleToggle(id: string, markDone: boolean) {
    setToggling(id)

    // Capture the original task snapshot BEFORE any state mutation so the
    // catch rollback always has a valid reference regardless of closure timing.
    const originalTask = markDone
      ? pending.find(t => t.id === id)
      : completed.find(t => t.id === id)

    if (!originalTask) { setToggling(null); return }

    // Optimistic update
    if (markDone) {
      setPending(prev  => prev.filter(t => t.id !== id))
      setCompleted(prev => [{ ...originalTask, status: 'done', completedAt: new Date().toISOString() }, ...prev])
    } else {
      setCompleted(prev => prev.filter(t => t.id !== id))
      setPending(prev   => [{ ...originalTask, status: 'todo', completedAt: null }, ...prev])
    }

    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ status: markDone ? 'done' : 'todo' }),
      })
      if (!res.ok) throw new Error()
      toast('success', markDone ? 'Task completed' : 'Task reopened')
    } catch {
      // Revert the optimistic update using the captured snapshot
      toast('error', 'Failed to update task')
      if (markDone) {
        // Was completing — move back to pending
        setCompleted(prev => prev.filter(t => t.id !== id))
        setPending(prev   => [{ ...originalTask, status: originalTask.status }, ...prev])
      } else {
        // Was undoing — move back to completed (restore original completedAt)
        setPending(prev   => prev.filter(t => t.id !== id))
        setCompleted(prev => [{ ...originalTask, status: 'done', completedAt: originalTask.completedAt }, ...prev])
      }
    } finally {
      setToggling(null)
    }
  }

  // ── Filtered lists ────────────────────────────────────────────────────────────

  const visibleTasks = useMemo(() => {
    if (view === 'pending') {
      return filterByPeriod(pending, period, 'dueAt')
    }
    return filterByPeriod(completed, period, 'completedAt')
  }, [view, period, pending, completed])

  const overdueCount = useMemo(
    () => pending.filter(t => t.dueAt && new Date(t.dueAt) < new Date()).length,
    [pending],
  )

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <>
      {/* View toggle + period filter + new task button */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        {/* Pending / Completed toggle */}
        <div className="flex rounded-lg border border-charcoal-200 bg-white overflow-hidden text-sm font-medium">
          {(['pending', 'completed'] as View[]).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                'px-4 py-2 transition-colors capitalize',
                view === v
                  ? 'bg-charcoal-900 text-white'
                  : 'text-charcoal-600 hover:bg-charcoal-50',
              )}
            >
              {v === 'pending' ? `Pending (${pending.length})` : `Completed (${completed.length})`}
            </button>
          ))}
        </div>

        {/* Period filter */}
        <div className="flex rounded-lg border border-charcoal-200 bg-white overflow-hidden text-sm">
          {(Object.keys(PERIOD_LABELS) as Period[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                'px-3 py-2 transition-colors',
                period === p
                  ? 'bg-charcoal-100 text-charcoal-900 font-medium'
                  : 'text-charcoal-500 hover:bg-charcoal-50',
              )}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>

        {/* Spacer + New Task */}
        <div className="ml-auto">
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Plus size={15} />}
            onClick={() => setModalOpen(true)}
          >
            New Task
          </Button>
        </div>
      </div>

      {/* Overdue notice */}
      {view === 'pending' && overdueCount > 0 && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
          <Clock size={15} className="shrink-0" />
          <span><strong>{overdueCount}</strong> overdue task{overdueCount !== 1 ? 's' : ''}</span>
        </div>
      )}

      {/* Task list */}
      {visibleTasks.length === 0 ? (
        <div className="py-16 text-center text-charcoal-400">
          <CheckSquare size={36} className="mx-auto mb-3 opacity-25" />
          <p className="text-sm">
            {view === 'pending'
              ? period === 'all' ? 'No pending tasks.' : `No pending tasks for ${PERIOD_LABELS[period].toLowerCase()}.`
              : period === 'all' ? 'No completed tasks yet.' : `No tasks completed ${PERIOD_LABELS[period].toLowerCase()}.`
            }
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {visibleTasks.map(task => (
            <TaskRow
              key={task.id}
              task={task}
              onToggle={handleToggle}
              toggling={toggling}
            />
          ))}
        </div>
      )}

      {/* New task modal */}
      <TaskModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={() => { setModalOpen(false); router.refresh() }}
      />
    </>
  )
}
