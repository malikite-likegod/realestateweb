import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

const patchSchema = z.object({
  title:         z.string().min(1).optional(),
  description:   z.string().nullable().optional(),
  status:        z.enum(['todo', 'in_progress', 'done', 'cancelled']).optional(),
  priority:      z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  dueAt:         z.string().nullable().optional(),
  startDatetime: z.string().nullable().optional(),
  endDatetime:   z.string().nullable().optional(),
  allDay:        z.boolean().optional(),
  taskTypeId:    z.string().nullable().optional(),
  assigneeId:    z.string().nullable().optional(),
  contactId:     z.string().nullable().optional(),
  dealId:        z.string().nullable().optional(),
})

const taskInclude = {
  assignee: { select: { name: true } },
  taskType: true,
  contact:  { select: { id: true, firstName: true, lastName: true } },
  deal:     { select: { id: true, title: true } },
} as const

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const task = await prisma.task.findUnique({ where: { id }, include: taskInclude })
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ data: task })
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    const body   = await request.json()
    const data   = patchSchema.parse(body)

    const task = await prisma.task.update({
      where: { id },
      data: {
        ...data,
        dueAt:         data.dueAt         ? new Date(data.dueAt)         : data.dueAt         === null ? null : undefined,
        startDatetime: data.startDatetime ? new Date(data.startDatetime) : data.startDatetime === null ? null : undefined,
        endDatetime:   data.endDatetime   ? new Date(data.endDatetime)   : data.endDatetime   === null ? null : undefined,
        ...(data.status === 'done'  ? { completedAt: new Date() }
          : data.status !== undefined ? { completedAt: null }
          : {}),
      },
      include: taskInclude,
    })
    return NextResponse.json({ data: task })
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.errors }, { status: 400 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  await prisma.task.delete({ where: { id } })
  return NextResponse.json({ message: 'Deleted' })
}
