import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendListingPackageEmail } from '@/lib/communications/listing-package-email'

const createSchema = z.object({
  contactId:   z.string(),
  title:       z.string().min(1),
  message:     z.string().optional(),
  listingKeys: z.array(z.string()).min(1),
  send:        z.boolean().default(false),
})

export async function GET(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const contactId = searchParams.get('contactId')
  if (!contactId) return NextResponse.json({ error: 'contactId required' }, { status: 400 })

  const packages = await prisma.listingPackage.findMany({
    where: { contactId },
    orderBy: { createdAt: 'desc' },
    include: { items: { include: { views: { select: { id: true } } } } },
  })

  return NextResponse.json({ data: packages })
}

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: z.infer<typeof createSchema>
  try { body = createSchema.parse(await request.json()) }
  catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }) }

  const contact = await prisma.contact.findUnique({ where: { id: body.contactId } })
  if (!contact) return NextResponse.json({ error: 'Contact not found' }, { status: 404 })

  if (body.send && contact.emailOptOut) {
    return NextResponse.json({ error: 'This contact has opted out of email' }, { status: 422 })
  }

  const pkg = await prisma.listingPackage.create({
    data: {
      contactId: body.contactId,
      title:     body.title,
      message:   body.message ?? null,
      sentAt:    body.send ? new Date() : null,
      items: { create: body.listingKeys.map(listingKey => ({ listingKey })) },
    },
    include: { items: true },
  })

  if (body.send && contact.email) {
    try {
      await sendListingPackageEmail({ pkg, contact })
    } catch {
      await prisma.listingPackage.update({ where: { id: pkg.id }, data: { sentAt: null } })
      return NextResponse.json({ error: 'Package saved but email failed. Retry from contact Listings tab.' }, { status: 500 })
    }
  }

  return NextResponse.json({ data: pkg }, { status: 201 })
}
