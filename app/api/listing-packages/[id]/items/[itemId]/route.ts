import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { id, itemId } = await params
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const item = await prisma.listingPackageItem.findFirst({ where: { id: itemId, packageId: id } })
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.listingPackageItem.delete({ where: { id: itemId } })
  return new Response(null, { status: 204 })
}
