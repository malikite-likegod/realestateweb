import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { verifyVerifiedContactCookie } from '@/lib/jwt'

async function getContactId(): Promise<string | null> {
  const store = await cookies()
  const token = store.get('re_verified')?.value
  if (!token) return null
  return verifyVerifiedContactCookie(token)
}

const saveSchema = z.object({
  name:    z.string().optional(),
  filters: z.record(z.unknown()),
})

export async function GET() {
  const contactId = await getContactId()
  if (!contactId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const searches = await prisma.savedSearch.findMany({
    where:   { contactId },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({ searches })
}

export async function POST(request: Request) {
  const contactId = await getContactId()
  if (!contactId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body   = await request.json()
  const parsed = saveSchema.safeParse(body)
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
