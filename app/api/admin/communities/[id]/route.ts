import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

interface Props { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Props) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const community = await prisma.community.findUnique({ where: { id } })
  if (!community) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ data: community })
}

export async function PUT(request: Request, { params }: Props) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  // Verify the record exists before updating
  const existing = await prisma.community.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  try {
    const body = await request.json() as {
      name: string
      slug: string
      description?: string | null
      imageUrl?: string | null
      city: string
      displayOrder?: number
    }

    // Check slug uniqueness, excluding this record
    const slugConflict = await prisma.community.findFirst({
      where: { slug: body.slug, NOT: { id } },
    })
    if (slugConflict) return NextResponse.json({ error: 'Slug already taken' }, { status: 409 })

    const community = await prisma.community.update({
      where: { id },
      data: {
        name:         body.name,
        slug:         body.slug,
        description:  body.description  ?? null,
        imageUrl:     body.imageUrl     ?? null,
        city:         body.city,
        displayOrder: body.displayOrder ?? 0,
      },
    })
    return NextResponse.json({ data: community })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}

export async function DELETE(_req: Request, { params }: Props) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  try {
    await prisma.community.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
