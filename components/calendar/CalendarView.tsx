'use client'

import { useRef, useState } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin       from '@fullcalendar/daygrid'
import timeGridPlugin      from '@fullcalendar/timegrid'
import interactionPlugin   from '@fullcalendar/interaction'
import type { EventClickArg, EventDropArg } from '@fullcalendar/core'
import type { DateClickArg, EventResizeDoneArg } from '@fullcalendar/interaction'
import { Plus, Settings } from 'lucide-react'
import { Button, Modal } from '@/components/ui'
import { TaskModal }        from './TaskModal'
import { EventDetailModal } from './EventDetailModal'
import { TaskTypeManager }  from './TaskTypeManager'

interface TaskForEdit {
  id: string
  title: string
  description?: string | null
  status: string
  priority: string
  taskTypeId?: string | null
  startDatetime?: string | null
  endDatetime?: string | null
  allDay: boolean
  dueAt?: string | null
  contactId?: string | null
}

interface CalendarEvent {
  id: string
  title: string
  start: string | null
  end: string | null
  allDay: boolean
  extendedProps: {
    recordType: 'task' | 'birthday'
    taskId?: string
    status?: string
    priority?: string
    description?: string
    taskType?: string
    highlightColor?: string | null
    contactName?: string
    dealTitle?: string
    assignee?: string
  }
}

// Function-based event source — FullCalendar calls this whenever the visible
// range changes, passing startStr/endStr for the current view window.
async function fetchCalendarEvents(
  fetchInfo: { startStr: string; endStr: string },
  successCallback: (events: object[]) => void,
  failureCallback: (error: Error) => void,
) {
  try {
    const params = new URLSearchParams({ start: fetchInfo.startStr, end: fetchInfo.endStr })
    const res    = await fetch(`/api/calendar/events?${params}`)
    const json   = await res.json()
    successCallback(json.data ?? [])
  } catch (err) {
    failureCallback(err as Error)
  }
}

