import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { DashboardLayout } from '@/components/dashboard'
import { PageHeader } from '@/components/layout'
import { prisma } from '@/lib/prisma'
import { Tabs } from '@/components/ui'
import { BookingsManager } from './BookingsManager'
import { AvailabilityForm } from './AvailabilityForm'

export const metadata = { title: 'Bookings' }

export default async function BookingsPage() {
  const session = await getSession()
  if (!session) redirect('/admin/login')

  const [schedule, bookings] = await Promise.all([
    prisma.availabilitySchedule.findFirst(),
    prisma.bookingEvent.findMany({
      include: { schedule: { select: { meetingTitle: true } } },
      orderBy: { startAt: 'desc' },
      take: 100,
    }),
  ])

  // Parse windows JSON for the form
  const scheduleForForm = schedule
    ? {
        ...schedule,
        agentTitle:         schedule.agentTitle         ?? '',
        agentEmail:         schedule.agentEmail         ?? '',
        agentPhone:         schedule.agentPhone         ?? '',
        agentPhoto:         schedule.agentPhoto         ?? '',
        meetingDescription: schedule.meetingDescription ?? '',
        windows: (() => {
          try { return JSON.parse(schedule.windows) } catch (e) { console.warn('[bookings] Invalid windows JSON:', e); return [] }
        })(),
      }
    : null

  return (
    <DashboardLayout user={session}>
      <PageHeader
        title="Bookings"
        subtitle={`${bookings.length} booking${bookings.length !== 1 ? 's' : ''}`}
        breadcrumbs={[{ label: 'Dashboard', href: '/admin/dashboard' }, { label: 'Bookings' }]}
      />
      <Tabs tabs={[
        { id: 'bookings',     label: `Upcoming (${bookings.filter(b => b.status === 'confirmed').length})`, content: <BookingsManager initialBookings={bookings} /> },
        { id: 'availability', label: 'Availability Settings', content: <AvailabilityForm initial={scheduleForForm} /> },
      ]} />
    </DashboardLayout>
  )
}
