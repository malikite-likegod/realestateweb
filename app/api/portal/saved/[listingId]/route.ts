import { NextResponse } from 'next/server'
import { getContactSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function DELETE(_: Request, { params }: { params: Promise<{ listingId: string }> }) {
  const contact = await getContactSession()
  if (!contact) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { listingId } = await params
  await prisma.contactSavedListing.deleteMany({
    where: { contactId: contact.id, listingId },
  })

  return NextResponse.json({ message: 'Unsaved' })
}
