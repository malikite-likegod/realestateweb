import { prisma } from '@/lib/prisma'
import { resoGetAll } from './client'
import type { ResoPropertyRaw, ResoSyncResult } from './types'

export async function syncResoListings(): Promise<ResoSyncResult> {
  const start  = Date.now()
  const result: ResoSyncResult = { added: 0, updated: 0, removed: 0, errors: [], durationMs: 0 }

  try {
    const raw = await resoGetAll<ResoPropertyRaw>('Property', "StandardStatus eq 'Active'")
    const incomingKeys = new Set(raw.map(r => r.ListingKey))

    for (const r of raw) {
      try {
        const data = {
          listingId:             r.ListingId             ?? null,
          standardStatus:        r.StandardStatus,
          propertyType:          r.PropertyType          ?? null,
          propertySubType:       r.PropertySubType       ?? null,
          listPrice:             r.ListPrice             ?? null,
          originalListPrice:     r.OriginalListPrice     ?? null,
          closePrice:            r.ClosePrice            ?? null,
          bedroomsTotal:         r.BedroomsTotal         ?? null,
          bathroomsTotalInteger: r.BathroomsTotalInteger ?? null,
          livingArea:            r.LivingArea            ?? null,
          lotSizeSquareFeet:     r.LotSizeAcres          ?? null,
          yearBuilt:             r.YearBuilt             ?? null,
          streetNumber:          r.StreetNumber          ?? null,
          streetName:            r.StreetName            ?? null,
          unitNumber:            r.UnitNumber            ?? null,
          city:                  r.City                  ?? '',
          stateOrProvince:       r.StateOrProvince       ?? '',
          postalCode:            r.PostalCode            ?? null,
          latitude:              r.Latitude              ?? null,
          longitude:             r.Longitude             ?? null,
          publicRemarks:         r.PublicRemarks         ?? null,
          media:                 r.Media ? JSON.stringify(r.Media) : null,
          listAgentKey:          r.ListAgentKey          ?? null,
          listOfficeKey:         r.ListOfficeKey         ?? null,
          listingContractDate:   r.ListingContractDate   ? new Date(r.ListingContractDate) : null,
          modificationTimestamp: r.ModificationTimestamp ? new Date(r.ModificationTimestamp) : null,
          lastSyncedAt:          new Date(),
          rawJson:               JSON.stringify(r),
        }

        const existing = await prisma.resoProperty.findUnique({ where: { listingKey: r.ListingKey } })
        if (existing) {
          await prisma.resoProperty.update({ where: { listingKey: r.ListingKey }, data })
          result.updated++
        } else {
          await prisma.resoProperty.create({ data: { ...data, listingKey: r.ListingKey } })
          result.added++
        }
      } catch (e) {
        result.errors.push(`${r.ListingKey}: ${e instanceof Error ? e.message : String(e)}`)
      }
    }

    // Mark listings no longer in feed as Closed
    const active   = await prisma.resoProperty.findMany({ where: { standardStatus: 'Active' }, select: { listingKey: true } })
    const toRemove = active.filter(p => !incomingKeys.has(p.listingKey))
    if (toRemove.length > 0) {
      await prisma.resoProperty.updateMany({
        where: { listingKey: { in: toRemove.map(p => p.listingKey) } },
        data:  { standardStatus: 'Closed' },
      })
      result.removed = toRemove.length
    }
  } catch (e) {
    result.errors.push(`Sync failed: ${e instanceof Error ? e.message : String(e)}`)
  }

  result.durationMs = Date.now() - start

  await prisma.resoSyncLog.create({
    data: {
      added:      result.added,
      updated:    result.updated,
      deleted:    result.removed,
      errors:     result.errors.length,
      notes:      result.errors.length ? result.errors.join('\n') : null,
      durationMs: result.durationMs,
    },
  })

  return result
}
