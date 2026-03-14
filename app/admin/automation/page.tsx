import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { DashboardLayout } from '@/components/dashboard'
import { PageHeader } from '@/components/layout'
import { Card } from '@/components/layout'
import { Badge, Button, Switch } from '@/components/ui'
import { Plus, Zap } from 'lucide-react'

export default async function AutomationPage() {
  const session = await getSession()
  if (!session) return null

  const sequences = await prisma.automationSequence.findMany({
    include: { steps: { orderBy: { order: 'asc' } } },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <DashboardLayout user={session}>
      <PageHeader
        title="Automation Sequences"
        subtitle="Automate your lead nurturing and follow-up workflows"
        breadcrumbs={[{ label: 'Dashboard', href: '/admin/dashboard' }, { label: 'Automation' }]}
        actions={<Button variant="primary" leftIcon={<Plus size={16} />}>New Sequence</Button>}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {sequences.length === 0 ? (
          <Card className="lg:col-span-2">
            <div className="flex flex-col items-center gap-4 py-12 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-charcoal-100">
                <Zap size={24} className="text-charcoal-400" />
              </div>
              <h3 className="font-serif text-xl font-bold text-charcoal-900">No Automation Sequences Yet</h3>
              <p className="text-charcoal-400 max-w-sm">Create automated email sequences, task assignments, and follow-up workflows to nurture your leads.</p>
              <Button variant="primary" leftIcon={<Plus size={16} />}>Create First Sequence</Button>
            </div>
          </Card>
        ) : sequences.map(seq => (
          <Card key={seq.id}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-semibold text-charcoal-900">{seq.name}</h3>
                <p className="text-xs text-charcoal-400 mt-0.5">Trigger: {seq.trigger.replace('_', ' ')}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={seq.isActive ? 'success' : 'default'}>{seq.isActive ? 'Active' : 'Paused'}</Badge>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              {seq.steps.map((step, i) => (
                <div key={step.id} className="flex items-center gap-3 text-sm">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-charcoal-100 text-xs font-medium text-charcoal-600 shrink-0">{i + 1}</span>
                  <span className="text-charcoal-700 capitalize">{step.type.replace('_', ' ')}</span>
                  {step.delayMinutes > 0 && <span className="text-xs text-charcoal-400">+{step.delayMinutes}m delay</span>}
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </DashboardLayout>
  )
}
