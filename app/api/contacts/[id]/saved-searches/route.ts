import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'

interface Props { params: Promise<{ id: string }> }

const createSchema = z.object({
  name:    z.string().optional(),
  filters: z.record(z.unknown()),
})

export async function GET(_req: Request, { params }: Props) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: contactId } = await params
  const searches = await prisma.savedSearch.findMany({
    where:   { contactId },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({ searches })
}

export async function POST(request: Request, { params }: Props) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: contactId } = await params
  const body   = await request.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

  const search = await prisma.savedSearch.create({
    data: {
      contactId,
      name:    parsed.data.name ?? '',
      filters: JSON.stringify(parsed.data.filters),
    },
  })
  return NextResponse.json({ search }, { status: 201 })
}
