import { getSession }      from '@/lib/auth'
import { prisma }          from '@/lib/prisma'
import { DashboardLayout } from '@/components/dashboard'
import { PageHeader }      from '@/components/layout'
import { BulkEmailWizard } from '@/components/crm'
import type { ContactWithTags, Tag } from '@/types'

interface Props {
  searchParams: Promise<{ contactIds?: string }>
}

export default async function BulkEmailPage({ searchParams }: Props) {
  const session = await getSession()
  if (!session) return null

  const { contactIds: rawIds } = await searchParams
  const preSelectedIds = rawIds ? rawIds.split(',').filter(Boolean) : []

  const [contacts, tags] = await Promise.all([
    prisma.contact.findMany({
      orderBy: { firstName: 'asc' },
      take: 500,
      include: {
        tags:   { include: { tag: true } },
        phones: { orderBy: { createdAt: 'asc' } },
      },
    }) as Promise<ContactWithTags[]>,
    prisma.tag.findMany({ orderBy: { name: 'asc' } }) as Promise<Tag[]>,
  ])

  return (
    <DashboardLayout user={session}>
      <PageHeader
        title="Bulk Email"
        subtitle="Send a personalized email to multiple contacts"
        breadcrumbs={[
          { label: 'Dashboard', href: '/admin/dashboard' },
          { label: 'Contacts',  href: '/admin/contacts'  },
          { label: 'Bulk Email' },
        ]}
      />
      <BulkEmailWizard
        contacts={contacts}
        tags={tags}
        preSelectedIds={preSelectedIds}
      />
    </DashboardLayout>
  )
}
