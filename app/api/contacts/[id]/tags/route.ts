import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// POST /api/contacts/[id]/tags — assign a tag to a contact
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: contactId } = await params
  try {
    const { tagId } = z.object({ tagId: z.string() }).parse(await request.json())
    await prisma.contactTag.create({ data: { contactId, tagId } })
    return NextResponse.json({ message: 'Tag assigned' }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.errors }, { status: 400 })
    // P2002 = unique constraint; tag is already assigned — treat as success
    if ((error as { code?: string }).code === 'P2002') {
      return NextResponse.json({ message: 'Tag already assigned' })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/contacts/[id]/tags?tagId=xxx — unassign a tag from a contact
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: contactId } = await params
  const tagId = new URL(request.url).searchParams.get('tagId')
  if (!tagId) return NextResponse.json({ error: 'tagId query param required' }, { status: 400 })

  await prisma.contactTag.delete({ where: { contactId_tagId: { contactId, tagId } } })
  return NextResponse.json({ message: 'Tag removed' })
}
