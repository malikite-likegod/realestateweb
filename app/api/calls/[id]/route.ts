// GET    /api/calls/[id] — fetch single call log
// PATCH  /api/calls/[id] — update notes / status / transcription
// DELETE /api/calls/[id] — remove a call log

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { updateCallLog, deleteCallLog } from '@/lib/communications/call-service'

const patchSchema = z.object({
  status:        z.enum(['completed', 'missed', 'voicemail', 'failed']).optional(),
  notes:         z.string().optional(),
  recordingUrl:  z.string().url().optional(),
  transcription: z.string().optional(),
  durationSec:   z.number().int().min(0).optional(),
})

interface Props { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Props) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const call = await prisma.callLog.findUnique({
    where: { id },
    include: { contact: { select: { firstName: true, lastName: true } }, loggedBy: { select: { name: true } } },
  })
  if (!call) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ data: call })
}

export async function PATCH(request: Request, { params }: Props) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    const body   = await request.json()
    const parsed = patchSchema.parse(body)
    const call   = await updateCallLog(id, parsed)
    return NextResponse.json({ data: call })
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.errors }, { status: 400 })
    console.error('[PATCH /api/calls/[id]]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: Props) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  await deleteCallLog(id)
  return NextResponse.json({ message: 'Deleted' })
}
