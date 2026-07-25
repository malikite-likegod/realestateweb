/**
 * TopAgentsWidget
 *
 * Dashboard widget ranking agents (and their brokerages) by closed-deal count
 * within the price range / property types / lookback window configured in
 * Settings. For competitive research — seeing who's winning the most deals.
 */

import Link from 'next/link'
import { ArrowRight, Trophy } from 'lucide-react'
import { Card } from '@/components/layout'
import type { AgentRanking, TopAgentsReport } from '@/lib/top-agents/report-service'

function fmt(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toLocaleString()}`
}

function describeFilters(settings: TopAgentsReport['settings']): string {
  const parts: string[] = []
  if (settings.priceMin != null || settings.priceMax != null) {
    parts.push(`${settings.priceMin != null ? fmt(settings.priceMin) : 'Any'}–${settings.priceMax != null ? fmt(settings.priceMax) : 'Any'}`)
  }
  parts.push(settings.propertyTypes.length > 0 ? settings.propertyTypes.join(', ') : 'All property types')
  parts.push(`last ${settings.lookbackMonths} month${settings.lookbackMonths === 1 ? '' : 's'}`)
  return parts.join(' · ')
}

function RankingTable({ rankings, emptyLabel }: { rankings: AgentRanking[]; emptyLabel: string }) {
  if (rankings.length === 0) {
    return <p className="text-sm text-charcoal-400 py-6 text-center">{emptyLabel}</p>
  }
  return (
    <table className="w-full text-sm">
      <tbody>
        {rankings.map((r, i) => (
          <tr key={`${r.agentName}|${r.officeName}`} className="border-b border-charcoal-100 last:border-0">
            <td className="py-2 pr-2 w-6 text-charcoal-400 font-medium">{i + 1}</td>
            <td className="py-2 pr-2">
              <p className="font-medium text-charcoal-900">{r.agentName}</p>
              {r.officeName && <p className="text-xs text-charcoal-400">{r.officeName}</p>}
            </td>
            <td className="py-2 pr-2 text-right text-charcoal-900 font-semibold whitespace-nowrap">{r.dealCount} deals</td>
            <td className="py-2 text-right text-charcoal-500 whitespace-nowrap">{fmt(r.volume)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

interface TopAgentsWidgetProps {
  report: TopAgentsReport
}

export function TopAgentsWidget({ report }: TopAgentsWidgetProps) {
  return (
    <Card>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Trophy size={16} className="text-gold-500" />
          <h3 className="font-semibold text-charcoal-900">Top Agents</h3>
        </div>
        <Link href="/admin/settings" className="text-xs text-gold-600 hover:text-gold-700 font-medium flex items-center gap-1">
          Configure <ArrowRight size={11} />
        </Link>
      </div>
      <p className="text-xs text-charcoal-400 mb-4">{describeFilters(report.settings)}</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h4 className="text-xs font-semibold text-charcoal-500 uppercase tracking-wide mb-1">Listing Agents</h4>
          <RankingTable rankings={report.listingSide} emptyLabel="No closed deals match these filters yet." />
        </div>
        <div>
          <h4 className="text-xs font-semibold text-charcoal-500 uppercase tracking-wide mb-1">Buyer&rsquo;s Agents</h4>
          {report.buyerSide === null ? (
            <p className="text-sm text-charcoal-400 py-6 text-center">
              Buyer&rsquo;s agent data isn&rsquo;t available from your MLS feed for these deals.
            </p>
          ) : (
            <RankingTable rankings={report.buyerSide} emptyLabel="No closed deals match these filters yet." />
          )}
        </div>
      </div>
    </Card>
  )
}
