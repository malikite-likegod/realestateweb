import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { DashboardLayout } from '@/components/dashboard'
import { PageHeader } from '@/components/layout'
import { DealPipeline } from '@/components/crm'
import { Button } from '@/components/ui'
import { Plus } from 'lucide-react'
import type { PipelineColumn, DealWithDetails } from '@/types'

export default async function DealsPage() {
  const session = await getSession()
  if (!session) return null

  const [stages, deals] = await Promise.all([
    prisma.stage.findMany({ orderBy: { order: 'asc' } }),
    prisma.deal.findMany({
      include: {
        stage: true,
        participants: { include: { contact: { select: { firstName: true, lastName: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  const pipeline: PipelineColumn[] = stages.map(stage => {
    const stageDeals = deals.filter(d => d.stageId === stage.id) as DealWithDetails[]
    return {
      stage,
      deals: stageDeals,
      total: stageDeals.reduce((sum, d) => sum + (d.value ?? 0), 0),
    }
  })

  return (
    <DashboardLayout user={session}>
      <PageHeader
        title="Deal Pipeline"
        subtitle={`${deals.length} active deals`}
        breadcrumbs={[{ label: 'Dashboard', href: '/admin/dashboard' }, { label: 'Deals' }]}
        actions={
          <Button variant="primary" leftIcon={<Plus size={16} />}>New Deal</Button>
        }
      />
      <DealPipeline columns={pipeline} />
    </DashboardLayout>
  )
}
