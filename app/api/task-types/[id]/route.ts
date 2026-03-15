import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json()
  const type = await prisma.taskType.update({ where: { id }, data: body })
  return NextResponse.json({ data: type })
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const type = await prisma.taskType.findUnique({ where: { id } })
  if (type?.isDefault) return NextResponse.json({ error: 'Cannot delete a default task type' }, { status: 400 })
  await prisma.taskType.delete({ where: { id } })
  return NextResponse.json({ message: 'Deleted' })
}
