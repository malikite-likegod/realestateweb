/**
 * Top Agents Report Service
 *
 * Ranks listing agents (and their brokerages) by listing count within a
 * configurable list-price range / property type / lookback window, for the
 * dashboard "Top Agents" widget. The purpose is lead-gen research — seeing
 * which agents are generating the most listings in a market segment — so the
 * primary ranking counts every synced listing regardless of current status
 * (Active, Closed, Expired, etc.) and regardless of whether it ever closed.
 * A listing keeps counting after it stops being Active.
 *
 * This intentionally does NOT depend on closed-sale data: ClosePrice/CloseDate
 * and buyer-side fields are only ever available via the closed_property sync's
 * best-effort tiered $select (see services/reso/sync.ts), which may return
 * nothing at all depending on the account's PropTx tier. Relying on that for
 * the primary metric would make the whole widget unreliable, so it only uses
 * fields the standard IDX/DLA sync always populates: listPrice,
 * listAgentFullName, listOfficeName, propertySubType, listingContractDate.
 *
 * Grouping key is agent full name + office name (text), not a stable agent id —
 * PropTx's IDX/DLA feeds used by this project never populate a ListAgentKey, so
 * there's no reliable unique identifier to group on.
 *
 * Buyer-side ranking is a separate, secondary section scoped to Closed listings
 * only (buyers only exist once a deal closes) and is returned as null — not an
 * empty list — when no matched Closed listing has a non-null buyerAgentFullName,
 * since some MLS tiers don't expose that field at all.
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

  const priceFilter = (priceMin != null || priceMax != null)
    ? { listPrice: { ...(priceMin != null ? { gte: priceMin } : {}), ...(priceMax != null ? { lte: priceMax } : {}) } }
    : {}
  const typeFilter = propertyTypes.length > 0 ? { propertySubType: { in: propertyTypes } } : {}

  // Listing side: every synced listing regardless of status — a listing keeps
  // counting toward its agent even after it's no longer Active. Active listings
  // always count no matter how long ago they were first listed (they're
  // currently representing the agent's book of business right now); the
  // lookback window only bounds how far back a no-longer-Active listing can
  // still count, so old closed/expired deals eventually age out.
  const listings = await prisma.resoProperty.findMany({
    where: {
      OR: [
        { standardStatus: 'Active' },
        { listingContractDate: { gte: cutoff } },
      ],
      ...priceFilter,
      ...typeFilter,
    },
    select: { listAgentFullName: true, listOfficeName: true, listPrice: true },
  })
  const listingSide = rank(
    listings
      .filter(d => d.listPrice != null)
      .map(d => ({ agentName: d.listAgentFullName, officeName: d.listOfficeName, price: d.listPrice! })),
  )

  // Buyer side: secondary, best-effort — only exists for Closed listings, and
  // only when the account's PropTx tier actually returns BuyerAgentFullName.
  const closedListings = await prisma.resoProperty.findMany({
    where: {
      standardStatus: 'Closed',
      closeDate:      { gte: cutoff },
      ...priceFilter,
      ...typeFilter,
    },
    select: { buyerAgentFullName: true, buyerOfficeName: true, closePrice: true, listPrice: true },
  })
  const hasBuyerData = closedListings.some(d => !!d.buyerAgentFullName)
  const buyerSide = hasBuyerData
    ? rank(
        closedListings
          .filter(d => (d.closePrice ?? d.listPrice) != null)
          .map(d => ({ agentName: d.buyerAgentFullName, officeName: d.buyerOfficeName, price: (d.closePrice ?? d.listPrice)! })),
      )
    : null

  return {
    listingSide,
    buyerSide,
    settings: { priceMin, priceMax, propertyTypes, lookbackMonths },
  }
}
