import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { DashboardLayout } from '@/components/dashboard'
import { PageHeader } from '@/components/layout'
import { ApiKeysManager } from './ApiKeysManager'

export const metadata = { title: 'API Keys' }

export default async function ApiKeysPage() {
  const session = await getSession()
  if (!session) redirect('/admin/login')

  return (
    <DashboardLayout user={session}>
      <PageHeader
        title="API Keys"
        breadcrumbs={[
          { label: 'Dashboard', href: '/admin/dashboard' },
          { label: 'Settings', href: '/admin/settings' },
          { label: 'API Keys' },
        ]}
      />
      <ApiKeysManager />
    </DashboardLayout>
  )
}
