import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

interface Props { params: Promise<{ id: string; searchId: string }> }

export async function DELETE(_req: Request, { params }: Props) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchId } = await params
  const search = await prisma.savedSearch.findUnique({ where: { id: searchId } })
  if (!search) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.savedSearch.delete({ where: { id: searchId } })
  return NextResponse.json({ success: true })
}
