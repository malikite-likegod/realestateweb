import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { slugify } from '@/lib/utils'
import { sendWebhook } from '@/services/ai/webhooks'

const listingSchema = z.object({
  title:         z.string().min(1),
  description:   z.string().optional(),
  propertyType:  z.string().optional(),
  listingType:   z.string().optional(),
  price:         z.number(),
  bedrooms:      z.number().optional(),
  bathrooms:     z.number().optional(),
  sqft:          z.number().optional(),
  address:       z.string(),
  city:          z.string(),
  province:      z.string().optional(),
  postalCode:    z.string().optional(),
  latitude:      z.number().optional(),
  longitude:     z.number().optional(),
  images:        z.array(z.string()).optional(),
  features:      z.array(z.string()).optional(),
  status:        z.string().optional(),
  featured:      z.boolean().optional(),
})

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') ?? '1')
  const status = searchParams.get('status') ?? 'active'

  const [total, properties] = await Promise.all([
    prisma.property.count({ where: { status } }),
    prisma.property.findMany({
      where: { status },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * 20,
      take: 20,
      include: { listings: { where: { featured: true }, take: 1 } },
    }),
  ])

  return NextResponse.json({ data: properties, total, page })
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const data = listingSchema.parse(body)

    const property = await prisma.property.create({
      data: {
        ...data,
        images: data.images ? JSON.stringify(data.images) : null,
        features: data.features ? JSON.stringify(data.features) : null,
        listedAt: new Date(),
        listings: {
          create: {
            slug: slugify(`${data.title}-${data.address}`),
            featured: data.featured ?? false,
          },
        },
      },
      include: { listings: true },
    })

    await sendWebhook('new_listing', { propertyId: property.id, title: property.title })

    return NextResponse.json({ data: property }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.errors }, { status: 400 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
