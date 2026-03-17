/**
 * Automation Manager (/admin/automation)
 *
 * Tabbed page with:
 *   1. Drip Campaigns — create / list / toggle sequences with enrollment counts
 *   2. Automation Rules — create / list event-triggered rules
 *   3. Job Queue — real-time view of pending/failed background jobs + manual trigger
 */

import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { DashboardLayout } from '@/components/dashboard'
import { PageHeader } from '@/components/layout'
import { AutomationManager } from '@/components/crm/AutomationManager'

export default async function AutomationPage() {
  const session = await getSession()
  if (!session) return null

  const [campaigns, specialEvents, rules, jobStats] = await Promise.all([
    prisma.automationSequence.findMany({
      where:   { trigger: { not: 'special_event' } },
      include: {
        steps:       { orderBy: { order: 'asc' } },
        enrollments: { where: { status: 'active' }, select: { id: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.automationSequence.findMany({
      where:   { trigger: 'special_event' },
      include: {
        steps:       { orderBy: { order: 'asc' } },
        enrollments: { where: { status: 'active' }, select: { id: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.automationRule.findMany({ orderBy: { createdAt: 'desc' } }),
    Promise.all([
      prisma.jobQueue.count({ where: { status: 'pending' } }),
      prisma.jobQueue.count({ where: { status: 'failed'  } }),
      prisma.jobQueue.findMany({
        where:   { status: { in: ['pending', 'failed'] } },
        orderBy: { runAt: 'asc' },
        take:    30,
      }),
    ]).then(([pending, failed, jobs]) => ({ pending, failed, jobs })),
  ])

  return (
    <DashboardLayout user={session}>
      <PageHeader
        title="Automation Manager"
        subtitle="Drip campaigns, event rules, and background job processing"
        breadcrumbs={[{ label: 'Dashboard', href: '/admin/dashboard' }, { label: 'Automation' }]}
      />
      <AutomationManager
        initialCampaigns={campaigns.map(c => ({
          ...c,
          activeEnrollments: c.enrollments.length,
          steps: c.steps.map(s => ({ ...s, config: JSON.parse(s.config) })),
        }))}
        initialSpecialEvents={specialEvents.map(c => ({
          ...c,
          activeEnrollments: c.enrollments.length,
          steps: c.steps.map(s => ({ ...s, config: JSON.parse(s.config) })),
        }))}
        initialRules={rules}
        initialJobStats={jobStats}
      />
    </DashboardLayout>
  )
}
