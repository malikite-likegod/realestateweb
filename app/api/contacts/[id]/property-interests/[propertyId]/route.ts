import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

interface Params { params: Promise<{ id: string; propertyId: string }> }

export async function DELETE(_req: Request, { params }: Params) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: contactId, propertyId: resoPropertyId } = await params

  await prisma.contactPropertyInterest.deleteMany({
    where: { contactId, resoPropertyId },
  })

  return NextResponse.json({ success: true })
}
