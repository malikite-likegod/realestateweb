import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getSession } from '@/lib/auth'
import { DashboardLayout } from '@/components/dashboard'
import { PageHeader } from '@/components/layout'
import { Button } from '@/components/ui'
import { NewContactForm } from './NewContactForm'

export default async function NewContactPage() {
  const session = await getSession()
  if (!session) redirect('/admin/login')

  return (
    <DashboardLayout user={session}>
      <PageHeader
        title="Add Contact"
        breadcrumbs={[
          { label: 'Dashboard', href: '/admin/dashboard' },
          { label: 'Contacts',  href: '/admin/contacts' },
          { label: 'New Contact' },
        ]}
        actions={
          <Button variant="outline" leftIcon={<ArrowLeft size={16} />} asChild>
            <Link href="/admin/contacts">Back to Contacts</Link>
          </Button>
        }
      />
      <NewContactForm />
    </DashboardLayout>
  )
}
