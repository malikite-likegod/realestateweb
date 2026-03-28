import { NextResponse } from 'next/server'
import { getContactSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const contact = await getContactSession()
  if (!contact) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  await prisma.savedSearch.deleteMany({ where: { id, contactId: contact.id } })
  return NextResponse.json({ ok: true })
}
