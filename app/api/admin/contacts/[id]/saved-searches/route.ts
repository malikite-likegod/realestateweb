import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const schema = z.object({ name: z.string().min(1), filters: z.record(z.unknown()) })

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: z.infer<typeof schema>
  try { body = schema.parse(await request.json()) }
  catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }) }

  const contact = await prisma.contact.findUnique({ where: { id } })
  if (!contact) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const search = await prisma.savedSearch.create({
    data: { name: body.name, filters: JSON.stringify(body.filters), contactId: id },
  })
  return NextResponse.json({ data: search }, { status: 201 })
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const searches = await prisma.savedSearch.findMany({ where: { contactId: id }, orderBy: { createdAt: 'desc' } })
  return NextResponse.json({ data: searches })
}
