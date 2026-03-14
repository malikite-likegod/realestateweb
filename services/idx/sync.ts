import { prisma } from '@/lib/prisma'
import { fetchActiveListings } from './client'
import { parseIdxListing } from './parser'
import type { IdxSyncResult } from './types'

export async function syncIdxListings(): Promise<IdxSyncResult> {
  const startTime = Date.now()
  const result: IdxSyncResult = { added: 0, updated: 0, removed: 0, errors: [], durationMs: 0 }

  try {
    const rawListings = await fetchActiveListings()
    const incomingIds = new Set(rawListings.map(l => l.listingID))

    for (const raw of rawListings) {
      try {
        const data = parseIdxListing(raw)
        const existing = await prisma.idxProperty.findUnique({ where: { idxId: raw.listingID } })

        if (existing) {
          await prisma.idxProperty.update({ where: { idxId: raw.listingID }, data })
          result.updated++
        } else {
          await prisma.idxProperty.create({ data })
          result.added++
        }
      } catch (e) {
        result.errors.push(`${raw.listingID}: ${e instanceof Error ? e.message : String(e)}`)
      }
    }

    // Mark listings no longer in feed as removed
    const active = await prisma.idxProperty.findMany({ where: { status: 'active' }, select: { idxId: true } })
    const toRemove = active.filter(p => !incomingIds.has(p.idxId))

    if (toRemove.length > 0) {
      await prisma.idxProperty.updateMany({
        where: { idxId: { in: toRemove.map(p => p.idxId) } },
        data: { status: 'removed' },
      })
      result.removed = toRemove.length
    }
  } catch (e) {
    result.errors.push(`Sync failed: ${e instanceof Error ? e.message : String(e)}`)
  }

  const durationMs = Date.now() - startTime
  result.durationMs = durationMs

  // Log the sync
  await prisma.idxUpdate.create({
    data: {
      added: result.added,
      updated: result.updated,
      removed: result.removed,
      errors: result.errors.length ? result.errors.join('\n') : null,
      duration: durationMs,
    },
  })

  return result
}
