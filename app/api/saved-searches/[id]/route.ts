import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'

interface Props { params: Promise<{ id: string }> }

async function getContactId(): Promise<string | null> {
  const store = await cookies()
  return store.get('re_verified')?.value ?? null
}

export async function DELETE(_req: Request, { params }: Props) {
  const contactId = await getContactId()
  if (!contactId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const search = await prisma.savedSearch.findUnique({ where: { id } })
  if (!search || search.contactId !== contactId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  await prisma.savedSearch.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
