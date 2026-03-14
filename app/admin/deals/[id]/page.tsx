/**
 * Deal Detail Page (/admin/deals/[id])
 *
 * Shows full deal info, stage history timeline, participants, tasks, and
 * activities. Agents can update the stage, value, and notes inline.
 */

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { DashboardLayout } from '@/components/dashboard'
import { PageHeader } from '@/components/layout'
import { Card } from '@/components/layout'
import { ActivityTimeline, TaskList } from '@/components/crm'
import { Avatar, Badge, Tabs } from '@/components/ui'
import { formatDate, formatPrice } from '@/lib/utils'
import {
  Briefcase, DollarSign, TrendingUp, Calendar, User,
  ArrowRight, Clock, CheckCircle,
} from 'lucide-react'
import type { ActivityFeedItem } from '@/types'

interface Props { params: Promise<{ id: string }> }

export default async function DealDetailPage({ params }: Props) {
  const session = await getSession()
  if (!session) return null

  const { id } = await params

  const deal = await prisma.deal.findUnique({
    where: { id },
    include: {
      stage:        true,
      assignee:     { select: { id: true, name: true, avatarUrl: true } },
      participants: {
        include: { contact: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } } },
      },
      property: true,
      tasks: {
        orderBy: { createdAt: 'desc' },
        include: { assignee: { select: { name: true } } },
      },
      activities: {
        orderBy: { occurredAt: 'desc' },
        take:    40,
        include: { user: { select: { name: true } } },
      },
      stageHistory: {
        orderBy: { enteredAt: 'asc' },
        include: {
          stage:   { select: { id: true, name: true, color: true } },
          movedBy: { select: { name: true } },
        },
      },
    },
  })

  if (!deal) notFound()

  const activities: ActivityFeedItem[] = deal.activities.map(a => ({
    id:         a.id,
    type:       a.type as ActivityFeedItem['type'],
    subject:    a.subject,
    body:       a.body,
    contact:    null,
    user:       a.user,
    occurredAt: a.occurredAt,
  }))

  const daysInPipeline = Math.floor(
    (Date.now() - new Date(deal.createdAt).getTime()) / 86_400_000,
  )

  const statusBadge =
    deal.closedAt ? 'success' :
    deal.probability >= 70 ? 'gold' :
    deal.probability >= 40 ? 'info' : 'default'

  return (
    <DashboardLayout user={session}>
      <PageHeader
        title={deal.title}
        subtitle={`${deal.stage.name} · ${daysInPipeline} days in pipeline`}
        breadcrumbs={[
          { label: 'Dashboard', href: '/admin/dashboard' },
          { label: 'Deals',     href: '/admin/deals' },
          { label: deal.title },
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Left sidebar ──────────────────────────────────────────────── */}
        <div className="flex flex-col gap-4">
          {/* Deal summary card */}
          <Card>
            <div className="flex items-center gap-3 mb-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-charcoal-100">
                <Briefcase size={20} className="text-charcoal-600" />
              </div>
              <div>
                <p className="font-semibold text-charcoal-900">{deal.title}</p>
                <Badge variant={statusBadge} className="capitalize mt-0.5">
                  {deal.closedAt ? 'Closed' : `${deal.probability}% probability`}
                </Badge>
              </div>
            </div>

            <div className="flex flex-col gap-3 text-sm">
              <div className="flex items-center gap-2 text-charcoal-600">
                <DollarSign size={14} className="shrink-0" />
                <span className="font-semibold text-charcoal-900">
                  {deal.value ? formatPrice(deal.value) : 'No value set'}
                </span>
              </div>
              <div className="flex items-center gap-2 text-charcoal-500">
                <TrendingUp size={14} className="shrink-0" />
                <span>Weighted: {deal.value ? formatPrice(deal.value * deal.probability / 100) : '—'}</span>
              </div>
              {deal.expectedClose && (
                <div className="flex items-center gap-2 text-charcoal-500">
                  <Calendar size={14} className="shrink-0" />
                  <span>Close: {formatDate(deal.expectedClose, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                </div>
              )}
              {deal.assignee && (
                <div className="flex items-center gap-2 text-charcoal-500">
                  <User size={14} className="shrink-0" />
                  <span>{deal.assignee.name}</span>
                </div>
              )}
            </div>

            {deal.notes && (
              <div className="mt-4 rounded-lg bg-charcoal-50 p-3 border-t border-charcoal-100">
                <p className="text-xs text-charcoal-400 mb-1">Notes</p>
                <p className="text-sm text-charcoal-700 whitespace-pre-wrap">{deal.notes}</p>
              </div>
            )}

            <div className="mt-4 text-xs text-charcoal-400 border-t border-charcoal-100 pt-3">
              <p>Created: {formatDate(deal.createdAt, { month: 'short', day: 'numeric', year: 'numeric' })}</p>
              {deal.closedAt && <p>Closed: {formatDate(deal.closedAt, { month: 'short', day: 'numeric', year: 'numeric' })}</p>}
            </div>
          </Card>

          {/* Participants */}
          <Card>
            <p className="text-xs font-semibold text-charcoal-500 uppercase tracking-wide mb-3">Participants</p>
            {deal.participants.length === 0 ? (
              <p className="text-sm text-charcoal-400">No contacts linked.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {deal.participants.map(p => (
                  <Link
                    key={p.contact.id}
                    href={`/admin/contacts/${p.contact.id}`}
                    className="flex items-center gap-3 hover:bg-charcoal-50 rounded-lg p-1 -mx-1 transition-colors"
                  >
                    <Avatar name={`${p.contact.firstName} ${p.contact.lastName}`} size="sm" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-charcoal-900 truncate">
                        {p.contact.firstName} {p.contact.lastName}
                      </p>
                      {p.contact.email && (
                        <p className="text-xs text-charcoal-400 truncate">{p.contact.email}</p>
                      )}
                    </div>
                    <Badge variant="default" className="text-xs ml-auto shrink-0 capitalize">{p.role}</Badge>
                  </Link>
                ))}
              </div>
            )}
          </Card>

          {/* Stage history */}
          <Card>
            <p className="text-xs font-semibold text-charcoal-500 uppercase tracking-wide mb-3">Stage History</p>
            <div className="relative pl-5">
              <div className="absolute left-1.5 top-0 bottom-0 w-px bg-charcoal-100" />
              {deal.stageHistory.map((h, i) => {
                const durationDays = h.exitedAt
                  ? Math.round((h.exitedAt.getTime() - h.enteredAt.getTime()) / 86_400_000)
                  : Math.round((Date.now() - h.enteredAt.getTime()) / 86_400_000)
                const isCurrent = i === deal.stageHistory.length - 1

                return (
                  <div key={h.id} className="relative pb-4 last:pb-0">
                    <div
                      className={`absolute -left-5 top-0.5 h-3 w-3 rounded-full ring-2 ring-white`}
                      style={{ background: h.stage.color }}
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-charcoal-800">{h.stage.name}</span>
                        {isCurrent && <span className="text-xs text-green-600">← current</span>}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-charcoal-400 mt-0.5">
                        <Clock size={10} />
                        {durationDays}d
                        <span>·</span>
                        {formatDate(h.enteredAt, { month: 'short', day: 'numeric' })}
                        {h.exitedAt && (
                          <> → {formatDate(h.exitedAt, { month: 'short', day: 'numeric' })}</>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        </div>

        {/* ── Main content ──────────────────────────────────────────────── */}
        <div className="lg:col-span-2">
          <Tabs tabs={[
            {
              id:      'activity',
              label:   `Activity (${deal.activities.length})`,
              content: <ActivityTimeline activities={activities} />,
            },
            {
              id:      'tasks',
              label:   `Tasks (${deal.tasks.length})`,
              content: <TaskList tasks={deal.tasks} />,
            },
            ...(deal.property ? [{
              id:      'property',
              label:   'Property',
              content: (
                <div className="rounded-xl border border-charcoal-100 bg-charcoal-50 p-4">
                  <p className="font-semibold text-charcoal-900 mb-1">{deal.property.title}</p>
                  <p className="text-sm text-charcoal-500">{deal.property.address}, {deal.property.city}</p>
                  <p className="text-sm font-bold text-charcoal-800 mt-2">
                    {formatPrice(deal.property.price)}
                  </p>
                </div>
              ),
            }] : []),
          ]} />
        </div>
      </div>
    </DashboardLayout>
  )
}
