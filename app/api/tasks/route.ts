import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

const taskSchema = z.object({
  title:         z.string().min(1),
  description:   z.string().optional(),
  status:        z.enum(['todo', 'in_progress', 'done', 'cancelled']).optional(),
  priority:      z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  dueAt:         z.string().optional(),
  startDatetime: z.string().optional(),
  endDatetime:   z.string().optional(),
  allDay:        z.boolean().optional(),
  taskTypeId:    z.string().optional(),
  assigneeId:    z.string().optional(),
  contactId:     z.string().optional(),
  dealId:        z.string().optional(),
})

export async function GET(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const status     = searchParams.get('status')
  const assigneeId = searchParams.get('assigneeId')
  const contactId  = searchParams.get('contactId')

  const tasks = await prisma.task.findMany({
    where: {
      ...(status     && { status }),
      ...(assigneeId && { assigneeId }),
      ...(contactId  && { contactId }),
    },
    orderBy: [{ dueAt: 'asc' }, { createdAt: 'desc' }],
    include: {
      assignee: { select: { name: true } },
      contact:  { select: { firstName: true, lastName: true } },
      taskType: true,
    },
  })

  return NextResponse.json({ data: tasks })
}

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json()
    const data = taskSchema.parse(body)
    const task = await prisma.task.create({
      data: {
        ...data,
        createdById:   session.id,
        dueAt:         data.dueAt         ? new Date(data.dueAt)         : null,
        startDatetime: data.startDatetime ? new Date(data.startDatetime) : null,
        endDatetime:   data.endDatetime   ? new Date(data.endDatetime)   : null,
      },
      include: {
        assignee: { select: { name: true } },
        taskType: true,
        contact:  { select: { firstName: true, lastName: true } },
      },
    })
    return NextResponse.json({ data: task }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.errors }, { status: 400 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
