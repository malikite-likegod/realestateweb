import { notFound } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getContactTimeline } from '@/lib/communications/timeline-service'
import { DashboardLayout } from '@/components/dashboard'
import { PageHeader } from '@/components/layout'
import { Card } from '@/components/layout'
import {
  ActivityTimeline, NotesPanel, TaskList,
  CallLogger, SmsThread, EmailComposer, UnifiedTimeline,
} from '@/components/crm'
import { Avatar, Badge, Tabs } from '@/components/ui'
import { formatDate } from '@/lib/utils'
import { Phone, Mail, MapPin, TrendingUp, Cake } from 'lucide-react'
import type { ActivityFeedItem } from '@/types'

interface Props { params: Promise<{ id: string }> }

export default async function ContactDetailPage({ params }: Props) {
  const session = await getSession()
  if (!session) return null

  const { id } = await params

  // Fetch contact with all relations in parallel
  const [contact, timeline] = await Promise.all([
    prisma.contact.findUnique({
      where: { id },
      include: {
        tags:     { include: { tag: true } },
        activities: {
          orderBy: { occurredAt: 'desc' },
          take:    30,
          include: { user: { select: { name: true } } },
        },
        tasks: {
          orderBy: { createdAt: 'desc' },
          include: { assignee: { select: { name: true } } },
        },
        notesList: {
          orderBy: { createdAt: 'desc' },
          include: { user: { select: { name: true } } },
        },
        callLogs: {
          orderBy: { occurredAt: 'desc' },
          take:    30,
          include: { loggedBy: { select: { name: true } } },
        },
        smsMessages: {
          orderBy: { sentAt: 'asc' },
          take:    100,
          include: { sentBy: { select: { name: true } } },
        },
        emailMessages: {
          orderBy: { sentAt: 'desc' },
          take:    30,
          include: {
            template: { select: { name: true } },
            sentBy:   { select: { name: true } },
          },
        },
      },
    }),
    getContactTimeline(id, { limit: 60 }),
  ])

  if (!contact) notFound()

  const activities: ActivityFeedItem[] = contact.activities.map(a => ({
    id: a.id,
    type: a.type as ActivityFeedItem['type'],
    subject: a.subject,
    body: a.body,
    contact: null,
    user: a.user,
    occurredAt: a.occurredAt,
  }))

  const statusVariants: Record<string, 'default' | 'info' | 'success' | 'gold'> = {
    lead: 'info', prospect: 'gold', client: 'success', past_client: 'default',
  }

  return (
    <DashboardLayout user={session}>
      <PageHeader
        title={`${contact.firstName} ${contact.lastName}`}
        breadcrumbs={[
          { label: 'Dashboard', href: '/admin/dashboard' },
          { label: 'Contacts',  href: '/admin/contacts' },
          { label: `${contact.firstName} ${contact.lastName}` },
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Left sidebar: contact card ─────────────────────────────── */}
        <Card>
          <div className="flex flex-col items-center text-center gap-3 mb-6">
            <Avatar name={`${contact.firstName} ${contact.lastName}`} size="xl" />
            <div>
              <p className="font-semibold text-charcoal-900 text-lg">{contact.firstName} {contact.lastName}</p>
              {contact.company && <p className="text-sm text-charcoal-400">{contact.company}</p>}
            </div>
            <Badge variant={statusVariants[contact.status] ?? 'default'} className="capitalize">
              {contact.status.replace('_', ' ')}
            </Badge>
          </div>

          <div className="flex flex-col gap-3 border-t border-charcoal-100 pt-4">
            {contact.email && (
              <a href={`mailto:${contact.email}`} className="flex items-center gap-2 text-sm text-charcoal-600 hover:text-gold-600">
                <Mail size={14} />{contact.email}
              </a>
            )}
            {contact.phone && (
              <a href={`tel:${contact.phone}`} className="flex items-center gap-2 text-sm text-charcoal-600 hover:text-gold-600">
                <Phone size={14} />{contact.phone}
              </a>
            )}
            {contact.city && (
              <span className="flex items-center gap-2 text-sm text-charcoal-500">
                <MapPin size={14} />{contact.city}, {contact.province}
              </span>
            )}
            {contact.birthday && (
              <span className="flex items-center gap-2 text-sm text-charcoal-500">
                <Cake size={14} />{formatDate(contact.birthday, { month: 'long', day: 'numeric', year: 'numeric' })}
              </span>
            )}
            <span className="flex items-center gap-2 text-sm text-charcoal-500">
              <TrendingUp size={14} />Lead Score: <strong className="text-charcoal-900">{contact.leadScore}</strong>
            </span>
          </div>

          {/* Tags */}
          {contact.tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5 border-t border-charcoal-100 pt-3">
              {contact.tags.map(({ tag }) => (
                <span key={tag.id} style={{ backgroundColor: tag.color + '22', color: tag.color }}
                  className="rounded-full px-2 py-0.5 text-xs font-medium">
                  {tag.name}
                </span>
              ))}
            </div>
          )}

          <div className="mt-4 text-xs text-charcoal-400 border-t border-charcoal-100 pt-3">
            <p>Source: {contact.source ?? '—'}</p>
            <p>Added: {formatDate(contact.createdAt, { month: 'short', day: 'numeric', year: 'numeric' })}</p>
          </div>
        </Card>

        {/* ── Main content: tabbed communication hub ─────────────────── */}
        <div className="lg:col-span-2">
          <Tabs tabs={[
            {
              id:      'timeline',
              label:   'Timeline',
              content: <UnifiedTimeline entries={timeline} />,
            },
            {
              id:      'sms',
              label:   `SMS (${contact.smsMessages.length})`,
              content: (
                <SmsThread
                  initialMessages={contact.smsMessages.map(m => ({
                    ...m,
                    direction: m.direction as 'inbound' | 'outbound',
                  }))}
                  contactId={id}
                  contactPhone={contact.phone}
                />
              ),
            },
            {
              id:      'email',
              label:   `Email (${contact.emailMessages.length})`,
              content: (
                <EmailComposer
                  emails={contact.emailMessages.map(e => ({
                    ...e,
                    direction: e.direction as 'inbound' | 'outbound',
                  }))}
                  contactId={id}
                  contactEmail={contact.email}
                />
              ),
            },
            {
              id:      'calls',
              label:   `Calls (${contact.callLogs.length})`,
              content: (
                <CallLogger
                  calls={contact.callLogs.map(c => ({
                    ...c,
                    direction:  c.direction as 'inbound' | 'outbound',
                    status:     c.status    as 'completed' | 'missed' | 'voicemail' | 'failed',
                  }))}
                  contactId={id}
                />
              ),
            },
            {
              id:      'activity',
              label:   'Activity Log',
              content: <ActivityTimeline activities={activities} />,
            },
            {
              id:      'tasks',
              label:   `Tasks (${contact.tasks.length})`,
              content: <TaskList tasks={contact.tasks} />,
            },
            {
              id:      'notes',
              label:   `Notes (${contact.notesList.length})`,
              content: <NotesPanel notes={contact.notesList} />,
            },
          ]} />
        </div>
      </div>
    </DashboardLayout>
  )
}
