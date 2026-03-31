import { prisma } from '@/lib/prisma'
import { ampreGet } from './client'
import type { ResoPropertyRaw, ResoMediaRaw, ResoMemberRaw, ResoOfficeRaw, ResoSyncResult } from './types'

const BATCH_SIZE = 1000
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

function activeFilter(): string {
  return `StandardStatus eq 'Active'`
}

function combineFilters(...filters: (string | null)[]): string {
  return filters.filter(Boolean).map(f => `(${f})`).join(' and ')
}

// PropTx returns many fields as either a string or a string array.
// Flatten to a comma-joined string, or null for empty / missing values.
function toStr(v: string | string[] | null | undefined): string | null {
  if (v == null) return null
  if (Array.isArray(v)) return v.length > 0 ? v.join(', ') : null
  return v || null
}

// PropTx sometimes returns numeric fields as strings (e.g. GarageParkingSpaces).
// Parse to integer, returning null for missing / non-numeric values.
function toInt(v: number | string | null | undefined): number | null {
  if (v == null) return null
  const n = typeof v === 'string' ? parseInt(v, 10) : Math.round(v)
  return isNaN(n) ? null : n
}

// Same but for float fields.
function toFloat(v: number | string | null | undefined): number | null {
  if (v == null) return null
  const n = typeof v === 'string' ? parseFloat(v) : v
  return isNaN(n) ? null : n
}

// ─── IDX Property Sync ─────────────────────────────────────────────────────

const IDX_SELECT = [
  'ListingKey', 'StandardStatus', 'PropertyType', 'PropertySubType',
  'ListPrice', 'BedroomsTotal', 'BedroomsAboveGrade', 'BedroomsBelowGrade', 'BathroomsTotalInteger',
  'BuildingAreaTotal', 'LivingAreaRange', 'LotSizeArea', 'LotSizeUnits', 'LotWidth', 'LotDepth',
  'StreetNumber', 'StreetName', 'StreetSuffix', 'UnitNumber', 'UnparsedAddress',
  'TransactionType', 'City', 'CityRegion', 'CountyOrParish', 'StateOrProvince', 'PostalCode',
  'PublicRemarks', 'ListOfficeKey', 'ListOfficeName',
  'OriginalEntryTimestamp', 'ModificationTimestamp',
  // Interior
  'GarageParkingSpaces', 'ParkingTotal', 'ParkingFeatures',
  'KitchensTotal', 'KitchensAboveGrade', 'KitchensBelowGrade',
  'Basement', 'HeatSource', 'HeatType', 'Cooling', 'DenFamilyroomYN', 'FireplaceFeatures',
  // Exterior
  'ExteriorFeatures', 'Roof', 'FoundationDetails', 'PoolFeatures',
  'DirectionFaces', 'WaterfrontFeatures', 'WaterfrontYN',
  // Building
  'ArchitecturalStyle', 'LegalStories', 'ApproximateAge', 'ConstructionMaterials', 'Sewer', 'WaterSource',
  // Community
  'CrossStreet', 'AssociationAmenities',
  // Taxes & fees
  'TaxAnnualAmount', 'TaxYear', 'AssociationFee', 'AssociationFeeIncludes', 'AssessmentYear',
].join(',')

