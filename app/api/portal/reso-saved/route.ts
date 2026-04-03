import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getContactSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const contact = await getContactSession()
  if (!contact) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const interests = await prisma.contactPropertyInterest.findMany({
    where:   { contactId: contact.id, source: 'portal_saved' },
    include: { resoProperty: { select: {
      id: true, listingKey: true, standardStatus: true,
      propertyType: true, propertySubType: true, transactionType: true,
      listPrice: true, bedroomsTotal: true, bathroomsTotalInteger: true,
      garageSpaces: true, livingArea: true,
      streetNumber: true, streetDirPrefix: true, streetName: true, streetSuffix: true, streetDirSuffix: true, unitNumber: true,
      city: true, stateOrProvince: true, postalCode: true,
      media: true, listAgentFullName: true, listOfficeName: true,
    } } },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ data: interests.map(i => ({ ...i.resoProperty, isSaved: true })) })
}

export async function POST(request: Request) {
  const contact = await getContactSession()
  if (!contact) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { resoPropertyId } = z.object({ resoPropertyId: z.string().min(1) }).parse(await request.json())
    const exists = await prisma.resoProperty.findUnique({ where: { id: resoPropertyId }, select: { id: true } })
    if (!exists) return NextResponse.json({ error: 'Property not found' }, { status: 404 })

    await prisma.contactPropertyInterest.upsert({
      where:  { contactId_resoPropertyId: { contactId: contact.id, resoPropertyId } },
      create: { contactId: contact.id, resoPropertyId, source: 'portal_saved' },
      update: { source: 'portal_saved' },
    })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
