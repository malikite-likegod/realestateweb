import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

const noteSchema = z.object({
  body:      z.string().min(1),
  contactId: z.string().optional(),
})

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json()
    const data = noteSchema.parse(body)
    const note = await prisma.note.create({
      data: { ...data, userId: session.id },
      include: { user: { select: { name: true } } },
    })
    return NextResponse.json({ data: note }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.errors }, { status: 400 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
