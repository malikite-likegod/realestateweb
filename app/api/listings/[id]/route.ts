import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'

const patchSchema = z.object({
  title:          z.string().min(1).max(500).optional(),
  price:          z.number().nonnegative().optional(),
  address:        z.string().max(500).optional(),
  city:           z.string().max(200).optional(),
  bedrooms:       z.number().int().nonnegative().optional(),
  bathrooms:      z.number().nonnegative().optional(),
  sqft:           z.number().nonnegative().optional(),
  propertyType:   z.string().max(100).optional(),
  listingType:    z.string().max(100).optional(),
  status:         z.string().max(100).optional(),
  description:    z.string().max(10000).optional(),
  latitude:       z.number().optional(),
  longitude:      z.number().optional(),
  images:         z.array(z.string().url()).optional(),
  features:       z.array(z.string()).optional(),
})

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
  try {
    const body = patchSchema.parse(await request.json())
    const property = await prisma.property.update({
      where: { id },
      data: {
        ...body,
        images:   body.images   ? JSON.stringify(body.images)   : undefined,
        features: body.features ? JSON.stringify(body.features) : undefined,
      },
    })
    return NextResponse.json({ data: property })
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.errors }, { status: 400 })
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await prisma.property.delete({ where: { id } })
  return NextResponse.json({ message: 'Deleted' })
}
