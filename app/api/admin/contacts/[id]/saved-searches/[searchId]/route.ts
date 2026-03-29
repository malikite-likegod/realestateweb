import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; searchId: string }> }
) {
  const { id, searchId } = await params
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const search = await prisma.savedSearch.findFirst({ where: { id: searchId, contactId: id } })
  if (!search) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.savedSearch.delete({ where: { id: searchId } })
  return new Response(null, { status: 204 })
}
