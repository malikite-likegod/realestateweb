import { getSession } from '@/lib/auth'
import { DashboardLayout } from '@/components/dashboard'
import { PageHeader } from '@/components/layout'
import { Card } from '@/components/layout'
import { Button, Input, Divider } from '@/components/ui'
import { prisma } from '@/lib/prisma'

export default async function SettingsPage() {
  const session = await getSession()
  if (!session) return null

  const lastSync = await prisma.idxUpdate.findFirst({ orderBy: { syncedAt: 'desc' } })
  const apiKeyCount = await prisma.apiKey.count({ where: { userId: session.id } })
  const commandLogCount = await prisma.aiCommandLog.count()

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
      </div>
    </DashboardLayout>
  )
}