export function CalendarView() {
  const calRef = useRef<FullCalendar>(null)

  const [taskModalOpen,   setTaskModalOpen]   = useState(false)
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [typesModalOpen,  setTypesModalOpen]  = useState(false)

  const [selectedDate, setSelectedDate] = useState<string>('')
  const [editingTask,  setEditingTask]  = useState<TaskForEdit | null>(null)
  const [activeEvent,  setActiveEvent]  = useState<CalendarEvent | null>(null)

  function handleDateClick(info: DateClickArg) {
    setSelectedDate(info.dateStr)
    setEditingTask(null)
    setTaskModalOpen(true)
  }

  function handleEventClick(info: EventClickArg) {
    const ep = info.event.extendedProps
    setActiveEvent({
      id:    info.event.id,
      title: info.event.title,
      start: info.event.startStr,
      end:   info.event.endStr,
      allDay: info.event.allDay,
      extendedProps: ep as CalendarEvent['extendedProps'],
    })
    setDetailModalOpen(true)
  }

  async function handleEventDrop(info: EventDropArg) {
    const taskId = info.event.extendedProps?.taskId as string | undefined
    if (!taskId) { info.revert(); return }
    const res = await fetch(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        startDatetime: info.event.allDay ? null : info.event.start?.toISOString(),
        endDatetime:   info.event.allDay ? null : info.event.end?.toISOString(),
        dueAt:         info.event.start?.toISOString(),
        allDay:        info.event.allDay,
      }),
    })
    if (!res.ok) info.revert()
  }

  async function handleEventResize(info: EventResizeDoneArg) {
    const taskId = info.event.extendedProps?.taskId as string | undefined
    if (!taskId) { info.revert(); return }
    const res = await fetch(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        startDatetime: info.event.start?.toISOString(),
        endDatetime:   info.event.end?.toISOString(),
      }),
    })
    if (!res.ok) info.revert()
  }

  async function openEditTask(taskId: string) {
    const res  = await fetch(`/api/tasks/${taskId}`)
    const json = await res.json()
    if (json.data) {
      setEditingTask(json.data)
      setTaskModalOpen(true)
    }
  }

  function handleSaved() {
    calRef.current?.getApi().refetchEvents()
  }

  return (
    <>
      {/* Toolbar */}
      <div className="mb-4 flex items-center justify-end gap-2">
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<Settings size={15} />}
          onClick={() => setTypesModalOpen(true)}
        >
          Task Types
        </Button>
        <Button
          variant="primary"
          size="sm"
          leftIcon={<Plus size={15} />}
          onClick={() => { setSelectedDate(''); setEditingTask(null); setTaskModalOpen(true) }}
        >
          New Task
        </Button>
      </div>

      {/* Calendar */}
      <div className="rounded-xl border border-charcoal-100 bg-white overflow-hidden shadow-sm">
        <style>{`
          .fc { font-family: inherit; }
          .fc-toolbar-title { font-family: var(--font-serif, Georgia, serif); font-size: 1.125rem !important; }
          .fc-button-group .fc-button, .fc-toolbar .fc-button {
            background: #1f2937 !important; border-color: #1f2937 !important;
            border-radius: 0.5rem !important; font-size: 0.8125rem !important;
            padding: 0.375rem 0.75rem !important;
          }
          .fc-button:hover { background: #111827 !important; }
          .fc-button-active, .fc-button-active:hover { background: #374151 !important; }
          .fc-daygrid-event, .fc-timegrid-event { border-radius: 0.375rem !important; font-size: 0.75rem !important; border: none !important; }
          .fc-event-done { opacity: 0.5; text-decoration: line-through; }
          .fc-col-header-cell { background: #f9fafb; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
          .fc-daygrid-day-number { font-size: 0.8125rem; color: #4b5563; }
          .fc-day-today { background: #fefce8 !important; }
          .fc-scrollgrid { border-color: #f3f4f6 !important; }
          .fc-scrollgrid td, .fc-scrollgrid th { border-color: #f3f4f6 !important; }
          .fc-toolbar { padding: 1rem 1.25rem !important; }
        `}</style>
        <FullCalendar
          ref={calRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          headerToolbar={{
            left:   'prev,next today',
            center: 'title',
            right:  'dayGridMonth,timeGridWeek,timeGridDay',
          }}
          buttonText={{ month: 'Month', week: 'Week', day: 'Day', today: 'Today' }}
          height="auto"
          events={fetchCalendarEvents}
          dateClick={handleDateClick}
          eventClick={handleEventClick}
          editable={true}
          droppable={true}
          eventDrop={handleEventDrop}
          eventResizableFromStart={true}
          eventResize={handleEventResize}
          eventTimeFormat={{ hour: 'numeric', minute: '2-digit', meridiem: 'short' }}
          eventContent={(arg) => {
            const highlight = arg.event.extendedProps.highlightColor as string | null | undefined
            return (
              <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '0 2px' }}>
                {highlight ? (
                  <mark style={{ background: highlight, color: 'inherit', borderRadius: '2px', padding: '0 2px' }}>
                    {arg.event.title}
                  </mark>
                ) : (
                  <span>{arg.event.title}</span>
                )}
              </div>
            )
          }}
          dayMaxEvents={4}
          nowIndicator={true}
          fixedWeekCount={false}
        />
      </div>

      {/* Task create/edit modal */}
      <TaskModal
        open={taskModalOpen}
        onClose={() => setTaskModalOpen(false)}
        onSaved={handleSaved}
        initialDate={selectedDate}
        task={editingTask}
      />

      {/* Event detail modal */}
      <EventDetailModal
        open={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        event={activeEvent}
        onEdit={openEditTask}
      />

      {/* Task type manager modal */}
      <Modal open={typesModalOpen} onClose={() => setTypesModalOpen(false)} title="Task Types" size="sm">
        <TaskTypeManager />
      </Modal>
    </>
  )
}
