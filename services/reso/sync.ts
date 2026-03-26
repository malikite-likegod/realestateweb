import { prisma } from '@/lib/prisma'
import { ampreGet } from './client'
import type { ResoPropertyRaw, ResoMediaRaw, ResoMemberRaw, ResoOfficeRaw, ResoSyncResult } from './types'

const BATCH_SIZE = 500
const EPOCH      = new Date('1970-01-01T00:00:00Z')

// ─── Checkpoint helpers ────────────────────────────────────────────────────

async function loadCheckpoint(syncType: string): Promise<{ lastTimestamp: Date; lastKey: string }> {
  const cp = await prisma.ampreSyncCheckpoint.findUnique({ where: { syncType } })
  return {
    lastTimestamp: cp?.lastTimestamp ?? EPOCH,
    lastKey:       cp?.lastKey       ?? '0',
  }
}

async function saveCheckpoint(syncType: string, lastTimestamp: Date, lastKey: string): Promise<void> {
  await prisma.ampreSyncCheckpoint.upsert({
    where:  { syncType },
    update: { lastTimestamp, lastKey },
    create: { syncType, lastTimestamp, lastKey },
  })
}

// ─── Cursor filter builder ─────────────────────────────────────────────────

function toODataTs(date: Date): string {
  // AMPRE requires DateTimeOffset without milliseconds
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z')
}

function cursorFilter(tsField: string, _keyField: string, lastTs: Date, _lastKey: string): string {
  return `${tsField} gt ${toODataTs(lastTs)}`
}

function brokerageFilter(): string | null {
  // ListOfficeName is not indexed as a filterable field on AMPRE — filter client-side instead
  return `StandardStatus eq 'Active'`
}

function matchesBrokerage(officeName: string | undefined): boolean {
  const name = process.env.AMPRE_BROKERAGE_NAME
  if (!name) return true   // no filter set — accept all
  return (officeName ?? '').trim().toUpperCase() === name.trim().toUpperCase()
}

function combineFilters(...filters: (string | null)[]): string {
  return filters.filter(Boolean).map(f => `(${f})`).join(' and ')
}

// ─── IDX Property Sync ─────────────────────────────────────────────────────

const IDX_SELECT = [
  'ListingKey', 'ListingId', 'StandardStatus', 'PropertyType', 'PropertySubType',
  'ListPrice', 'OriginalListPrice', 'ClosePrice', 'BedroomsTotal', 'BathroomsTotalInteger',
  'BuildingAreaTotal', 'LotSizeArea', 'LotSizeUnits', 'YearBuilt',
  'StreetNumber', 'StreetName', 'UnitNumber',
  'City', 'StateOrProvince', 'PostalCode', 'Latitude', 'Longitude', 'PublicRemarks',
  'ListAgentKey', 'ListAgentFullName', 'ListOfficeKey', 'ListOfficeName',
  'ListingContractDate', 'ModificationTimestamp',
].join(',')

