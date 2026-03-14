import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'

const updateSchema = z.object({
  firstName:  z.string().optional(),
  lastName:   z.string().optional(),
  email:      z.string().email().optional(),
  phone:      z.string().optional().nullable(),
  company:    z.string().optional().nullable(),
  jobTitle:   z.string().optional().nullable(),
  source:     z.string().optional(),
  status:     z.enum(['lead', 'prospect', 'client', 'past_client']).optional(),
  notes:      z.string().optional().nullable(),
  address:    z.string().optional().nullable(),
  city:       z.string().optional().nullable(),
  province:   z.string().optional().nullable(),
  postalCode: z.string().optional().nullable(),
  birthday:   z.string().optional().nullable(),
})

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const contact = await prisma.contact.findUnique({
    where: { id },
    include: {
      tags: { include: { tag: true } },
      activities: { orderBy: { occurredAt: 'desc' }, take: 20 },
      tasks: { orderBy: { createdAt: 'desc' } },
      notesList: { orderBy: { createdAt: 'desc' }, include: { user: { select: { name: true } } } },
      deals: { include: { deal: { include: { stage: true } } } },
    },
  })
  if (!contact) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ data: contact })
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const body = await request.json()
    const { birthday, ...rest } = updateSchema.parse(body)
    const data = {
      ...rest,
      ...(birthday !== undefined ? { birthday: birthday ? new Date(birthday) : null } : {}),
    }
    const contact = await prisma.contact.update({ where: { id }, data })
    return NextResponse.json({ data: contact })
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.errors }, { status: 400 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await prisma.contact.delete({ where: { id } })
  return NextResponse.json({ message: 'Deleted' })
}