export async function syncIdxProperty(): Promise<ResoSyncResult> {
  const start         = Date.now()
  const syncStartedAt = new Date()  // used as stale-cleanup cutoff
  const result: ResoSyncResult = { added: 0, updated: 0, removed: 0, errors: [], durationMs: 0 }
  const syncType = 'idx_property'

  let { lastTimestamp, lastKey } = await loadCheckpoint(syncType)
  const wasFullScan = lastTimestamp.getTime() === EPOCH.getTime()
  let fullRun = false
  let page = 0

  console.log(`[idx_property] Starting sync from ${toODataTs(lastTimestamp)}`)

  try {
    while (true) {
      page++
      const batch = await ampreGet<ResoPropertyRaw>('idx', 'Property', {
        $filter:  combineFilters(cursorFilter('ModificationTimestamp', 'ListingKey', lastTimestamp, lastKey), activeFilter()),
        $orderby: 'ModificationTimestamp asc',
        $top:     BATCH_SIZE,
        $select:  IDX_SELECT,
      })

      const records = batch.value.filter(r => !!r.ModificationTimestamp)

      if (records.length > 0) {
        const now = new Date()
        const ops = records.map(r => {
          const data = {
            listingId:             r.ListingKey, // PropTx has no separate ListingId; ListingKey IS the MLS number
            standardStatus:        r.StandardStatus,
            propertyType:          r.PropertyType          ?? null,
            propertySubType:       r.PropertySubType       ?? null,
            listPrice:             toFloat(r.ListPrice),
            originalListPrice:     null,
            closePrice:            null,
            bedroomsTotal:         toInt(r.BedroomsTotal),
            bathroomsTotalInteger: toInt(r.BathroomsTotalInteger),
            bathroomsPartial:      null,
            livingArea:            toFloat(r.BuildingAreaTotal),
            sqftRange:             r.LivingAreaRange       ?? null,
            lotSizeSquareFeet:     toFloat(r.LotSizeArea),
            yearBuilt:             null,
            streetNumber:          r.StreetNumber          ?? null,
            streetName:            r.StreetName            ?? null,
            streetSuffix:          r.StreetSuffix          ?? null,
            unitNumber:            r.UnitNumber            ?? null,
            transactionType:       r.TransactionType       ?? null,
            city:                  r.City                  ?? '',
            stateOrProvince:       r.StateOrProvince       ?? '',
            postalCode:            r.PostalCode            ?? null,
            latitude:              null,
            longitude:             null,
            publicRemarks:         r.PublicRemarks         ?? null,
            media:                 null, // fetched separately from the Media resource
            listAgentKey:          null,
            listAgentName:         null, // populated by DLA sync
            listOfficeKey:         r.ListOfficeKey         ?? null,
            listOfficeName:        r.ListOfficeName        ?? null,
            listingContractDate:   r.OriginalEntryTimestamp ? new Date(r.OriginalEntryTimestamp) : null,
            modificationTimestamp: new Date(r.ModificationTimestamp!),
            lastSyncedAt:          now,
            // Interior
            flooring:              null, // not available in PropTx IDX
            garageSpaces:          toInt(r.GarageParkingSpaces),
            parkingTotal:          toInt(r.ParkingTotal),
            poolPrivateYN:         false,
            bedroomsPlus:          toInt(r.BedroomsBelowGrade),
            kitchensTotal:         toInt(r.KitchensTotal),
            kitchensPlusTotal:     toInt(r.KitchensBelowGrade),
            basement:              toStr(r.Basement),
            heatSource:            toStr(r.HeatSource),
            heatType:              toStr(r.HeatType),
            airConditioning:       toStr(r.Cooling),
            familyRoom:            r.DenFamilyroomYN != null ? (r.DenFamilyroomYN ? 'Yes' : 'No') : null,
            fireplaceFeatures:     toStr(r.FireplaceFeatures),
            // Exterior
            exteriorFeatures:      toStr(r.ExteriorFeatures),
            roof:                  toStr(r.Roof),
            foundationDetails:     toStr(r.FoundationDetails),
            parkingFeatures:       toStr(r.ParkingFeatures),
            poolFeatures:          toStr(r.PoolFeatures),
            frontingOn:            toStr(r.DirectionFaces),
            lotDepth:              toFloat(r.LotDepth),
            lotFront:              toFloat(r.LotWidth),
            waterFrontType:        toStr(r.WaterfrontFeatures),
            // Building
            style:                 toStr(r.ArchitecturalStyle),
            storiesTotal:          r.LegalStories != null ? String(r.LegalStories) : null,  // DB is String?
            approximateAge:        r.ApproximateAge        ?? null,
            constructionMaterials: toStr(r.ConstructionMaterials),
            sewer:                 toStr(r.Sewer),
            water:                 toStr(r.WaterSource),
            ownershipType:         null, // not available in PropTx IDX
            // Community
            community:             r.CityRegion            ?? null,
            municipality:          r.CountyOrParish        ?? null,
            crossStreet:           r.CrossStreet           ?? null,
            amenities:             toStr(r.AssociationAmenities),
            // Taxes & fees
            taxAnnualAmount:       toFloat(r.TaxAnnualAmount),
            taxYear:               toInt(r.TaxYear),
            maintenanceFee:        toFloat(r.AssociationFee),
            maintenanceFeeIncludes: toStr(r.AssociationFeeIncludes),
            assessmentYear:        toInt(r.AssessmentYear),
            inclusions:            null, // not available in PropTx IDX
            exclusions:            null, // not available in PropTx IDX
          }
          // Don't overwrite media on update — it's fetched separately by syncIdxMedia
          const { media: _media, ...updateData } = data
          return prisma.resoProperty.upsert({
            where:  { listingKey: r.ListingKey },
            update: updateData,
            create: { ...data, listingKey: r.ListingKey },
            select: { createdAt: true, updatedAt: true },
          })
        })

        try {
          const upserted = await prisma.$transaction(ops)
          for (const res of upserted) {
            // createdAt === updatedAt means the row was just inserted
            if (res.createdAt.getTime() === res.updatedAt.getTime()) {
              result.added++
            } else {
              result.updated++
            }
          }
        } catch (e) {
          const msg = `Batch page ${page}: ${e instanceof Error ? e.message : String(e)}`
          console.error(`[idx_property] ${msg}`)
          result.errors.push(msg)
        }

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

    // Mark active listings absent from this full run as Closed.
    // Uses syncStartedAt (not now-60s) so records processed early in a long
    // run are not incorrectly classified as stale.
    // Only fires on full completion — not on interrupted/rate-limited runs.
    if (fullRun && wasFullScan) {
      const stale = await prisma.resoProperty.findMany({
        where:  { standardStatus: 'Active', onDemand: false, lastSyncedAt: { lt: syncStartedAt } },
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
    const msg = `Sync failed: ${e instanceof Error ? e.message : String(e)}`
    console.error(`[idx_property] ${msg}`)
    result.errors.push(msg)
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
          return false
        }
        return true
      })

      if (records.length > 0) {
        const now = new Date()
        const ops = records.map(r => prisma.resoProperty.upsert({
          where:  { listingKey: r.ListingKey },
          update: {
            // DLA only writes its enriched fields — never touches IDX-owned fields
            mlsStatus:                r.MlsStatus                ? r.MlsStatus                : undefined,
            contractStatus:           r.ContractStatus           ? r.ContractStatus           : undefined,
            photosChangeTimestamp:    r.PhotosChangeTimestamp    ? new Date(r.PhotosChangeTimestamp)    : undefined,
            documentsChangeTimestamp: r.DocumentsChangeTimestamp ? new Date(r.DocumentsChangeTimestamp) : undefined,
            mediaChangeTimestamp:     r.MediaChangeTimestamp     ? new Date(r.MediaChangeTimestamp)     : undefined,
            listAgentFullName:        r.ListAgentFullName        ? r.ListAgentFullName        : undefined,
            listOfficeName:           r.ListOfficeName           ? r.ListOfficeName           : undefined,
            majorChangeTimestamp:     r.MajorChangeTimestamp     ? new Date(r.MajorChangeTimestamp)     : undefined,
            lastSyncedAt:             now,
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
            lastSyncedAt:             now,
          },
        }))
        try {
          await prisma.$transaction(ops)
          result.updated += records.length
        } catch (e) {
          result.errors.push(`Batch: ${e instanceof Error ? e.message : String(e)}`)
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
  'MemberStatus', 'OfficeKey', 'ModificationTimestamp', 'PhotosChangeTimestamp',
].join(',')

export async function syncVoxMember(): Promise<ResoSyncResult> {
  const start  = Date.now()
  const result: ResoSyncResult = { added: 0, updated: 0, removed: 0, errors: [], durationMs: 0 }

  // Member endpoint does not support ModificationTimestamp in $filter.
  // Paginate by MemberKey instead — fetch all members each run.
  let lastKey = '0'

  try {
    while (true) {
      const batch = await ampreGet<ResoMemberRaw>('vox', 'Member', {
        $filter:  `MemberKey gt '${lastKey.replace(/'/g, "''")}'`,
        $orderby: 'MemberKey asc',
        $top:     BATCH_SIZE,
        $select:  VOX_MEMBER_SELECT,
      })

      const records = batch.value.filter(r => !!r.MemberKey)

      if (records.length > 0) {
        const now = new Date()
        const ops = records.map(r => {
          const data = {
            memberFullName:        r.MemberFullName        ?? null,
            memberEmail:           r.MemberEmail           ?? null,
            memberMobilePhone:     r.MemberMobilePhone     ?? null,
            memberStatus:          r.MemberStatus          ?? null,
            officeKey:             r.OfficeKey             ?? null,
            modificationTimestamp: r.ModificationTimestamp ? new Date(r.ModificationTimestamp) : null,
            photosChangeTimestamp: r.PhotosChangeTimestamp ? new Date(r.PhotosChangeTimestamp) : null,
            lastSyncedAt:          now,
          }
          return prisma.resoMember.upsert({
            where:  { memberKey: r.MemberKey },
            update: data,
            create: { ...data, memberKey: r.MemberKey },
          })
        })
        try {
          await prisma.$transaction(ops)
          result.updated += records.length
        } catch (e) {
          result.errors.push(`Batch: ${e instanceof Error ? e.message : String(e)}`)
        }
        lastKey = records[records.length - 1].MemberKey
      }

      if (batch.value.length < BATCH_SIZE) break
    }
  } catch (e) {
    result.errors.push(`Sync failed: ${e instanceof Error ? e.message : String(e)}`)
  }

  result.durationMs = Date.now() - start
  await prisma.resoSyncLog.create({
    data: {
      syncType:   'vox_member',
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

  // Office endpoint does not support ModificationTimestamp in $filter.
  // Paginate by OfficeKey instead — fetch all offices each run (small set).
  let lastKey = '0'

  try {
    while (true) {
      const batch = await ampreGet<ResoOfficeRaw>('vox', 'Office', {
        $filter:  `OfficeKey gt '${lastKey.replace(/'/g, "''")}'`,
        $orderby: 'OfficeKey asc',
        $top:     BATCH_SIZE,
        $select:  VOX_OFFICE_SELECT,
      })

      const records = batch.value.filter(r => !!r.OfficeKey)

      if (records.length > 0) {
        const now = new Date()
        const ops = records.map(r => {
          const data = {
            officeName:            r.OfficeName            ?? null,
            officeEmail:           r.OfficeEmail           ?? null,
            officePhone:           r.OfficePhone           ?? null,
            modificationTimestamp: r.ModificationTimestamp ? new Date(r.ModificationTimestamp) : null,
            lastSyncedAt:          now,
          }
          return prisma.resoOffice.upsert({
            where:  { officeKey: r.OfficeKey },
            update: data,
            create: { ...data, officeKey: r.OfficeKey },
          })
        })
        try {
          await prisma.$transaction(ops)
          result.updated += records.length
        } catch (e) {
          result.errors.push(`Batch: ${e instanceof Error ? e.message : String(e)}`)
        }
      }

      if (records.length > 0) {
        lastKey = records[records.length - 1].OfficeKey
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

        // size preference: higher index = better quality
        const SIZE_RANK: Record<string, number> = {
          'Thumbnail': 0, 'Small': 1, 'Medium': 2, 'Large': 3, 'Largest': 4,
        }
        // bestMap: listingKey → Map<order, {url, sizeRank}>
        const bestMap = new Map<string, Map<number, { url: string; sizeRank: number }>>()

        for (const m of batch.value) {
          if (m.MediaStatus === 'Deleted' || !m.MediaURL || !m.ResourceRecordKey) continue
          const order    = m.Order ?? 0
          const sizeRank = SIZE_RANK[m.ImageSizeDescription ?? ''] ?? 2
          const byOrder  = bestMap.get(m.ResourceRecordKey) ?? new Map()
          const current  = byOrder.get(order)
          if (!current || sizeRank > current.sizeRank) {
            byOrder.set(order, { url: m.MediaURL, sizeRank })
          }
          bestMap.set(m.ResourceRecordKey, byOrder)
        }

        for (const [key, byOrder] of bestMap) {
          const items = Array.from(byOrder.entries()).map(([order, { url }]) => ({ url, order }))
          mediaMap.set(key, items)
        }
      } catch (e) {
        result.errors.push(`Batch ${i}: ${e instanceof Error ? e.message : String(e)}`)
        continue
      }

      // Write media for listings that had results
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

      // Mark listings with no photos as '[]' so they aren't re-fetched every run
      const withPhotos = new Set(mediaMap.keys())
      const noPhotoKeys = keysBatch.filter(k => !withPhotos.has(k))
      if (noPhotoKeys.length > 0) {
        await prisma.resoProperty.updateMany({
          where: { listingKey: { in: noPhotoKeys } },
          data:  { media: '[]' },
        })
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
      listingId:             r.ListingKey, // PropTx has no separate ListingId; ListingKey IS the MLS number
      standardStatus:        r.StandardStatus,
      propertyType:          r.PropertyType          ?? null,
      propertySubType:       r.PropertySubType       ?? null,
      listPrice:             r.ListPrice             ?? null,
      originalListPrice:     null,
      closePrice:            null,
      bedroomsTotal:         r.BedroomsTotal         ?? null,
      bathroomsTotalInteger: r.BathroomsTotalInteger ?? null,
      bathroomsPartial:      null,
      livingArea:            r.BuildingAreaTotal     ?? null,
      sqftRange:             r.LivingAreaRange       ?? null,
      lotSizeSquareFeet:     r.LotSizeArea           ?? null,
      yearBuilt:             null,
      streetNumber:          r.StreetNumber          ?? null,
      streetName:            r.StreetName            ?? null,
      streetSuffix:          r.StreetSuffix          ?? null,
      unitNumber:            r.UnitNumber            ?? null,
      transactionType:       r.TransactionType       ?? null,
      city:                  r.City                  ?? '',
      stateOrProvince:       r.StateOrProvince       ?? '',
      postalCode:            r.PostalCode            ?? null,
      latitude:              null,
      longitude:             null,
      publicRemarks:         r.PublicRemarks         ?? null,
      media:                 null,
      listAgentKey:          null,
      listAgentName:         null, // populated by DLA sync
      listOfficeKey:         r.ListOfficeKey         ?? null,
      listOfficeName:        r.ListOfficeName        ?? null,
      listingContractDate:   r.OriginalEntryTimestamp ? new Date(r.OriginalEntryTimestamp) : null,
      modificationTimestamp: r.ModificationTimestamp ? new Date(r.ModificationTimestamp) : null,
      lastSyncedAt:          new Date(),
      onDemand:              true,
      // Interior
      flooring:              null, // not available in PropTx IDX
      garageSpaces:          r.GarageParkingSpaces   ?? null,
      parkingTotal:          r.ParkingTotal          ?? null,
      poolPrivateYN:         false,
      bedroomsPlus:          r.BedroomsBelowGrade    ?? null,
      kitchensTotal:         r.KitchensTotal         ?? null,
      kitchensPlusTotal:     r.KitchensBelowGrade    ?? null,
      basement:              toStr(r.Basement),
      heatSource:            toStr(r.HeatSource),
      heatType:              toStr(r.HeatType),
      airConditioning:       toStr(r.Cooling),
      familyRoom:            r.DenFamilyroomYN != null ? (r.DenFamilyroomYN ? 'Yes' : 'No') : null,
      fireplaceFeatures:     toStr(r.FireplaceFeatures),
      // Exterior
      exteriorFeatures:      toStr(r.ExteriorFeatures),
      roof:                  toStr(r.Roof),
      foundationDetails:     toStr(r.FoundationDetails),
      parkingFeatures:       toStr(r.ParkingFeatures),
      poolFeatures:          toStr(r.PoolFeatures),
      frontingOn:            toStr(r.DirectionFaces),
      lotDepth:              r.LotDepth              ?? null,
      lotFront:              r.LotWidth              ?? null,
      waterFrontType:        toStr(r.WaterfrontFeatures),
      // Building
      style:                 toStr(r.ArchitecturalStyle),
      storiesTotal:          r.LegalStories != null ? String(r.LegalStories) : null,
      approximateAge:        r.ApproximateAge        ?? null,
      constructionMaterials: toStr(r.ConstructionMaterials),
      sewer:                 toStr(r.Sewer),
      water:                 toStr(r.WaterSource),
      ownershipType:         null, // not available in PropTx IDX
      // Community
      community:             r.CityRegion            ?? null,
      municipality:          r.CountyOrParish        ?? null,
      crossStreet:           r.CrossStreet           ?? null,
      amenities:             toStr(r.AssociationAmenities),
      // Taxes & fees
      taxAnnualAmount:       r.TaxAnnualAmount       ?? null,
      taxYear:               r.TaxYear               ?? null,
      maintenanceFee:        r.AssociationFee        ?? null,
      maintenanceFeeIncludes: toStr(r.AssociationFeeIncludes),
      assessmentYear:        r.AssessmentYear        ?? null,
      inclusions:            null, // not available in PropTx IDX
      exclusions:            null, // not available in PropTx IDX
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
