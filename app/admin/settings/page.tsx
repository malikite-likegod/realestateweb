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
import { LeadCaptureSettingsCard } from '@/components/admin/LeadCaptureSettingsCard'
import { BlurModeSettingsCard } from '@/components/admin/BlurModeSettingsCard'
import { MlsSyncSettingsCard } from '@/components/admin/MlsSyncSettingsCard'
import { HotBrowserAlertCard } from '@/components/admin/HotBrowserAlertCard'
import { SignatureSettingsCard } from '@/components/admin/SignatureSettingsCard'
import { AgentMlsNameCard }   from '@/components/admin/AgentMlsNameCard'
import { AgentProfileCard }   from '@/components/admin/AgentProfileCard'
import type { AgentProfileSettings } from '@/components/admin/AgentProfileCard'
import { BrandLogoCard }      from '@/components/admin/BrandLogoCard'

export default async function SettingsPage() {
  const session = await getSession()
  if (!session) redirect('/admin/login')

  const [syncLogs, apiKeyCount, commandLogCount, queueStats, tfaUser, gateSettingsRows, activeListings, mlsSyncIntervalRow, hotAlertRows, sigUser, agentMlsNameRow, agentProfileRows, brandLogoRow] = await Promise.all([
    Promise.all([
      prisma.resoSyncLog.findFirst({ where: { syncType: 'idx_property' }, orderBy: { syncedAt: 'desc' } }),
      prisma.resoSyncLog.findFirst({ where: { syncType: 'dla_property' }, orderBy: { syncedAt: 'desc' } }),
      prisma.resoSyncLog.findFirst({ where: { syncType: 'vox_member'   }, orderBy: { syncedAt: 'desc' } }),
      prisma.resoSyncLog.findFirst({ where: { syncType: 'vox_office'   }, orderBy: { syncedAt: 'desc' } }),
    ]),
    prisma.apiKey.count({ where: { userId: session.id } }),
    prisma.aiCommandLog.count(),
    prisma.jobQueue.groupBy({ by: ['status'], _count: { id: true } }),
    prisma.user.findUnique({ where: { id: session.id }, select: { totpEnabled: true } }),
    prisma.siteSettings.findMany({ where: { key: { in: ['listing_gate_limit', 'listing_gate_enabled'] } } }),
    prisma.resoProperty.count({ where: { standardStatus: 'Active' } }),
    prisma.siteSettings.findUnique({ where: { key: 'mls_sync_interval_minutes' } }),
    prisma.siteSettings.findMany({ where: { key: { in: ['hot_browser_alert_enabled', 'hot_browser_alert_views', 'hot_browser_alert_hours'] } } }),
    prisma.user.findUnique({ where: { id: session.id }, select: { emailSignature: true, smsSignature: true } }),
    prisma.siteSettings.findUnique({ where: { key: 'listing_agent_mls_name' } }),
    prisma.siteSettings.findMany({
      where: { key: { in: ['agent_name','agent_designation','agent_bio','agent_phone','agent_brokerage','office_address','agent_email','agent_image'] } },
    }),
    prisma.siteSettings.findUnique({ where: { key: 'brand_logo' } }),
  ])
  const [idxSync, dlaSync, voxMemberSync, voxOfficeSync] = syncLogs

  const agentProfileMap: Record<string, string> = {}
  for (const r of agentProfileRows) agentProfileMap[r.key] = r.value
  const agentProfileSettings: AgentProfileSettings = {
    agent_name:        agentProfileMap['agent_name']        ?? process.env.AGENT_NAME  ?? '',
    agent_designation: agentProfileMap['agent_designation'] ?? '',
    agent_bio:         agentProfileMap['agent_bio']         ?? '',
    agent_phone:       agentProfileMap['agent_phone']       ?? process.env.AGENT_PHONE ?? '',
    agent_brokerage:   agentProfileMap['agent_brokerage']   ?? '',
    office_address:    agentProfileMap['office_address']    ?? '',
    agent_email:       agentProfileMap['agent_email']       ?? process.env.AGENT_EMAIL ?? '',
    agent_image:       agentProfileMap['agent_image']       ?? '',
  }
  const totpEnabled = tfaUser?.totpEnabled ?? false

  const twilioConfigured  = !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER)
  const smtpConfigured    = !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)
  const zeroBounceConfigured = !!process.env.ZEROBOUNCE_API_KEY

  const jobStats = {
    pending:   queueStats.find(s => s.status === 'pending')?._count.id  ?? 0,
    running:   queueStats.find(s => s.status === 'running')?._count.id  ?? 0,
    failed:    queueStats.find(s => s.status === 'failed')?._count.id   ?? 0,
    completed: queueStats.find(s => s.status === 'completed')?._count.id ?? 0,
  }

  const gateSettingsMap: Record<string, string> = {}
  for (const r of gateSettingsRows) gateSettingsMap[r.key] = r.value
  const gateLimit   = parseInt(gateSettingsMap['listing_gate_limit']   ?? '3', 10)
  const gateEnabled = (gateSettingsMap['listing_gate_enabled'] ?? 'true') === 'true'

  const mlsSyncInterval = parseInt(mlsSyncIntervalRow?.value ?? '60', 10)

  const hotAlertMap: Record<string, string> = {}
  for (const r of hotAlertRows) hotAlertMap[r.key] = r.value
  const hotAlertEnabled = (hotAlertMap['hot_browser_alert_enabled'] ?? 'false') === 'true'
  const hotAlertViews   = parseInt(hotAlertMap['hot_browser_alert_views'] ?? '5', 10)
  const hotAlertHours   = parseInt(hotAlertMap['hot_browser_alert_hours'] ?? '24', 10)

  function toSyncInfo(log: typeof idxSync) {
    return log ? {
      syncedAt: log.syncedAt.toISOString(),
      added:    log.added,
      updated:  log.updated,
      deleted:  log.deleted,
    } : null
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

        <SignatureSettingsCard
          initialEmailSignature={sigUser?.emailSignature ?? null}
          initialSmsSignature={sigUser?.smsSignature ?? null}
        />

        <AgentProfileCard initial={agentProfileSettings} />

        <BrandLogoCard initialLogoUrl={brandLogoRow?.value ?? ''} />

        <LeadCaptureSettingsCard initialLimit={gateLimit} initialEnabled={gateEnabled} />

        <HotBrowserAlertCard
          initialEnabled={hotAlertEnabled}
          initialViews={hotAlertViews}
          initialHours={hotAlertHours}
        />

        <BlurModeSettingsCard />

        <Divider />

        <AgentMlsNameCard initialName={agentMlsNameRow?.value ?? ''} />

        <MlsSyncSettingsCard
          initialIntervalMinutes={mlsSyncInterval}
          activeListings={activeListings}
          idxSync={toSyncInfo(idxSync)}
          dlaSync={toSyncInfo(dlaSync)}
          voxMemberSync={toSyncInfo(voxMemberSync)}
          voxOfficeSync={toSyncInfo(voxOfficeSync)}
        />

        {/* AI */}
        <Card>
          <h3 className="font-semibold text-charcoal-900 mb-2">AI & OpenClaw</h3>
          <p className="text-sm text-charcoal-400 mb-4">
            {apiKeyCount} API key{apiKeyCount !== 1 ? 's' : ''} · {commandLogCount} commands executed
          </p>
          <div className="flex gap-3">
            <Button variant="primary" asChild>
              <a href="/admin/settings/api-keys">Manage API Keys</a>
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
            <div className="flex items-center justify-between py-2.5 border-t border-charcoal-100">
              <div>
                <p className="text-sm font-medium text-charcoal-900">ZeroBounce</p>
                <p className="text-xs text-charcoal-400">Email validation — set ZEROBOUNCE_API_KEY</p>
              </div>
              {zeroBounceConfigured
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
