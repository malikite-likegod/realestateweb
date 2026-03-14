/**
 * PipelineSummaryWidget
 *
 * Dashboard widget showing pipeline KPIs: total deals, total value,
 * weighted revenue, and deals closed this month.
 */

import Link from 'next/link'
import { ArrowRight, TrendingUp } from 'lucide-react'
import { Card } from '@/components/layout'
import type { PipelineReport } from '@/lib/pipeline/pipeline-service'

function fmt(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toLocaleString()}`
}

interface PipelineSummaryWidgetProps {
  report: PipelineReport
}

export function PipelineSummaryWidget({ report }: PipelineSummaryWidgetProps) {
  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-charcoal-900">Pipeline</h3>
        <Link href="/admin/deals" className="text-xs text-gold-600 hover:text-gold-700 font-medium flex items-center gap-1">
          View board <ArrowRight size={11} />
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-charcoal-50 p-3">
          <p className="text-xs text-charcoal-400 mb-0.5">Active Deals</p>
          <p className="text-xl font-semibold text-charcoal-900">{report.totalDeals}</p>
        </div>
        <div className="rounded-lg bg-charcoal-50 p-3">
          <p className="text-xs text-charcoal-400 mb-0.5">Total Value</p>
          <p className="text-xl font-semibold text-charcoal-900">{fmt(report.totalValue)}</p>
        </div>
        <div className="rounded-lg bg-gold-50 p-3">
          <p className="text-xs text-charcoal-400 mb-0.5">Weighted Revenue</p>
          <p className="text-xl font-semibold text-gold-700 flex items-center gap-1">
            <TrendingUp size={14} />
            {fmt(report.weightedRevenue)}
          </p>
        </div>
        <div className="rounded-lg bg-green-50 p-3">
          <p className="text-xs text-charcoal-400 mb-0.5">Closed This Month</p>
          <p className="text-xl font-semibold text-green-700">{report.closedThisMonth}</p>
          <p className="text-xs text-green-600">{fmt(report.closedValue)}</p>
        </div>
      </div>
    </Card>
  )
}
