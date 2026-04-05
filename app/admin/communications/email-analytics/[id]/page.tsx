import { notFound, redirect }  from 'next/navigation'
import { getSession }          from '@/lib/auth'
import { prisma }              from '@/lib/prisma'
import { DashboardLayout }     from '@/components/dashboard'
import { PageHeader, Card }    from '@/components/layout'
import { CampaignStatsCards }  from '@/components/communications/CampaignStatsCards'
import { formatDate }          from '@/lib/utils'
import Link                    from 'next/link'
import { ArrowLeft }           from 'lucide-react'

interface Props { params: Promise<{ id: string }> }

const STATUS_CLASSES: Record<string, string> = {
  sent:      'bg-blue-100 text-blue-700',
  delivered: 'bg-green-100 text-green-700',
  bounced:   'bg-red-100 text-red-700',
  failed:    'bg-red-100 text-red-700',
  opted_out: 'bg-charcoal-100 text-charcoal-500',
}

export default async function CampaignDetailPage({ params }: Props) {
  const session = await getSession()
  if (!session) redirect('/admin/login')

  const { id } = await params

  const campaign = await prisma.emailCampaign.findUnique({
    where: { id },
    include: {
      emails: {
        include: { contact: { select: { id: true, firstName: true, lastName: true } } },
        orderBy: { sentAt: 'asc' },
      },
    },
  })
  if (!campaign) notFound()

  const opens     = campaign.emails.filter(e => e.openCount  > 0).length
  const clicks    = campaign.emails.filter(e => e.clickCount > 0).length
  const openRate  = campaign.recipientCount > 0
    ? (opens  / campaign.recipientCount * 100).toFixed(1) + '%'
    : '—'
  const clickRate = campaign.recipientCount > 0
    ? (clicks / campaign.recipientCount * 100).toFixed(1) + '%'
    : '—'

  return (
    <DashboardLayout user={session}>
      <PageHeader
        title={campaign.name}
        subtitle={`${campaign.subject} · ${formatDate(campaign.sentAt, { month: 'long', day: 'numeric', year: 'numeric' })}`}
        breadcrumbs={[
          { label: 'Dashboard',       href: '/admin/dashboard' },
          { label: 'Communications',  href: '/admin/communications' },
          { label: 'Email Analytics', href: '/admin/communications/email-analytics' },
          { label: campaign.name },
        ]}
      />

      <CampaignStatsCards stats={[
        { label: 'Recipients', value: campaign.recipientCount },
        { label: 'Opens',      value: opens },
        { label: 'Open Rate',  value: openRate },
        { label: 'Click Rate', value: clickRate },
      ]} />

      <Card padding="none">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-charcoal-100 text-left text-xs text-charcoal-500 uppercase tracking-wide">
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Opened</th>
              <th className="px-4 py-3">Clicked</th>
            </tr>
          </thead>
          <tbody>
            {campaign.emails.map(msg => {
              const contactName = msg.contact
                ? `${msg.contact.firstName} ${msg.contact.lastName}`
                : msg.toEmail ?? '—'
              const statusClass = STATUS_CLASSES[msg.status] ?? 'bg-charcoal-100 text-charcoal-500'

              return (
                <tr key={msg.id} className="border-b border-charcoal-50 hover:bg-charcoal-50 transition-colors">
                  <td className="px-4 py-3">
                    {msg.contact ? (
                      <Link
                        href={`/admin/contacts/${msg.contact.id}`}
                        className="text-gold-600 hover:underline"
                      >
                        {contactName}
                      </Link>
                    ) : (
                      <span className="text-charcoal-500">{contactName}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-charcoal-500">{msg.toEmail ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusClass}`}>
                      {msg.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-charcoal-700">
                    {msg.openedAt
                      ? formatDate(msg.openedAt, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-charcoal-700">
                    {msg.clickedAt
                      ? formatDate(msg.clickedAt, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
                      : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Card>

      <Link
        href="/admin/communications/email-analytics"
        className="inline-flex items-center gap-1.5 mt-4 text-sm text-charcoal-500 hover:text-charcoal-900 transition-colors"
      >
        <ArrowLeft size={14} /> Back to Email Analytics
      </Link>
    </DashboardLayout>
  )
}
