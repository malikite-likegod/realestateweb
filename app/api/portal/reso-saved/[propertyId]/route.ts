import { NextResponse } from 'next/server'
import { getContactSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function DELETE(_: Request, { params }: { params: Promise<{ propertyId: string }> }) {
  const contact = await getContactSession()
  if (!contact) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { propertyId } = await params
  await prisma.contactPropertyInterest.deleteMany({
    where: { contactId: contact.id, resoPropertyId: propertyId, source: 'portal_saved' },
  })
  return NextResponse.json({ ok: true })
}
