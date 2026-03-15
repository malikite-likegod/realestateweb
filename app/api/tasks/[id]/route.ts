import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const task = await prisma.task.findUnique({
    where: { id },
    include: {
      assignee: { select: { name: true } },
      taskType: true,
      contact:  { select: { id: true, firstName: true, lastName: true } },
      deal:     { select: { id: true, title: true } },
    },
  })
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ data: task })
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json()
  const task = await prisma.task.update({
    where: { id },
    data: {
      ...body,
      dueAt:         body.dueAt         ? new Date(body.dueAt)         : body.dueAt         === null ? null : undefined,
      startDatetime: body.startDatetime ? new Date(body.startDatetime) : body.startDatetime === null ? null : undefined,
      endDatetime:   body.endDatetime   ? new Date(body.endDatetime)   : body.endDatetime   === null ? null : undefined,
      // Set completedAt when marking done; clear it when un-marking; leave it alone if status not changing
      ...(body.status === 'done'   ? { completedAt: new Date() }
        : body.status              ? { completedAt: null }
        :                            {}),
    },
    include: {
      assignee: { select: { name: true } },
      taskType: true,
      contact:  { select: { id: true, firstName: true, lastName: true } },
      deal:     { select: { id: true, title: true } },
    },
  })
  return NextResponse.json({ data: task })
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await prisma.task.delete({ where: { id } })
  return NextResponse.json({ message: 'Deleted' })
}
