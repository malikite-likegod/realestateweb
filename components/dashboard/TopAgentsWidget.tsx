/**
 * TopAgentsWidget
 *
 * Dashboard widget ranking listing agents (and their brokerages) by listing
 * count within the list-price range / property types / lookback window
 * configured in Settings — a lead-gen research tool, so it counts every
 * synced listing regardless of status (a listing keeps counting after it's
 * no longer active). The buyer's-agent section is a separate, best-effort
 * breakdown scoped to Closed listings, since buyer-agent data only exists
 * once a deal closes and isn't guaranteed to be available from every feed.
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
  parts.push(`all active, plus inactive from the last ${settings.lookbackMonths} month${settings.lookbackMonths === 1 ? '' : 's'}`)
  return parts.join(' · ')
}

function diagnoseEmptyListingSide(d: TopAgentsReport['diagnostics']): string {
  if (d.totalListingsSynced === 0) {
    return 'No listings have been synced at all yet. Run the MLS sync (Settings → MLS Sync) and confirm your AMPRE credentials are configured.'
  }
  if (d.matchingStatusOrLookback === 0) {
    return `${d.totalListingsSynced} listing(s) synced, but none are Active and none were listed within the lookback window. Try a longer lookback window in Settings.`
  }
  if (d.matchingAfterPriceFilter === 0) {
    return `${d.matchingStatusOrLookback} listing(s) are Active or within the lookback window, but none fall inside your price range. Double check the min/max are full dollar amounts (e.g. 500000, not 500).`
  }
  if (d.matchingAfterTypeFilter === 0) {
    return `${d.matchingAfterPriceFilter} listing(s) match your price range, but none match the property types you selected. Try clearing the property type filter in Settings.`
  }
  if (d.matchingWithAgentName === 0) {
    return `${d.matchingAfterTypeFilter} listing(s) match your filters, but none have a listing agent name on file yet — that's populated by the DLA sync pass. Check Settings → MLS Sync to confirm DLA sync has run.`
  }
  return `${d.matchingAfterTypeFilter} listing(s) match your filters and ${d.matchingWithAgentName} have an agent name, but they didn't group into a ranked result — this shouldn't happen.`
}

function DiagnosticsPanel({ diagnostics }: { diagnostics: TopAgentsReport['diagnostics'] }) {
  return (
    <p className="text-xs text-charcoal-400 bg-charcoal-50 rounded-lg px-3 py-2 mt-2">
      {diagnoseEmptyListingSide(diagnostics)}
    </p>
  )
}

function RankingTable({ rankings, unitLabel, emptyLabel }: { rankings: AgentRanking[]; unitLabel: string; emptyLabel: string }) {
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
            <td className="py-2 pr-2 text-right text-charcoal-900 font-semibold whitespace-nowrap">{r.dealCount} {unitLabel}</td>
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
          <RankingTable rankings={report.listingSide} unitLabel="listings" emptyLabel="No listings match these filters yet." />
          {report.listingSide.length === 0 && <DiagnosticsPanel diagnostics={report.diagnostics} />}
        </div>
        <div>
          <h4 className="text-xs font-semibold text-charcoal-500 uppercase tracking-wide mb-1">Buyer&rsquo;s Agents</h4>
          {report.buyerSide === null ? (
            <p className="text-sm text-charcoal-400 py-6 text-center">
              Buyer&rsquo;s agent data isn&rsquo;t available from your MLS feed for these deals.
            </p>
          ) : (
            <RankingTable rankings={report.buyerSide} unitLabel="closed deals" emptyLabel="No closed deals match these filters yet." />
          )}
        </div>
      </div>
    </Card>
  )
}
