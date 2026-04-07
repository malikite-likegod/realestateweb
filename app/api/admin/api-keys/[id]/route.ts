import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const key = await prisma.apiKey.findUnique({ where: { id }, select: { userId: true } })
  if (!key) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (key.userId !== session.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await prisma.apiKey.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
