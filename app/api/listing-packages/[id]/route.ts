import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const pkg = await prisma.listingPackage.findUnique({
    where: { id },
    include: {
      items: {
        include: {
          views: { orderBy: { viewedAt: 'desc' }, take: 1, select: { viewedAt: true, durationSec: true } },
        },
      },
    },
  })

  if (!pkg) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ data: pkg })
}
