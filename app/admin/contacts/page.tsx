import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { DashboardLayout } from '@/components/dashboard'
import { PageHeader } from '@/components/layout'
import { ContactTable, ContactFilters } from '@/components/crm'
import { Button } from '@/components/ui'
import type { ContactWithTags } from '@/types'
import Link from 'next/link'
import { UserPlus, Upload } from 'lucide-react'
import { Suspense } from 'react'

interface Props {
  searchParams: Promise<{ status?: string }>
}

export default async function ContactsPage({ searchParams }: Props) {
  const session = await getSession()
  if (!session) return null

  const { status } = await searchParams

  const where = status ? { status } : undefined

  const contacts = await prisma.contact.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: {
      tags:   { include: { tag: true } },
      phones: { orderBy: { createdAt: 'asc' } },
    },
  }) as ContactWithTags[]

  return (
    <DashboardLayout user={session}>
      <PageHeader
        title="Contacts"
        subtitle={`${contacts.length}${status ? ` ${status.replace('_', ' ')}` : ''} contacts`}
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
      <Suspense>
        <ContactFilters />
      </Suspense>
      <ContactTable contacts={contacts} />
    </DashboardLayout>
  )
}
