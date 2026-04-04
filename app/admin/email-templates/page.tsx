import { redirect }              from 'next/navigation'
import { getSession }            from '@/lib/auth'
import { prisma }                from '@/lib/prisma'
import { DashboardLayout }       from '@/components/dashboard'
import { PageHeader }            from '@/components/layout'
import { EmailTemplateManager }  from '@/components/crm/EmailTemplateManager'
import type { EmailTemplate }    from '@/components/crm/EmailTemplateManager'

export const metadata = { title: 'Email Templates' }

export default async function EmailTemplatesPage() {
  const session = await getSession()
  if (!session) redirect('/admin/login')

  const raw = await prisma.emailTemplate.findMany({
    where:   { isActive: true },
    orderBy: { updatedAt: 'desc' },
  })

  // Serialize dates for the client component
  const templates: EmailTemplate[] = raw.map(t => ({
    id:        t.id,
    name:      t.name,
    subject:   t.subject,
    body:      t.body,
    category:  t.category,
    isActive:  t.isActive,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  }))

  return (
    <DashboardLayout user={session}>
      <PageHeader
        title="Email Templates"
        subtitle="Create and manage reusable HTML email templates for bulk campaigns and automation"
        breadcrumbs={[
          { label: 'Dashboard', href: '/admin/dashboard' },
          { label: 'Email Templates' },
        ]}
      />
      <EmailTemplateManager initialTemplates={templates} />
    </DashboardLayout>
  )
}