export async function syncIdxProperty(): Promise<ResoSyncResult> {
  const start  = Date.now()
  const result: ResoSyncResult = { added: 0, updated: 0, removed: 0, errors: [], durationMs: 0 }
  const syncType = 'idx_property'

  let { lastTimestamp, lastKey } = await loadCheckpoint(syncType)
  let fullRun = false
  let page = 0

  console.log(`[idx_property] Starting sync from ${toODataTs(lastTimestamp)}`)

  try {
    while (true) {
      page++
      console.log(`[idx_property] Fetching page ${page} (added=${result.added} updated=${result.updated})`)
      const batch = await ampreGet<ResoPropertyRaw>('idx', 'Property', {
        $filter:  combineFilters(cursorFilter('ModificationTimestamp', 'ListingKey', lastTimestamp, lastKey), brokerageFilter()),
        $orderby: 'ModificationTimestamp asc',
        $top:     BATCH_SIZE,
        $select:  IDX_SELECT,
      })

      const records = batch.value.filter(r => {
        if (!r.ModificationTimestamp) {
          console.warn(`[idx_property] Skipping ${r.ListingKey} — null ModificationTimestamp`)
          return false
        }
        if (!matchesBrokerage(r.ListOfficeName)) return false
        return true
      })

      for (const r of records) {
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
            livingArea:            r.BuildingAreaTotal     ?? null,
            lotSizeSquareFeet:     r.LotSizeArea           ?? null,
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
            media:                 null, // fetched separately from the Media resource
            listAgentKey:          r.ListAgentKey          ?? null,
            listAgentName:         r.ListAgentFullName     ?? null,
            listOfficeKey:         r.ListOfficeKey         ?? null,
            listOfficeName:        r.ListOfficeName        ?? null,
            listingContractDate:   r.ListingContractDate ? new Date(r.ListingContractDate) : null,
            modificationTimestamp: new Date(r.ModificationTimestamp!),
            lastSyncedAt:          new Date(),
            rawJson:               JSON.stringify(r),
          }

          const existing = await prisma.resoProperty.findUnique({ where: { listingKey: r.ListingKey }, select: { id: true } })
          await prisma.resoProperty.upsert({
            where:  { listingKey: r.ListingKey },
            update: data,
            create: { ...data, listingKey: r.ListingKey },
          })
          if (existing) { result.updated++ } else { result.added++ }
        } catch (e) {
          result.errors.push(`${r.ListingKey}: ${e instanceof Error ? e.message : String(e)}`)
        }
      }

      if (records.length > 0) {
        const last = records[records.length - 1]
        lastTimestamp = new Date(last.ModificationTimestamp!)
        lastKey       = last.ListingKey
        await saveCheckpoint(syncType, lastTimestamp, lastKey)
      }

      if (batch.value.length < BATCH_SIZE) {
        fullRun = true
        break
      }
    }

    // Mark active listings absent from this full run as Closed
    // Only fires on full completion — not on interrupted/rate-limited runs
    if (fullRun) {
      const cutoff = new Date(Date.now() - 60_000) // listings not synced in last 60s
      const stale = await prisma.resoProperty.findMany({
        where:  { standardStatus: 'Active', onDemand: false, lastSyncedAt: { lt: cutoff } },
        select: { listingKey: true },
      })
      if (stale.length > 0) {
        // Chunk to stay under PostgreSQL's 32 767 bind-variable limit
        const CHUNK = 1000
        for (let i = 0; i < stale.length; i += CHUNK) {
          const keys = stale.slice(i, i + CHUNK).map(p => p.listingKey)
          await prisma.resoProperty.updateMany({
            where: { listingKey: { in: keys } },
            data:  { standardStatus: 'Closed' },
          })
        }
        result.removed = stale.length
      }
    }
  } catch (e) {
    result.errors.push(`Sync failed: ${e instanceof Error ? e.message : String(e)}`)
  }

  result.durationMs = Date.now() - start
  console.log(`[idx_property] Done — added=${result.added} updated=${result.updated} removed=${result.removed} errors=${result.errors.length} duration=${result.durationMs}ms`)

  await prisma.resoSyncLog.create({
    data: {
      syncType,
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

// ─── DLA Property Sync ─────────────────────────────────────────────────────

const DLA_SELECT = [
  'ListingKey', 'ModificationTimestamp',
  'MlsStatus', 'ContractStatus',
  'PhotosChangeTimestamp', 'DocumentsChangeTimestamp', 'MediaChangeTimestamp',
  'ListAgentFullName', 'ListOfficeName', 'MajorChangeTimestamp',
].join(',')

export async function syncDlaProperty(): Promise<ResoSyncResult> {
  const start  = Date.now()
  const result: ResoSyncResult = { added: 0, updated: 0, removed: 0, errors: [], durationMs: 0 }
  const syncType = 'dla_property'

  let { lastTimestamp, lastKey } = await loadCheckpoint(syncType)

  try {
    while (true) {
      const batch = await ampreGet<ResoPropertyRaw>('dla', 'Property', {
        $filter:  cursorFilter('ModificationTimestamp', 'ListingKey', lastTimestamp, lastKey),
        $orderby: 'ModificationTimestamp asc',
        $top:     BATCH_SIZE,
        $select:  DLA_SELECT,
      })

      const records = batch.value.filter(r => {
        if (!r.ModificationTimestamp) {
          console.warn(`[dla_property] Skipping ${r.ListingKey} — null ModificationTimestamp`)
          return false
        }
        return true
      })

      for (const r of records) {
        try {
          // DLA only writes its enriched fields — never touches IDX-owned fields
          await prisma.resoProperty.upsert({
            where:  { listingKey: r.ListingKey },
            update: {
              mlsStatus:                r.MlsStatus                ? r.MlsStatus                : undefined,
              contractStatus:           r.ContractStatus           ? r.ContractStatus           : undefined,
              photosChangeTimestamp:    r.PhotosChangeTimestamp    ? new Date(r.PhotosChangeTimestamp)    : undefined,
              documentsChangeTimestamp: r.DocumentsChangeTimestamp ? new Date(r.DocumentsChangeTimestamp) : undefined,
              mediaChangeTimestamp:     r.MediaChangeTimestamp     ? new Date(r.MediaChangeTimestamp)     : undefined,
              listAgentFullName:        r.ListAgentFullName        ? r.ListAgentFullName        : undefined,
              listOfficeName:           r.ListOfficeName           ? r.ListOfficeName           : undefined,
              majorChangeTimestamp:     r.MajorChangeTimestamp     ? new Date(r.MajorChangeTimestamp)     : undefined,
              lastSyncedAt:             new Date(),
            },
            create: {
              listingKey:               r.ListingKey,
              city:                     '',
              stateOrProvince:          '',
              standardStatus:           'Active',
              mlsStatus:                r.MlsStatus                ?? null,
              contractStatus:           r.ContractStatus           ?? null,
              photosChangeTimestamp:    r.PhotosChangeTimestamp    ? new Date(r.PhotosChangeTimestamp)    : null,
              documentsChangeTimestamp: r.DocumentsChangeTimestamp ? new Date(r.DocumentsChangeTimestamp) : null,
              mediaChangeTimestamp:     r.MediaChangeTimestamp     ? new Date(r.MediaChangeTimestamp)     : null,
              listAgentFullName:        r.ListAgentFullName        ?? null,
              listOfficeName:           r.ListOfficeName           ?? null,
              majorChangeTimestamp:     r.MajorChangeTimestamp     ? new Date(r.MajorChangeTimestamp)     : null,
              lastSyncedAt:             new Date(),
            },
          })
          result.updated++
        } catch (e) {
          result.errors.push(`${r.ListingKey}: ${e instanceof Error ? e.message : String(e)}`)
        }
      }

      if (records.length > 0) {
        const last = records[records.length - 1]
        lastTimestamp = new Date(last.ModificationTimestamp!)
        lastKey       = last.ListingKey
        await saveCheckpoint(syncType, lastTimestamp, lastKey)
      }

      if (batch.value.length < BATCH_SIZE) break
    }
  } catch (e) {
    result.errors.push(`Sync failed: ${e instanceof Error ? e.message : String(e)}`)
  }

  result.durationMs = Date.now() - start
  await prisma.resoSyncLog.create({
    data: {
      syncType,
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

// ─── VOX Member Sync ───────────────────────────────────────────────────────

const VOX_MEMBER_SELECT = [
  'MemberKey', 'MemberFullName', 'MemberEmail', 'MemberMobilePhone',
  'MemberStatus', 'OfficeKey', 'OfficeName', 'ModificationTimestamp', 'PhotosChangeTimestamp',
].join(',')

export async function syncVoxMember(): Promise<ResoSyncResult> {
  const start  = Date.now()
  const result: ResoSyncResult = { added: 0, updated: 0, removed: 0, errors: [], durationMs: 0 }
  const syncType = 'vox_member'

  let { lastTimestamp, lastKey } = await loadCheckpoint(syncType)

  try {
    while (true) {
      const batch = await ampreGet<ResoMemberRaw>('vox', 'Member', {
        $filter:  cursorFilter('ModificationTimestamp', 'MemberKey', lastTimestamp, lastKey),
        $orderby: 'ModificationTimestamp asc',
        $top:     BATCH_SIZE,
        $select:  VOX_MEMBER_SELECT,
      })

      const records = batch.value.filter(r => {
        if (!r.ModificationTimestamp) {
          console.warn(`[vox_member] Skipping ${r.MemberKey} — null ModificationTimestamp`)
          return false
        }
        return true
      })

      for (const r of records) {
        try {
          const data = {
            memberFullName:        r.MemberFullName        ?? null,
            memberEmail:           r.MemberEmail           ?? null,
            memberMobilePhone:     r.MemberMobilePhone     ?? null,
            memberStatus:          r.MemberStatus          ?? null,
            officeKey:             r.OfficeKey             ?? null,
            officeName:            r.OfficeName            ?? null,
            modificationTimestamp: new Date(r.ModificationTimestamp!),
            photosChangeTimestamp: r.PhotosChangeTimestamp ? new Date(r.PhotosChangeTimestamp) : null,
            lastSyncedAt:          new Date(),
            rawJson:               JSON.stringify(r),
          }
          const existing = await prisma.resoMember.findUnique({ where: { memberKey: r.MemberKey }, select: { id: true } })
          await prisma.resoMember.upsert({
            where:  { memberKey: r.MemberKey },
            update: data,
            create: { ...data, memberKey: r.MemberKey },
          })
          if (existing) { result.updated++ } else { result.added++ }
        } catch (e) {
          result.errors.push(`${r.MemberKey}: ${e instanceof Error ? e.message : String(e)}`)
        }
      }

      if (records.length > 0) {
        const last = records[records.length - 1]
        lastTimestamp = new Date(last.ModificationTimestamp!)
        lastKey       = last.MemberKey
        await saveCheckpoint(syncType, lastTimestamp, lastKey)
      }

      if (batch.value.length < BATCH_SIZE) break
    }
  } catch (e) {
    result.errors.push(`Sync failed: ${e instanceof Error ? e.message : String(e)}`)
  }

  result.durationMs = Date.now() - start
  await prisma.resoSyncLog.create({
    data: {
      syncType,
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

// ─── VOX Office Sync ───────────────────────────────────────────────────────

const VOX_OFFICE_SELECT = [
  'OfficeKey', 'OfficeName', 'OfficeEmail', 'OfficePhone', 'ModificationTimestamp',
].join(',')

export async function syncVoxOffice(): Promise<ResoSyncResult> {
  const start  = Date.now()
  const result: ResoSyncResult = { added: 0, updated: 0, removed: 0, errors: [], durationMs: 0 }
  const syncType = 'vox_office'

  let { lastTimestamp, lastKey } = await loadCheckpoint(syncType)

  try {
    while (true) {
      const batch = await ampreGet<ResoOfficeRaw>('vox', 'Office', {
        $filter:  cursorFilter('ModificationTimestamp', 'OfficeKey', lastTimestamp, lastKey),
        $orderby: 'ModificationTimestamp asc',
        $top:     BATCH_SIZE,
        $select:  VOX_OFFICE_SELECT,
      })

      const records = batch.value.filter(r => {
        if (!r.ModificationTimestamp) {
          console.warn(`[vox_office] Skipping ${r.OfficeKey} — null ModificationTimestamp`)
          return false
        }
        return true
      })

      for (const r of records) {
        try {
          const data = {
            officeName:            r.OfficeName            ?? null,
            officeEmail:           r.OfficeEmail           ?? null,
            officePhone:           r.OfficePhone           ?? null,
            modificationTimestamp: new Date(r.ModificationTimestamp!),
            lastSyncedAt:          new Date(),
            rawJson:               JSON.stringify(r),
          }
          const existing = await prisma.resoOffice.findUnique({ where: { officeKey: r.OfficeKey }, select: { id: true } })
          await prisma.resoOffice.upsert({
            where:  { officeKey: r.OfficeKey },
            update: data,
            create: { ...data, officeKey: r.OfficeKey },
          })
          if (existing) { result.updated++ } else { result.added++ }
        } catch (e) {
          result.errors.push(`${r.OfficeKey}: ${e instanceof Error ? e.message : String(e)}`)
        }
      }

      if (records.length > 0) {
        const last = records[records.length - 1]
        lastTimestamp = new Date(last.ModificationTimestamp!)
        lastKey       = last.OfficeKey
        await saveCheckpoint(syncType, lastTimestamp, lastKey)
      }

      if (batch.value.length < BATCH_SIZE) break
    }
  } catch (e) {
    result.errors.push(`Sync failed: ${e instanceof Error ? e.message : String(e)}`)
  }

  result.durationMs = Date.now() - start
  await prisma.resoSyncLog.create({
    data: {
      syncType,
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

// ─── IDX Media Sync ────────────────────────────────────────────────────────
//
// Fetches photo URLs only for listing keys already in the local DB, using
// ResourceRecordKey in (...) so we never scan the full Media feed.

const MEDIA_KEY_BATCH = 10   // small batches to avoid AMPRE server timeout
const MEDIA_SELECT    = 'MediaKey,ResourceRecordKey,MediaURL,Order,MediaStatus,ImageSizeDescription'

export async function syncIdxMedia(): Promise<ResoSyncResult> {
  const start  = Date.now()
  const result: ResoSyncResult = { added: 0, updated: 0, removed: 0, errors: [], durationMs: 0 }

  try {
    // Only fetch media for listings that don't have it yet
    const localProps = await prisma.resoProperty.findMany({
      where:  { media: null },
      select: { listingKey: true },
    })
    const allKeys = localProps.map(p => p.listingKey)

    console.log(`[idx_media] Fetching media for ${allKeys.length} listings`)

    for (let i = 0; i < allKeys.length; i += MEDIA_KEY_BATCH) {
      const keysBatch = allKeys.slice(i, i + MEDIA_KEY_BATCH)
      const inList    = keysBatch.map(k => `'${k.replace(/'/g, "''")}'`).join(',')

      const mediaMap = new Map<string, { url: string; order: number }[]>()

      try {
        const batch = await ampreGet<ResoMediaRaw>('idx', 'Media', {
          $filter:  `ResourceRecordKey in (${inList})`,
          $orderby: 'ResourceRecordKey,Order',
          $top:     10000,
          $select:  MEDIA_SELECT,
        })

        for (const m of batch.value) {
          if (m.MediaStatus === 'Deleted' || !m.MediaURL || !m.ResourceRecordKey) continue
          // Prefer 'Largest' size — skip smaller variants if a larger one exists
          const existing = mediaMap.get(m.ResourceRecordKey) ?? []
          existing.push({ url: m.MediaURL, order: m.Order ?? 0 })
          mediaMap.set(m.ResourceRecordKey, existing)
        }
      } catch (e) {
        result.errors.push(`Batch ${i}: ${e instanceof Error ? e.message : String(e)}`)
        continue
      }

      for (const [listingKey, items] of mediaMap) {
        try {
          const sorted = items.sort((a, b) => a.order - b.order)
          await prisma.resoProperty.updateMany({
            where: { listingKey },
            data:  { media: JSON.stringify(sorted) },
          })
          result.updated++
        } catch (e) {
          result.errors.push(`${listingKey}: ${e instanceof Error ? e.message : String(e)}`)
        }
      }
    }
  } catch (e) {
    result.errors.push(`Media sync failed: ${e instanceof Error ? e.message : String(e)}`)
  }

  result.durationMs = Date.now() - start
  await prisma.resoSyncLog.create({
    data: {
      syncType:   'idx_media',
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

// ─── On-demand single listing fetch ───────────────────────────────────────
//
// Used when a visitor views a listing not in the local DB (e.g. a competitor
// listing linked from search results). Fetches from AMPRE IDX, caches in DB
// with onDemand=true so the bulk sync stale-check ignores it.

export async function fetchPropertyOnDemand(listingKey: string): Promise<boolean> {
  try {
    const batch = await ampreGet<ResoPropertyRaw>('idx', 'Property', {
      $filter: `ListingKey eq '${listingKey.replace(/'/g, "''")}'`,
      $top:    1,
      $select: IDX_SELECT,
    })
    const r = batch.value[0]
    if (!r) return false

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
      livingArea:            r.BuildingAreaTotal     ?? null,
      lotSizeSquareFeet:     r.LotSizeArea           ?? null,
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
      media:                 null,
      listAgentKey:          r.ListAgentKey          ?? null,
      listAgentName:         r.ListAgentFullName     ?? null,
      listOfficeKey:         r.ListOfficeKey         ?? null,
      listOfficeName:        r.ListOfficeName        ?? null,
      listingContractDate:   r.ListingContractDate ? new Date(r.ListingContractDate) : null,
      modificationTimestamp: r.ModificationTimestamp ? new Date(r.ModificationTimestamp) : null,
      lastSyncedAt:          new Date(),
      onDemand:              true,
      rawJson:               JSON.stringify(r),
    }

    await prisma.resoProperty.upsert({
      where:  { listingKey },
      update: data,
      create: { ...data, listingKey },
    })
    return true
  } catch (e) {
    console.error(`[onDemand] Failed to fetch ${listingKey}:`, e)
    return false
  }
}

// ─── Legacy export (backward compat for existing route.ts) ────────────────

/** @deprecated Use the type-specific sync functions */
export async function syncResoListings(): Promise<ResoSyncResult> {
  return syncIdxProperty()
}
