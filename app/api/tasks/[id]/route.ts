import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json()
  const task = await prisma.task.update({
    where: { id },
    data: { ...body, dueAt: body.dueAt ? new Date(body.dueAt) : undefined, completedAt: body.status === 'done' ? new Date() : undefined },
  })
  return NextResponse.json({ data: task })
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await prisma.task.delete({ where: { id } })
  return NextResponse.json({ message: 'Deleted' })
}
