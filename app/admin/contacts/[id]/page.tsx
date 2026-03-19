import { notFound, redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getContactTimeline } from '@/lib/communications/timeline-service'
import { DashboardLayout } from '@/components/dashboard'
import { PageHeader } from '@/components/layout'
import { Card } from '@/components/layout'
import {
  NotesPanel, TaskList,
  CallLogger, SmsThread, EmailComposer, UnifiedTimeline,
  ContactEditModal, ContactTagEditor, ContactCampaigns,
  CommOptLogPanel,
} from '@/components/crm'
import { PropertyInterestsPanel } from '@/components/admin/contacts/PropertyInterestsPanel'
import { SavedSearchesTab } from '@/components/admin/contacts/SavedSearchesTab'
import { Avatar, Badge, Tabs } from '@/components/ui'
import { formatDate } from '@/lib/utils'
import {
  Phone, Mail, MapPin, TrendingUp, Cake, Briefcase,
  Building2, Star, MessageSquare, CheckCircle,
} from 'lucide-react'

interface Props { params: Promise<{ id: string }> }

export default async function ContactDetailPage({ params }: Props) {
  const session = await getSession()
  if (!session) redirect('/admin/login')

  const { id } = await params

  const [contact, timeline, allTags, campaignEnrollments, activeCampaigns] = await Promise.all([
    prisma.contact.findUnique({
      where: { id },
      include: {
        phones:    { orderBy: { createdAt: 'asc' } },
        addresses: { orderBy: { createdAt: 'asc' } },
        tags:      { include: { tag: true } },
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
        deals: {
          include: { deal: { include: { stage: true } } },
        },
        optLogs: {
          orderBy: { changedAt: 'desc' },
          take:    10,
          include: { changedBy: { select: { name: true } } },
        },
      },
    }),
    getContactTimeline(id, { limit: 60 }),
    prisma.tag.findMany({ orderBy: { name: 'asc' } }),
    prisma.campaignEnrollment.findMany({
      where:   { contactId: id },
      orderBy: { enrolledAt: 'desc' },
      include: {
        sequence: {
          select: { id: true, name: true, trigger: true, steps: { select: { id: true } } },
        },
      },
    }),
    prisma.automationSequence.findMany({
      where:   { isActive: true },
      select:  { id: true, name: true, trigger: true },
      orderBy: { name: 'asc' },
    }),
  ])

  if (!contact) notFound()

  const statusVariants: Record<string, 'default' | 'info' | 'success' | 'gold'> = {
    lead: 'info', prospect: 'gold', client: 'success', past_client: 'default',
  }

  // Determine phones and addresses to display:
  // prefer new multi-value arrays; fall back to legacy fields if arrays empty
  const displayPhones = contact.phones.length > 0
    ? contact.phones
    : contact.phone
      ? [{ id: 'legacy', label: 'mobile', number: contact.phone, isPrimary: true }]
      : []

  const displayAddresses = contact.addresses.length > 0
    ? contact.addresses
    : (contact.address || contact.city)
      ? [{
          id:         'legacy',
          label:      'home',
          street:     contact.address   ?? null,
          city:       contact.city      ?? null,
          province:   contact.province  ?? null,
          postalCode: contact.postalCode ?? null,
          country:    contact.country   ?? 'CA',
          isPrimary:  true,
        }]
      : []

  return (
    <DashboardLayout user={session}>
      <PageHeader
        title={`${contact.firstName} ${contact.lastName}`}
        breadcrumbs={[
          { label: 'Dashboard', href: '/admin/dashboard' },
          { label: 'Contacts',  href: '/admin/contacts' },
          { label: `${contact.firstName} ${contact.lastName}` },
        ]}
        actions={<ContactEditModal contact={contact} />}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Left sidebar ─────────────────────────────────────────────── */}
        <div className="flex flex-col gap-4">

          {/* Identity card */}
          <Card>
            <div className="flex flex-col items-center text-center gap-3 mb-5">
              <Avatar name={`${contact.firstName} ${contact.lastName}`} size="xl" />
              <div>
                <p className="font-semibold text-charcoal-900 text-lg leading-tight">
                  {contact.firstName} {contact.lastName}
                </p>
                {contact.jobTitle && (
                  <p className="text-sm text-charcoal-500 mt-0.5">{contact.jobTitle}</p>
                )}
                {contact.company && (
                  <p className="text-xs text-charcoal-400 mt-0.5">{contact.company}</p>
                )}
              </div>
              <Badge variant={statusVariants[contact.status] ?? 'default'} className="capitalize">
                {contact.status.replace('_', ' ')}
              </Badge>
              {/* Opt-out badges */}
              {(contact.emailOptOut || contact.smsOptOut) && (
                <div className="flex flex-wrap gap-1.5 justify-center">
                  {contact.emailOptOut && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                      <Mail size={10} /> Email opted out
                    </span>
                  )}
                  {contact.smsOptOut && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                      <MessageSquare size={10} /> SMS opted out
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Lead score */}
            <div className="flex items-center justify-between rounded-lg bg-charcoal-50 px-3 py-2 mb-4">
              <span className="flex items-center gap-1.5 text-xs text-charcoal-500">
                <TrendingUp size={13} /> Lead Score
              </span>
              <div className="flex items-center gap-2">
                <div className="w-24 h-1.5 rounded-full bg-charcoal-200 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${contact.leadScore >= 75 ? 'bg-green-500' : contact.leadScore >= 40 ? 'bg-gold-500' : 'bg-charcoal-400'}`}
                    style={{ width: `${Math.min(contact.leadScore, 100)}%` }}
                  />
                </div>
                <span className="text-sm font-semibold text-charcoal-900 w-7 text-right">
                  {contact.leadScore}
                </span>
              </div>
            </div>

            {/* Contact details */}
            <div className="flex flex-col gap-2.5 text-sm">
              {/* Phones */}
              {displayPhones.map((p, i) => (
                <a
                  key={p.id ?? i}
                  href={`tel:${p.number}`}
                  className="flex items-center gap-2 text-charcoal-600 hover:text-gold-600 transition-colors group"
                >
                  <Phone size={13} className="shrink-0 text-charcoal-400 group-hover:text-gold-500" />
                  <span className="flex-1 truncate">{p.number}</span>
                  {contact.phoneVerified && (i === 0) && (
                    <span
                      title={contact.phoneVerifiedAt ? `Verified on ${contact.phoneVerifiedAt.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}` : 'Verified'}
                      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 shrink-0"
                    >
                      <CheckCircle size={9} /> Verified
                    </span>
                  )}
                  {displayPhones.length > 1 && (
                    <span className="text-xs text-charcoal-400 capitalize shrink-0">
                      {p.isPrimary ? <Star size={10} className="text-gold-400" fill="currentColor" /> : p.label}
                    </span>
                  )}
                </a>
              ))}

              {/* Email */}
              {contact.email && (
                <a
                  href={`mailto:${contact.email}`}
                  className="flex items-center gap-2 text-charcoal-600 hover:text-gold-600 transition-colors"
                >
                  <Mail size={13} className="shrink-0 text-charcoal-400" />
                  <span className="truncate flex-1">{contact.email}</span>
                  {contact.emailVerified && (
                    <span
                      title={contact.emailVerifiedAt ? `Verified on ${contact.emailVerifiedAt.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}` : 'Verified'}
                      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 shrink-0"
                    >
                      <CheckCircle size={9} /> Verified
                    </span>
                  )}
                </a>
              )}

              {/* Company / job */}
              {contact.company && (
                <span className="flex items-center gap-2 text-charcoal-500">
                  <Building2 size={13} className="shrink-0 text-charcoal-400" />
                  {contact.company}
                  {contact.jobTitle && <span className="text-charcoal-400">· {contact.jobTitle}</span>}
                </span>
              )}

              {/* Birthday */}
              {contact.birthday && (
                <span className="flex items-center gap-2 text-charcoal-500">
                  <Cake size={13} className="shrink-0 text-charcoal-400" />
                  {formatDate(contact.birthday, { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}
                </span>
              )}
            </div>
          </Card>

          {/* Addresses card */}
          {displayAddresses.length > 0 && (
            <Card>
              <p className="text-xs font-semibold text-charcoal-500 uppercase tracking-wide mb-3">
                Addresses
              </p>
              <div className="flex flex-col gap-3">
                {displayAddresses.map((addr, i) => (
                  <div key={addr.id ?? i} className="flex gap-2">
                    <MapPin size={13} className="shrink-0 text-charcoal-400 mt-0.5" />
                    <div className="text-sm text-charcoal-600 leading-relaxed">
                      <span className="text-xs font-medium text-charcoal-400 capitalize block mb-0.5">
                        {addr.label}{addr.isPrimary && displayAddresses.length > 1 ? ' · primary' : ''}
                      </span>
                      {addr.street  && <span className="block">{addr.street}</span>}
                      {(addr.city || addr.province) && (
                        <span className="block">
                          {[addr.city, addr.province].filter(Boolean).join(', ')}
                          {addr.postalCode && ` ${addr.postalCode}`}
                        </span>
                      )}
                      {addr.country && addr.country !== 'CA' && (
                        <span className="block text-charcoal-400">{addr.country}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Tags & meta */}
          <Card>
            <div className="mb-4">
              <ContactTagEditor
                contactId={id}
                initialTags={contact.tags.map(({ tag }) => tag)}
                allTags={allTags}
              />
            </div>

            {/* Notes */}
            {contact.notes && (
              <div className="mb-4">
                <p className="text-xs font-semibold text-charcoal-500 uppercase tracking-wide mb-1.5">Notes</p>
                <p className="text-sm text-charcoal-600 whitespace-pre-wrap leading-relaxed">{contact.notes}</p>
              </div>
            )}

            {/* Active deals */}
            {contact.deals.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-semibold text-charcoal-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <Briefcase size={11} /> Deals ({contact.deals.length})
                </p>
                <div className="flex flex-col gap-1.5">
                  {contact.deals.map(({ deal }) => (
                    <a
                      key={deal.id}
                      href={`/admin/deals/${deal.id}`}
                      className="flex items-center justify-between text-xs rounded-lg bg-charcoal-50 px-2.5 py-1.5 hover:bg-charcoal-100 transition-colors"
                    >
                      <span className="text-charcoal-700 font-medium truncate">{deal.title}</span>
                      <span
                        className="ml-2 rounded-full px-2 py-0.5 font-medium shrink-0"
                        style={{ backgroundColor: deal.stage.color + '22', color: deal.stage.color }}
                      >
                        {deal.stage.name}
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            )}

            <div className="text-xs text-charcoal-400 border-t border-charcoal-100 pt-3 flex flex-col gap-1">
              <span>Source: <span className="text-charcoal-600 capitalize">{contact.source ?? '—'}</span></span>
              <span>Added: {formatDate(contact.createdAt, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
              <span>Updated: {formatDate(contact.updatedAt, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
            </div>
          </Card>

          <CommOptLogPanel
            emailOptOut={contact.emailOptOut}
            smsOptOut={contact.smsOptOut}
            optLogs={contact.optLogs}
          />

          <PropertyInterestsPanel contactId={id} />

          <Card>
            <p className="text-xs font-semibold text-charcoal-500 uppercase tracking-wide mb-4">Saved Searches</p>
            <SavedSearchesTab contactId={id} />
          </Card>

        </div>

        {/* ── Main content: tabbed communication hub ───────────────────── */}
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
                  contactPhone={
                    displayPhones.find(p => p.isPrimary)?.number ??
                    displayPhones[0]?.number ??
                    contact.phone
                  }
                  smsOptOut={contact.smsOptOut}
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
                  emailOptOut={contact.emailOptOut}
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
                    direction: c.direction as 'inbound' | 'outbound',
                    status:    c.status    as 'completed' | 'missed' | 'voicemail' | 'failed',
                  }))}
                  contactId={id}
                />
              ),
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
            {
              id:      'campaigns',
              label:   `Campaigns (${campaignEnrollments.length})`,
              content: (
                <ContactCampaigns
                  contactId={id}
                  initialEnrollments={campaignEnrollments.map(e => ({
                    ...e,
                    status:   e.status as 'active' | 'paused' | 'completed' | 'cancelled',
                    sequence: {
                      id:         e.sequence.id,
                      name:       e.sequence.name,
                      trigger:    e.sequence.trigger,
                      totalSteps: e.sequence.steps.length,
                    },
                  }))}
                  availableCampaigns={activeCampaigns}
                />
              ),
            },
          ]} />
        </div>
      </div>
    </DashboardLayout>
  )
}
