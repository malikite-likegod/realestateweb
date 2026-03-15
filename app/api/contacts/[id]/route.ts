import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'

const phoneSchema = z.object({
  id:        z.string().optional(),
  label:     z.string().default('mobile'),
  number:    z.string(),
  isPrimary: z.boolean().default(false),
})

const addressSchema = z.object({
  id:         z.string().optional(),
  label:      z.string().default('home'),
  street:     z.string().optional().nullable(),
  city:       z.string().optional().nullable(),
  province:   z.string().optional().nullable(),
  postalCode: z.string().optional().nullable(),
  country:    z.string().default('CA'),
  isPrimary:  z.boolean().default(false),
})

const updateSchema = z.object({
  firstName:  z.string().optional(),
  lastName:   z.string().optional(),
  email:      z.string().email().optional().nullable(),
  company:    z.string().optional().nullable(),
  jobTitle:   z.string().optional().nullable(),
  source:     z.string().optional().nullable(),
  status:     z.enum(['lead', 'prospect', 'client', 'past_client']).optional(),
  notes:      z.string().optional().nullable(),
  birthday:   z.string().optional().nullable(),
  // legacy single fields kept for backwards-compat (import / public form)
  phone:      z.string().optional().nullable(),
  address:    z.string().optional().nullable(),
  city:       z.string().optional().nullable(),
  province:   z.string().optional().nullable(),
  postalCode: z.string().optional().nullable(),
  // multi-value collections (full replace on each save)
  phones:    z.array(phoneSchema).optional(),
  addresses: z.array(addressSchema).optional(),
})

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const contact = await prisma.contact.findUnique({
    where: { id },
    include: {
      phones:    { orderBy: { createdAt: 'asc' } },
      addresses: { orderBy: { createdAt: 'asc' } },
      tags:      { include: { tag: true } },
      activities: { orderBy: { occurredAt: 'desc' }, take: 20 },
      tasks:     { orderBy: { createdAt: 'desc' } },
      notesList: { orderBy: { createdAt: 'desc' }, include: { user: { select: { name: true } } } },
      deals:     { include: { deal: { include: { stage: true } } } },
    },
  })
  if (!contact) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ data: contact })
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const body = await request.json()
    const { birthday, phones, addresses, ...rest } = updateSchema.parse(body)

    const scalarData = {
      ...rest,
      ...(birthday !== undefined ? { birthday: birthday ? new Date(birthday) : null } : {}),
    }

    // Run scalar update + phone/address replacements in a transaction
    const contact = await prisma.$transaction(async (tx) => {
      const updated = await tx.contact.update({ where: { id }, data: scalarData })

      if (phones !== undefined) {
        await tx.contactPhone.deleteMany({ where: { contactId: id } })
        if (phones.length > 0) {
          await tx.contactPhone.createMany({
            data: phones.map(p => ({
              contactId: id,
              label:     p.label,
              number:    p.number,
              isPrimary: p.isPrimary,
            })),
          })
        }
      }

      if (addresses !== undefined) {
        await tx.contactAddress.deleteMany({ where: { contactId: id } })
        if (addresses.length > 0) {
          await tx.contactAddress.createMany({
            data: addresses.map(a => ({
              contactId:  id,
              label:      a.label,
              street:     a.street ?? null,
              city:       a.city ?? null,
              province:   a.province ?? null,
              postalCode: a.postalCode ?? null,
              country:    a.country,
              isPrimary:  a.isPrimary,
            })),
          })
        }
      }

      return updated
    })

    return NextResponse.json({ data: contact })
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.errors }, { status: 400 })
    console.error('[PATCH /api/contacts/:id]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await prisma.contact.delete({ where: { id } })
  return NextResponse.json({ message: 'Deleted' })
}
