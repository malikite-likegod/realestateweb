// GET    /api/email-templates/[id] — fetch single template
// PATCH  /api/email-templates/[id] — update template
// DELETE /api/email-templates/[id] — soft-delete (sets isActive=false)

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const patchSchema = z.object({
  name:     z.string().min(1).optional(),
  subject:  z.string().min(1).optional(),
  body:     z.string().min(1).optional(),
  category: z.string().optional(),
  isActive: z.boolean().optional(),
})

interface Props { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Props) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const template = await prisma.emailTemplate.findUnique({ where: { id } })
  if (!template) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ data: template })
}

export async function PATCH(request: Request, { params }: Props) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id }   = await params
    const body     = await request.json()
    const parsed   = patchSchema.parse(body)
    const template = await prisma.emailTemplate.update({ where: { id }, data: parsed })
    return NextResponse.json({ data: template })
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.errors }, { status: 400 })
    console.error('[PATCH /api/email-templates/[id]]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: Props) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  // Soft-delete: keep the record so existing EmailMessage references remain intact
  await prisma.emailTemplate.update({ where: { id }, data: { isActive: false } })
  return NextResponse.json({ message: 'Deleted' })
}
