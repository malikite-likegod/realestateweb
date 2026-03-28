import { NextResponse }  from 'next/server'
import { getSession }    from '@/lib/auth'
import { prisma }        from '@/lib/prisma'

interface Ctx { params: Promise<{ id: string }> }

export async function DELETE(_req: Request, { params }: Ctx) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const email = await prisma.emailMessage.findUnique({ where: { id }, select: { id: true } })
  if (!email) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.emailMessage.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
