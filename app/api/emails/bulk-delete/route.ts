import { NextResponse } from 'next/server'
import { getSession }   from '@/lib/auth'
import { prisma }       from '@/lib/prisma'

export async function DELETE(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const ids: unknown = body?.ids

  if (!Array.isArray(ids) || ids.length === 0 || ids.some(id => typeof id !== 'string')) {
    return NextResponse.json({ error: 'ids must be a non-empty array of strings' }, { status: 400 })
  }

  const { count } = await prisma.emailMessage.deleteMany({ where: { id: { in: ids as string[] } } })
  return NextResponse.json({ success: true, deleted: count })
}
