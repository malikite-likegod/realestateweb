'use client'

import { Modal, Button, Badge } from '@/components/ui'
import { CalendarDays, User, Tag, CheckSquare, Briefcase, Mail, Phone } from 'lucide-react'

interface EventDetail {
  id: string
  title: string
  start: string | null
  end: string | null
  allDay: boolean
  extendedProps: {
    recordType: 'task' | 'birthday' | 'booking'
    taskId?: string
    bookingId?: string
    status?: string
    priority?: string
    description?: string
    taskType?: string
    contactName?: string
    dealTitle?: string
    assignee?: string
    guestName?: string
    guestEmail?: string
    guestPhone?: string
  }
}

interface EventDetailModalProps {
  open: boolean
  onClose: () => void
  event: EventDetail | null
  onEdit: (taskId: string) => void
}

const priorityVariants: Record<string, 'default' | 'warning' | 'danger' | 'info'> = {
  low: 'default', normal: 'info', high: 'warning', urgent: 'danger',
}

const statusVariants: Record<string, 'default' | 'success' | 'warning' | 'danger'> = {
  todo: 'default', in_progress: 'warning', done: 'success', cancelled: 'danger',
}

function fmt(iso: string | null, allDay: boolean) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (allDay) return d.toLocaleDateString('en-CA', { weekday: 'short', month: 'long', day: 'numeric' })
  return d.toLocaleString('en-CA', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export function EventDetailModal({ open, onClose, event, onEdit }: EventDetailModalProps) {
  if (!event) return null
  const { extendedProps: ep } = event
  const isBirthday = ep.recordType === 'birthday'
  const isBooking  = ep.recordType === 'booking'

  if (isBooking) {
    return (
      <Modal open={open} onClose={onClose} title="Booking" size="sm">
        <div className="space-y-4">
          <h3 className="text-base font-semibold text-charcoal-900">{ep.guestName}</h3>
          <div className="space-y-2 text-sm text-charcoal-600">
            <div className="flex items-center gap-2">
              <CalendarDays size={14} className="shrink-0 text-charcoal-400" />
              <span>{fmt(event.start, false)}</span>
              {event.end && <span className="text-charcoal-400">→ {fmt(event.end, false)}</span>}
            </div>
            {ep.guestEmail && (
              <div className="flex items-center gap-2">
                <Mail size={14} className="shrink-0 text-charcoal-400" />
                <span>{ep.guestEmail}</span>
              </div>
            )}
            {ep.guestPhone && (
              <div className="flex items-center gap-2">
                <Phone size={14} className="shrink-0 text-charcoal-400" />
                <span>{ep.guestPhone}</span>
              </div>
            )}
            {ep.description && <p className="mt-2 text-charcoal-500">{ep.description}</p>}
          </div>
          <div className="flex justify-end pt-2">
            <Button variant="ghost" onClick={onClose}>Close</Button>
          </div>
        </div>
      </Modal>
    )
  }

  return (
    <Modal open={open} onClose={onClose} title={isBirthday ? 'Client Birthday' : 'Task Details'} size="sm">
      <div className="space-y-4">
        <h3 className="text-base font-semibold text-charcoal-900">{event.title}</h3>

        {!isBirthday && (
          <div className="flex flex-wrap gap-2">
            {ep.taskType && (
              <Badge variant="default" className="flex items-center gap-1">
                <Tag size={11} /> {ep.taskType}
              </Badge>
            )}
            {ep.status && (
              <Badge variant={statusVariants[ep.status] ?? 'default'} className="capitalize">
                {ep.status.replace('_', ' ')}
              </Badge>
            )}
            {ep.priority && (
              <Badge variant={priorityVariants[ep.priority] ?? 'default'} className="capitalize">
                {ep.priority}
              </Badge>
            )}
          </div>
        )}

        <div className="space-y-2 text-sm text-charcoal-600">
          <div className="flex items-center gap-2">
            <CalendarDays size={14} className="shrink-0 text-charcoal-400" />
            <span>{fmt(event.start, event.allDay)}</span>
            {event.end && event.end !== event.start && (
              <span className="text-charcoal-400">→ {fmt(event.end, event.allDay)}</span>
            )}
          </div>

          {ep.contactName && (
            <div className="flex items-center gap-2">
              <User size={14} className="shrink-0 text-charcoal-400" />
              <span>{ep.contactName}</span>
            </div>
          )}

          {ep.dealTitle && (
            <div className="flex items-center gap-2">
              <Briefcase size={14} className="shrink-0 text-charcoal-400" />
              <span>{ep.dealTitle}</span>
            </div>
          )}

          {ep.assignee && (
            <div className="flex items-center gap-2">
              <CheckSquare size={14} className="shrink-0 text-charcoal-400" />
              <span>Assigned to {ep.assignee}</span>
            </div>
          )}

          {ep.description && (
            <p className="mt-2 text-charcoal-500 whitespace-pre-wrap">{ep.description}</p>
          )}
        </div>

        {!isBirthday && ep.taskId && (
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={onClose}>Close</Button>
            <Button variant="primary" onClick={() => { onClose(); onEdit(ep.taskId!) }}>
              Edit Task
            </Button>
          </div>
        )}
      </div>
    </Modal>
  )
}
