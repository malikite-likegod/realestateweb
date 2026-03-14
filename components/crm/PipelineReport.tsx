'use client'

/**
 * PipelineReport
 *
 * Displays a summary card + per-stage breakdown table below the Kanban board.
 * Data comes from GET /api/pipeline/report.
 */

import { useState, useEffect } from 'react'
import { TrendingUp, DollarSign, CheckCircle, Clock } from 'lucide-react'
import { formatPrice } from '@/lib/utils'
import type { PipelineReport as Report } from '@/lib/pipeline/pipeline-service'

interface PipelineReportProps {
  initialReport: Report
}

export function PipelineReport({ initialReport }: PipelineReportProps) {
  const [report, setReport] = useState<Report>(initialReport)

  // Refresh after any board interaction (simple polling every 30s)
  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const res  = await fetch('/api/pipeline/report')
        const json = await res.json()
        if (json.data) setReport(json.data)
      } catch { /* silent */ }
    }, 30_000)
    return () => clearInterval(id)
  }, [])

  const statCards = [
    { label: 'Total Pipeline Value', value: formatPrice(report.totalValue),      icon: <DollarSign size={16} />, color: 'text-gold-600' },
    { label: 'Weighted Revenue',     value: formatPrice(report.weightedRevenue), icon: <TrendingUp  size={16} />, color: 'text-blue-600' },
    { label: 'Closed This Month',    value: report.closedThisMonth.toString(),   icon: <CheckCircle size={16} />, color: 'text-green-600' },
    { label: 'Closed Value MTD',     value: formatPrice(report.closedValue),     icon: <DollarSign  size={16} />, color: 'text-green-600' },
  ]

  return (
    <div className="mt-8 flex flex-col gap-6">
      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(card => (
          <div key={card.label} className="rounded-xl border border-charcoal-100 bg-white p-4 flex items-start gap-3">
            <div className={`mt-0.5 ${card.color}`}>{card.icon}</div>
            <div>
              <p className="text-xl font-bold text-charcoal-900">{card.value}</p>
              <p className="text-xs text-charcoal-400 mt-0.5">{card.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Per-stage breakdown table */}
      <div className="rounded-xl border border-charcoal-100 bg-white overflow-hidden">
        <div className="px-5 py-3 border-b border-charcoal-100">
          <h3 className="text-sm font-semibold text-charcoal-900">Stage Breakdown</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-charcoal-100 text-xs text-charcoal-400 uppercase tracking-wide">
                <th className="px-5 py-3 text-left font-medium">Stage</th>
                <th className="px-5 py-3 text-right font-medium">Deals</th>
                <th className="px-5 py-3 text-right font-medium">Value</th>
                <th className="px-5 py-3 text-right font-medium">Weighted</th>
                <th className="px-5 py-3 text-right font-medium">Avg Days</th>
                <th className="px-5 py-3 text-right font-medium">Conversion</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-charcoal-50">
              {report.stageReports.map(sr => (
                <tr key={sr.stage.id} className="hover:bg-charcoal-50 transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ background: sr.stage.color }} />
                      <span className="font-medium text-charcoal-900">{sr.stage.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-right text-charcoal-700">{sr.dealCount}</td>
                  <td className="px-5 py-3 text-right font-medium text-charcoal-900">
                    {sr.totalValue > 0 ? formatPrice(sr.totalValue) : '—'}
                  </td>
                  <td className="px-5 py-3 text-right text-charcoal-600">
                    {sr.weightedValue > 0 ? formatPrice(sr.weightedValue) : '—'}
                  </td>
                  <td className="px-5 py-3 text-right text-charcoal-500">
                    <span className="flex items-center justify-end gap-1">
                      <Clock size={11} />
                      {sr.avgDaysInStage > 0 ? `${sr.avgDaysInStage}d` : '—'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-16 h-1.5 rounded-full bg-charcoal-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-green-500"
                          style={{ width: `${sr.conversionRate}%` }}
                        />
                      </div>
                      <span className="text-charcoal-700 font-medium w-8 text-right">
                        {sr.conversionRate}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
