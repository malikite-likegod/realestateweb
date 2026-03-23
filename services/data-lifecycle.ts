import { prisma } from '@/lib/prisma'

export async function purgeOldBehaviorEvents(): Promise<{ deleted: number }> {
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
  const { count } = await prisma.behaviorEvent.deleteMany({
    where: { occurredAt: { lt: cutoff } },
  })
  return { deleted: count }
}

export async function purgeOldSearchLogs(): Promise<{ deleted: number }> {
  const cutoff = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000)
  const { count } = await prisma.propertySearchLog.deleteMany({
    where: { occurredAt: { lt: cutoff } },
  })
  return { deleted: count }
}

export async function purgeContactData(contactId: string): Promise<{ deleted: Record<string, number> }> {
  const [behaviorEvents, searchLogs, savedListings, savedSearches, optLogs] = await Promise.all([
    prisma.behaviorEvent.deleteMany({ where: { contactId } }),
    prisma.propertySearchLog.deleteMany({ where: { contactId } }),
    prisma.contactSavedListing.deleteMany({ where: { contactId } }),
    prisma.savedSearch.deleteMany({ where: { contactId } }),
    prisma.communicationOptLog.deleteMany({ where: { contactId } }),
  ])
  return {
    deleted: {
      behaviorEvents:  behaviorEvents.count,
      searchLogs:      searchLogs.count,
      savedListings:   savedListings.count,
      savedSearches:   savedSearches.count,
      optLogs:         optLogs.count,
    },
  }
}

export async function purgeMlsData(): Promise<{ deleted: Record<string, number> }> {
  // Order matters: delete checkpoints and logs before properties/members/offices
  const [checkpoints, syncLogs, members, offices, properties] = await Promise.all([
    prisma.ampreSyncCheckpoint.deleteMany({}),
    prisma.resoSyncLog.deleteMany({}),
    prisma.resoMember.deleteMany({}),
    prisma.resoOffice.deleteMany({}),
    prisma.resoProperty.deleteMany({}),
  ])
  return {
    deleted: {
      checkpoints: checkpoints.count,
      syncLogs:    syncLogs.count,
      members:     members.count,
      offices:     offices.count,
      properties:  properties.count,
    },
  }
}
