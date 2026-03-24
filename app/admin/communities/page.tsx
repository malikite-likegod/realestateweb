import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { DashboardLayout } from '@/components/dashboard'
import { PageHeader } from '@/components/layout'
import { Button } from '@/components/ui'
import { Plus } from 'lucide-react'
import Link from 'next/link'
import { CommunitiesTable } from '@/components/admin/CommunitiesTable'

export default async function CommunitiesManagerPage() {
  const session = await getSession()
  if (!session) redirect('/admin/login')

  const communities = await prisma.community.findMany({
    orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
  })

  // SQLite does not support mode: 'insensitive'; PostgreSQL requires it.
  const isRelationalDB = !process.env.DATABASE_URL?.startsWith('file:')

  // Fetch listing counts in parallel
  const counts = await Promise.all(
    communities.map(c =>
      prisma.property.count({
        where: {
          city:     (isRelationalDB ? { contains: c.city, mode: 'insensitive' } : { contains: c.city }) as { contains: string },
          status:   'active',
          listings: { some: { publishedAt: { not: null } } },
        },
      })
    )
  )

  const rows = communities.map((c, i) => ({ ...c, listingCount: counts[i] }))

  return (
    <DashboardLayout user={session}>
      <PageHeader
        title="Communities"
        subtitle={`${communities.length} communities`}
        breadcrumbs={[
          { label: 'Dashboard',    href: '/admin/dashboard' },
          { label: 'Communities' },
        ]}
        actions={
          <Button variant="primary" leftIcon={<Plus size={16} />} asChild>
            <Link href="/admin/communities/new">Add Community</Link>
          </Button>
        }
      />
      <CommunitiesTable communities={rows} />
    </DashboardLayout>
  )
}
