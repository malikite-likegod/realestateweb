import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const schema = z.object({ listingKey: z.string().min(1) })

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: z.infer<typeof schema>
  try { body = schema.parse(await request.json()) }
  catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }) }

  const pkg = await prisma.listingPackage.findUnique({ where: { id } })
  if (!pkg) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  try {
    const item = await prisma.listingPackageItem.create({ data: { packageId: id, listingKey: body.listingKey } })
    return NextResponse.json({ data: item }, { status: 201 })
  } catch (e: unknown) {
    if ((e as { code?: string }).code === 'P2002') {
      return NextResponse.json({ error: 'Already in this package' }, { status: 409 })
    }
    throw e
  }
}
