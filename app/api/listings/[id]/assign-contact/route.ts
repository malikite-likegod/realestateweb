import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

interface Params { params: Promise<{ id: string }> }

const schema = z.object({ contactId: z.string(), notes: z.string().optional() })

export async function POST(request: Request, { params }: Params) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: propertyId } = await params

  try {
    const body = await request.json()
    const { contactId, notes } = schema.parse(body)

    const interest = await prisma.contactPropertyInterest.upsert({
      where:  { contactId_propertyId: { contactId, propertyId } },
      update: { source: 'manual', notes: notes ?? undefined },
      create: { contactId, propertyId, source: 'manual', notes },
    })
    return NextResponse.json(interest, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
