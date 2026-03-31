import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'

const schema = z.object({ email: z.string().email() })

export async function POST(request: Request) {
  try {
    const { email } = schema.parse(await request.json())

    const contact = await prisma.contact.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: { id: true, firstName: true, phone: true, passwordHash: true },
    })

    if (!contact) {
      return NextResponse.json({ status: 'not_found' })
    }

    if (contact.passwordHash) {
      return NextResponse.json({ status: 'has_account', firstName: contact.firstName })
    }

    if (contact.phone) {
      const raw   = contact.phone.replace(/\D/g, '')
      const last4 = raw.slice(-4)
      const masked = `••• ••• ${last4}`
      return NextResponse.json({ status: 'crm_has_phone', firstName: contact.firstName, maskedPhone: masked })
    }

    return NextResponse.json({ status: 'crm_no_phone', firstName: contact.firstName })
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.errors }, { status: 400 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
