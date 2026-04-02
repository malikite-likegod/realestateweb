import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const updateSchema = z.object({
  emailSignature: z.string().optional().nullable(),
  smsSignature:   z.string().optional().nullable(),
})

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({
    where:  { id: session.id },
    select: { emailSignature: true, smsSignature: true },
  })

  return NextResponse.json({ data: user ?? { emailSignature: null, smsSignature: null } })
}

export async function PATCH(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body   = await request.json()
    const parsed = updateSchema.parse(body)

    const user = await prisma.user.update({
      where: { id: session.id },
      data:  {
        ...(parsed.emailSignature !== undefined ? { emailSignature: parsed.emailSignature || null } : {}),
        ...(parsed.smsSignature   !== undefined ? { smsSignature:   parsed.smsSignature   || null } : {}),
      },
      select: { emailSignature: true, smsSignature: true },
    })

    return NextResponse.json({ data: user })
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.errors }, { status: 400 })
    console.error('[PATCH /api/settings/signature]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
