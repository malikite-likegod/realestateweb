import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { DashboardLayout } from '@/components/dashboard'
import { PageHeader } from '@/components/layout'
import { Card } from '@/components/layout'
import { Button, Input, Divider } from '@/components/ui'
import { prisma } from '@/lib/prisma'
import { CheckCircle2, XCircle } from 'lucide-react'
import { ChangePasswordCard } from '@/components/admin/ChangePasswordCard'
import { TwoFactorCard } from '@/components/admin/TwoFactorCard'

export default async function SettingsPage() {
  const session = await getSession()
  if (!session) redirect('/admin/login')

  const [lastSync, apiKeyCount, commandLogCount, queueStats, tfaUser] = await Promise.all([
    prisma.idxUpdate.findFirst({ orderBy: { syncedAt: 'desc' } }),
    prisma.apiKey.count({ where: { userId: session.id } }),
    prisma.aiCommandLog.count(),
    prisma.jobQueue.groupBy({ by: ['status'], _count: { id: true } }),
    prisma.user.findUnique({ where: { id: session.id }, select: { totpEnabled: true } }),
  ])
  const totpEnabled = tfaUser?.totpEnabled ?? false

  const twilioConfigured  = !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER)
  const smtpConfigured    = !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)

  const jobStats = {
    pending:   queueStats.find(s => s.status === 'pending')?._count.id  ?? 0,
    running:   queueStats.find(s => s.status === 'running')?._count.id  ?? 0,
    failed:    queueStats.find(s => s.status === 'failed')?._count.id   ?? 0,
    completed: queueStats.find(s => s.status === 'completed')?._count.id ?? 0,
  }

  return (
    <DashboardLayout user={session}>
      <PageHeader
        title="Settings"
        breadcrumbs={[{ label: 'Dashboard', href: '/admin/dashboard' }, { label: 'Settings' }]}
      />

      <div className="flex flex-col gap-6 max-w-2xl">
        {/* Profile */}
        <Card>
          <h3 className="font-semibold text-charcoal-900 mb-4">Profile</h3>
          <div className="flex flex-col gap-4">
            <Input label="Name" defaultValue={session.name} />
            <Input label="Email" type="email" defaultValue={session.email} />
            <Button variant="primary" className="self-start">Save Changes</Button>
          </div>
        </Card>

        <ChangePasswordCard />

        <TwoFactorCard initialEnabled={totpEnabled} userEmail={session.email} />

        <Divider />

        {/* IDX */}
        <Card>
          <h3 className="font-semibold text-charcoal-900 mb-2">IDX Integration</h3>
          <p className="text-sm text-charcoal-400 mb-4">
            {lastSync ? `Last synced: ${lastSync.syncedAt.toLocaleString()} — ${lastSync.added} added, ${lastSync.updated} updated` : 'Never synced'}
          </p>
          <form action="/api/idx/sync" method="POST">
            <Button variant="outline" type="submit">Sync IDX Listings Now</Button>
          </form>
        </Card>

        {/* AI */}
        <Card>
          <h3 className="font-semibold text-charcoal-900 mb-2">AI & OpenClaw</h3>
          <p className="text-sm text-charcoal-400 mb-4">
            {apiKeyCount} API key{apiKeyCount !== 1 ? 's' : ''} · {commandLogCount} commands executed
          </p>
          <div className="flex gap-3">
            <Button variant="outline">Generate API Key</Button>
            <Button variant="ghost" asChild>
              <a href="/admin/settings/api-keys">Manage Keys</a>
            </Button>
          </div>
        </Card>

        <Divider />

        {/* Provider configuration status */}
        <Card>
          <h3 className="font-semibold text-charcoal-900 mb-4">Communication Providers</h3>
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between py-2.5 border-b border-charcoal-100">
              <div>
                <p className="text-sm font-medium text-charcoal-900">Twilio (SMS &amp; Calls)</p>
                <p className="text-xs text-charcoal-400">Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER</p>
              </div>
              {twilioConfigured
                ? <CheckCircle2 size={18} className="text-green-500 shrink-0" />
                : <XCircle      size={18} className="text-charcoal-300 shrink-0" />}
            </div>
            <div className="flex items-center justify-between py-2.5">
              <div>
                <p className="text-sm font-medium text-charcoal-900">SMTP (Email)</p>
                <p className="text-xs text-charcoal-400">Set SMTP_HOST, SMTP_USER, SMTP_PASS</p>
              </div>
              {smtpConfigured
                ? <CheckCircle2 size={18} className="text-green-500 shrink-0" />
                : <XCircle      size={18} className="text-charcoal-300 shrink-0" />}
            </div>
          </div>
        </Card>

        {/* Automation job queue status */}
        <Card>
          <h3 className="font-semibold text-charcoal-900 mb-4">Automation Job Queue</h3>
          <div className="grid grid-cols-4 gap-3 text-center">
            <div className="rounded-lg bg-amber-50 p-3">
              <p className="text-lg font-semibold text-amber-700">{jobStats.pending}</p>
              <p className="text-xs text-charcoal-400 mt-0.5">Pending</p>
            </div>
            <div className="rounded-lg bg-blue-50 p-3">
              <p className="text-lg font-semibold text-blue-700">{jobStats.running}</p>
              <p className="text-xs text-charcoal-400 mt-0.5">Running</p>
            </div>
            <div className="rounded-lg bg-red-50 p-3">
              <p className="text-lg font-semibold text-red-700">{jobStats.failed}</p>
              <p className="text-xs text-charcoal-400 mt-0.5">Failed</p>
            </div>
            <div className="rounded-lg bg-green-50 p-3">
              <p className="text-lg font-semibold text-green-700">{jobStats.completed}</p>
              <p className="text-xs text-charcoal-400 mt-0.5">Completed</p>
            </div>
          </div>
          <form action="/api/automation/process" method="POST" className="mt-4">
            <Button variant="outline" type="submit" size="sm">Process Queue Now</Button>
          </form>
        </Card>
      </div>
    </DashboardLayout>
  )
}
