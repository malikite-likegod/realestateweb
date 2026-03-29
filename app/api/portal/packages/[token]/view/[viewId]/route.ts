import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'

const schema = z.object({ durationSec: z.number().int().min(0) })

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ token: string; viewId: string }> }
) {
  const { token, viewId } = await params
  let body: z.infer<typeof schema>
  try { body = schema.parse(await request.json()) }
  catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }) }

  const view = await prisma.listingPackageView.findFirst({
    where: { id: viewId, item: { package: { magicToken: token } } },
  })
  if (!view) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.listingPackageView.update({ where: { id: viewId }, data: { durationSec: body.durationSec } })
  return new Response(null, { status: 204 })
}
