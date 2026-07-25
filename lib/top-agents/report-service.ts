/**
 * Top Agents Report Service
 *
 * Ranks agents (and their brokerages) by closed-deal count within a configurable
 * price range / property type / lookback window, for the dashboard "Top Agents"
 * widget. Intended for competitive research — seeing who's winning the most deals
 * in a given market segment.
 *
 * Grouping key is agent full name + office name (text), not a stable agent id —
 * PropTx's IDX/DLA feeds used by this project never populate a ListAgentKey, so
 * there's no reliable unique identifier to group on.
 *
 * Buyer-side ranking is only returned when at least one matched closed listing has
 * a non-null buyerAgentFullName — some MLS tiers don't expose that field at all
 * (see services/reso/sync.ts's syncClosedProperty tiered fallback).
 */

import { prisma } from '@/lib/prisma'

export type AgentRanking = {
  agentName:  string
  officeName: string | null
  dealCount:  number
  volume:     number
}

export type TopAgentsReport = {
  listingSide: AgentRanking[]
  buyerSide:   AgentRanking[] | null
  settings: {
    priceMin:       number | null
    priceMax:       number | null
    propertyTypes:  string[]
    lookbackMonths: number
  }
}

const TOP_N = 10

function rank(
  records: { agentName: string | null; officeName: string | null; price: number }[],
): AgentRanking[] {
  const byAgent = new Map<string, AgentRanking>()
  for (const r of records) {
    if (!r.agentName) continue
    const key = `${r.agentName}|${r.officeName ?? ''}`
    const existing = byAgent.get(key)
    if (existing) {
      existing.dealCount++
      existing.volume += r.price
    } else {
      byAgent.set(key, { agentName: r.agentName, officeName: r.officeName, dealCount: 1, volume: r.price })
    }
  }
  return [...byAgent.values()].sort((a, b) => b.dealCount - a.dealCount).slice(0, TOP_N)
}

export async function getTopAgentsReport(): Promise<TopAgentsReport> {
  const settingsRows = await prisma.siteSettings.findMany({
    where: { key: { in: ['top_agents_price_min', 'top_agents_price_max', 'top_agents_property_types', 'top_agents_lookback_months'] } },
  })
  const settingsMap: Record<string, string> = {}
  for (const r of settingsRows) settingsMap[r.key] = r.value

  const priceMin = settingsMap['top_agents_price_min'] ? parseFloat(settingsMap['top_agents_price_min']) : null
  const priceMax = settingsMap['top_agents_price_max'] ? parseFloat(settingsMap['top_agents_price_max']) : null
  const propertyTypes = settingsMap['top_agents_property_types']
    ? settingsMap['top_agents_property_types'].split(',').filter(Boolean)
    : []
  const lookbackMonths = settingsMap['top_agents_lookback_months'] ? parseInt(settingsMap['top_agents_lookback_months'], 10) : 12

  const cutoff = new Date()
  cutoff.setMonth(cutoff.getMonth() - lookbackMonths)

  const closedDeals = await prisma.resoProperty.findMany({
    where: {
      standardStatus: 'Closed',
      closeDate:      { gte: cutoff },
      ...(propertyTypes.length > 0 ? { propertySubType: { in: propertyTypes } } : {}),
    },
    select: {
      listAgentFullName:  true,
      listOfficeName:     true,
      buyerAgentFullName: true,
      buyerOfficeName:    true,
      closePrice:         true,
      listPrice:          true,
    },
  })

  const inPriceRange = closedDeals.filter(d => {
    const price = d.closePrice ?? d.listPrice
    if (price == null) return false
    if (priceMin != null && price < priceMin) return false
    if (priceMax != null && price > priceMax) return false
    return true
  })

  const listingSide = rank(
    inPriceRange.map(d => ({ agentName: d.listAgentFullName, officeName: d.listOfficeName, price: d.closePrice ?? d.listPrice! })),
  )

  const hasBuyerData = inPriceRange.some(d => !!d.buyerAgentFullName)
  const buyerSide = hasBuyerData
    ? rank(inPriceRange.map(d => ({ agentName: d.buyerAgentFullName, officeName: d.buyerOfficeName, price: d.closePrice ?? d.listPrice! })))
    : null

  return {
    listingSide,
    buyerSide,
    settings: { priceMin, priceMax, propertyTypes, lookbackMonths },
  }
}
