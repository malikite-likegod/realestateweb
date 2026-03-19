import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

interface Params { params: Promise<{ id: string }> }

const schema = z.object({ contactId: z.string(), notes: z.string().optional() })

export async function POST(request: Request, { params }: Params) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  try {
    const body = await request.json()
    const { contactId, notes } = schema.parse(body)

    // Support both listingKey and cuid id lookups
    const resoProperty = await prisma.resoProperty.findUnique({ where: { listingKey: id } })
      ?? await prisma.resoProperty.findUnique({ where: { id } })

    if (!resoProperty) return NextResponse.json({ error: 'Property not found' }, { status: 404 })

    const interest = await prisma.contactPropertyInterest.upsert({
      where:  { contactId_resoPropertyId: { contactId, resoPropertyId: resoProperty.id } },
      update: { source: 'manual', notes: notes ?? undefined },
      create: { contactId, resoPropertyId: resoProperty.id, source: 'manual', notes },
    })
    return NextResponse.json(interest, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
