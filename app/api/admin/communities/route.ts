import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const communities = await prisma.community.findMany({
    orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
  })
  return NextResponse.json({ data: communities })
}

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json() as {
      name: string
      slug: string
      description?: string | null
      imageUrl?: string | null
      city: string
      displayOrder?: number
    }

    const existing = await prisma.community.findUnique({ where: { slug: body.slug } })
    if (existing) return NextResponse.json({ error: 'Slug already taken' }, { status: 409 })

    const community = await prisma.community.create({
      data: {
        name:         body.name,
        slug:         body.slug,
        description:  body.description  ?? null,
        imageUrl:     body.imageUrl     ?? null,
        city:         body.city,
        displayOrder: body.displayOrder ?? 0,
      },
    })
    return NextResponse.json({ data: community }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
