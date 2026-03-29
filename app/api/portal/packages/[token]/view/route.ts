import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'

const schema = z.object({ itemId: z.string() })

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  let body: z.infer<typeof schema>
  try { body = schema.parse(await request.json()) }
  catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }) }

  const item = await prisma.listingPackageItem.findFirst({
    where: { id: body.itemId, package: { magicToken: token } },
    include: { package: { select: { contactId: true } } },
  })

  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const view = await prisma.listingPackageView.create({
    data: { itemId: item.id, contactId: item.package.contactId },
  })

  return NextResponse.json({ viewId: view.id }, { status: 201 })
}
