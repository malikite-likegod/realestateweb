/**
 * Pipeline Service
 *
 * Reporting and analytics functions for the deal pipeline.
 * Returns data consumed by the pipeline board header stats and the
 * reporting panel below the board.
 */

import { prisma } from '@/lib/prisma'

// ─── Types ───────────────────────────────────────────────────────────────────

export type StageReport = {
  stage:           { id: string; name: string; color: string; order: number }
  dealCount:       number
  totalValue:      number
  weightedValue:   number   // sum of (value × probability / 100)
  avgDaysInStage:  number   // average days deals spend in this stage
  conversionRate:  number   // % of deals that moved from this stage to the next
}

export type PipelineReport = {
  totalDeals:       number
  totalValue:       number
  weightedRevenue:  number
  closedThisMonth:  number
  closedValue:      number
  stageReports:     StageReport[]
}

// ─── Report calculation ──────────────────────────────────────────────────────

export async function getPipelineReport(): Promise<PipelineReport> {
  const now       = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const [stages, deals, history] = await Promise.all([
    prisma.stage.findMany({ orderBy: { order: 'asc' } }),
    prisma.deal.findMany({
      include: { stage: true },
    }),
    prisma.dealStageHistory.findMany({ include: { stage: true } }),
  ])

  // Closed this month
  const closedDeals = deals.filter(
    d => d.closedAt && d.closedAt >= monthStart,
  )

  const stageReports: StageReport[] = stages.map((stage, idx) => {
    const stageDeals = deals.filter(d => d.stageId === stage.id)
    const totalValue   = stageDeals.reduce((s, d) => s + (d.value ?? 0), 0)
    const weightedValue = stageDeals.reduce(
      (s, d) => s + (d.value ?? 0) * (d.probability / 100),
      0,
    )

    // Average days-in-stage from history (completed entries only)
    const completedEntries = history.filter(
      h => h.stageId === stage.id && h.exitedAt,
    )
    const avgDaysInStage =
      completedEntries.length === 0
        ? 0
        : completedEntries.reduce((sum, h) => {
            const days = (h.exitedAt!.getTime() - h.enteredAt.getTime()) / 86_400_000
            return sum + days
          }, 0) / completedEntries.length

    // Conversion rate: deals that moved past this stage
    const nextStage = stages[idx + 1]
    const movedForward = nextStage
      ? history.filter(
          h => h.stageId === stage.id && h.exitedAt !== null,
        ).length
      : stageDeals.filter(d => d.closedAt !== null).length

    const enteredStage = history.filter(h => h.stageId === stage.id).length
    const conversionRate = enteredStage === 0 ? 0 : Math.round((movedForward / enteredStage) * 100)

    return {
      stage:          { id: stage.id, name: stage.name, color: stage.color, order: stage.order },
      dealCount:      stageDeals.length,
      totalValue,
      weightedValue,
      avgDaysInStage: Math.round(avgDaysInStage * 10) / 10,
      conversionRate,
    }
  })

  return {
    totalDeals:      deals.length,
    totalValue:      deals.reduce((s, d) => s + (d.value ?? 0), 0),
    weightedRevenue: deals.reduce((s, d) => s + (d.value ?? 0) * (d.probability / 100), 0),
    closedThisMonth: closedDeals.length,
    closedValue:     closedDeals.reduce((s, d) => s + (d.value ?? 0), 0),
    stageReports,
  }
}
