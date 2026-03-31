import { notFound, redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { DashboardLayout } from '@/components/dashboard'
import { PageHeader } from '@/components/layout'
import { Card } from '@/components/layout'
import { formatDate } from '@/lib/utils'
import { Mail, User, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { EmailDetailActions } from '@/components/communications/EmailDetailActions'
import { sanitizeContent } from '@/lib/sanitize'

interface Props { params: Promise<{ id: string }> }

export default async function EmailDetailPage({ params }: Props) {
  const session = await getSession()
  if (!session) redirect('/admin/login')

  const { id } = await params

  const email = await prisma.emailMessage.findUnique({
    where: { id },
    include: {
      contact: { select: { id: true, firstName: true, lastName: true, email: true } },
      sentBy:  { select: { name: true } },
    },
  })

  if (!email) notFound()

  const directionLabel = email.direction === 'inbound' ? 'Received' : 'Sent'
  const fromLabel      = email.direction === 'inbound' ? email.fromEmail : (email.sentBy?.name ?? email.fromEmail)
  const toLabel        = email.toEmail

  return (
    <DashboardLayout user={session}>
      <PageHeader
        title={email.subject}
        subtitle={`${directionLabel} · ${formatDate(email.sentAt, { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}`}
        breadcrumbs={[
          { label: 'Dashboard',      href: '/admin/dashboard' },
          { label: 'Communications', href: '/admin/communications' },
          { label: email.subject },
        ]}
      />

      <div className="max-w-3xl space-y-4">
        {/* Action buttons */}
        <EmailDetailActions
          emailId={email.id}
          fromEmail={email.fromEmail}
          subject={email.subject}
          body={email.body}
        />

        {/* Header card */}
        <Card>
          <div className="flex items-start gap-4">
            <div className="h-10 w-10 shrink-0 rounded-full bg-purple-100 flex items-center justify-center text-purple-600">
              <Mail size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="grid grid-cols-[80px_1fr] gap-x-4 gap-y-1 text-sm">
                <span className="text-charcoal-400 font-medium">From</span>
                <span className="text-charcoal-900">{fromLabel ?? '—'}</span>

                <span className="text-charcoal-400 font-medium">To</span>
                <span className="text-charcoal-900">{toLabel ?? '—'}</span>

                <span className="text-charcoal-400 font-medium">Date</span>
                <span className="text-charcoal-900">
                  {formatDate(email.sentAt, { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                </span>

                {email.contact && (
                  <>
                    <span className="text-charcoal-400 font-medium">Contact</span>
                    <Link
                      href={`/admin/contacts/${email.contact.id}`}
                      className="flex items-center gap-1 text-gold-600 hover:underline"
                    >
                      <User size={12} />
                      {email.contact.firstName} {email.contact.lastName}
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        </Card>

        {/* Body */}
        <Card>
          <div
            className="prose prose-sm max-w-none text-charcoal-800 [&_a]:text-gold-600 [&_pre]:whitespace-pre-wrap [&_pre]:text-xs"
            dangerouslySetInnerHTML={{ __html: sanitizeContent(email.body ?? '') }}
          />
        </Card>

        <Link
          href="/admin/communications"
          className="inline-flex items-center gap-1.5 text-sm text-charcoal-500 hover:text-charcoal-900 transition-colors"
        >
          <ArrowLeft size={14} /> Back to inbox
        </Link>
      </div>
    </DashboardLayout>
  )
}
