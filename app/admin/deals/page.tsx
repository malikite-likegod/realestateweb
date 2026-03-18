/**
 * Deals Pipeline Page (/admin/deals)
 *
 * Renders the Kanban board + reporting panel below it.
 * Server component fetches all data; DealPipeline is the client DnD layer.
 */

import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getPipelineReport } from '@/lib/pipeline/pipeline-service'
import { DashboardLayout } from '@/components/dashboard'
import { PageHeader } from '@/components/layout'
import { PipelineReport } from '@/components/crm'
import { PipelineMoveHandler } from '@/components/crm/PipelineMoveHandler'
import type { PipelineColumn, DealWithDetails } from '@/types'

export default async function DealsPage() {
  const session = await getSession()
  if (!session) redirect('/admin/login')

  const [stages, deals, report] = await Promise.all([
    prisma.stage.findMany({ orderBy: { order: 'asc' } }),
    prisma.deal.findMany({
      include: {
        stage:        true,
        assignee:     { select: { id: true, name: true, avatarUrl: true } },
        participants: { include: { contact: { select: { firstName: true, lastName: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    getPipelineReport(),
  ])

  const pipeline: PipelineColumn[] = stages.map(stage => {
    const stageDeals = deals.filter(d => d.stageId === stage.id) as unknown as DealWithDetails[]
    return {
      stage,
      deals:  stageDeals,
      total:  stageDeals.reduce((sum, d) => sum + (d.value ?? 0), 0),
    }
  })

  return (
    <DashboardLayout user={session}>
      <PageHeader
        title="Deal Pipeline"
        subtitle={`${deals.length} active deal${deals.length !== 1 ? 's' : ''}`}
        breadcrumbs={[{ label: 'Dashboard', href: '/admin/dashboard' }, { label: 'Deals' }]}
      />

      {/* PipelineMoveHandler owns the PATCH call and renders DealPipeline internally */}
      <PipelineMoveHandler columns={pipeline} stages={stages} />

      {/* Reporting panel */}
      <PipelineReport initialReport={report} />
    </DashboardLayout>
  )
}
