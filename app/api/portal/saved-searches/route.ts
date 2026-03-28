import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getContactSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const contact = await getContactSession()
  if (!contact) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const searches = await prisma.savedSearch.findMany({
    where:   { contactId: contact.id },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({ data: searches })
}

export async function POST(request: Request) {
  const contact = await getContactSession()
  if (!contact) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { name, filters } = z.object({
      name:    z.string().min(1),
      filters: z.record(z.unknown()),
    }).parse(await request.json())

    const search = await prisma.savedSearch.create({
      data: { contactId: contact.id, name, filters: JSON.stringify(filters) },
    })
    return NextResponse.json({ data: search }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
