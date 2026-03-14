import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { DashboardLayout } from '@/components/dashboard'
import { PageHeader } from '@/components/layout'
import { ContactTable } from '@/components/crm'
import { Button } from '@/components/ui'
import type { ContactWithTags } from '@/types'
import Link from 'next/link'
import { UserPlus, Upload } from 'lucide-react'

export default async function ContactsPage() {
  const session = await getSession()
  if (!session) return null

  const contacts = await prisma.contact.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: { tags: { include: { tag: true } } },
  }) as ContactWithTags[]

  return (
    <DashboardLayout user={session}>
      <PageHeader
        title="Contacts"
        subtitle={`${contacts.length} contacts`}
        breadcrumbs={[{ label: 'Dashboard', href: '/admin/dashboard' }, { label: 'Contacts' }]}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" leftIcon={<Upload size={16} />} asChild>
              <Link href="/admin/contacts/import">Import Contacts</Link>
            </Button>
            <Button variant="primary" leftIcon={<UserPlus size={16} />} asChild>
              <Link href="/admin/contacts/new">Add Contact</Link>
            </Button>
          </div>
        }
      />
      <ContactTable contacts={contacts} />
    </DashboardLayout>
  )
}
