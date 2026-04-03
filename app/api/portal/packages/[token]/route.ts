import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { setPackageSessionCookie } from '@/lib/pkg-session'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const pkg = await prisma.listingPackage.findUnique({
    where: { magicToken: token },
    include: {
      contact: { select: { id: true, firstName: true, lastName: true } },
      items: {
        include: { views: { select: { id: true }, take: 1 } },
        orderBy: { addedAt: 'asc' },
      },
    },
  })

  if (!pkg) return NextResponse.json({ error: 'Invalid or expired link' }, { status: 404 })

  const listingKeys = pkg.items.map(i => i.listingKey)
  const properties  = await prisma.resoProperty.findMany({
    where: { listingKey: { in: listingKeys } },
    select: {
      listingKey: true,
      streetNumber: true, streetDirPrefix: true, streetName: true, streetSuffix: true, streetDirSuffix: true, unitNumber: true,
      city: true, listPrice: true, bedroomsTotal: true, bathroomsTotalInteger: true,
      livingArea: true, media: true, standardStatus: true,
    },
  })

  const propMap = Object.fromEntries(properties.map(p => [p.listingKey, p]))
  const items   = pkg.items.map(item => ({ ...item, property: propMap[item.listingKey] ?? null }))

  await setPackageSessionCookie({ contactId: pkg.contactId, packageId: pkg.id })

  return NextResponse.json({
    data: { id: pkg.id, title: pkg.title, message: pkg.message, contact: pkg.contact, magicToken: pkg.magicToken, items },
  })
}
