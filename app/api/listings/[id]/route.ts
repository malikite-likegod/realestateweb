import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const property = await prisma.property.findUnique({
    where: { id },
    include: { listings: true, showings: { orderBy: { scheduledAt: 'desc' } } },
  })
  if (!property) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ data: property })
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json()
  const property = await prisma.property.update({
    where: { id },
    data: {
      ...body,
      images: body.images ? JSON.stringify(body.images) : undefined,
      features: body.features ? JSON.stringify(body.features) : undefined,
    },
  })
  return NextResponse.json({ data: property })
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await prisma.property.delete({ where: { id } })
  return NextResponse.json({ message: 'Deleted' })
}
