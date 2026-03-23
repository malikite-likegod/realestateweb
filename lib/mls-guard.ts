import { prisma } from './prisma'

export class MlsDataError extends Error {}

export async function isMlsListing(listingId: string): Promise<boolean> {
  const count = await prisma.resoProperty.count({
    where: { listingKey: listingId },
  })
  return count > 0
}
