import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

type Props = { params: Promise<{ slug: string }> }

export async function GET(_req: NextRequest, { params }: Props) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { slug } = await params
  const page = await prisma.landingPage.findUnique({ where: { slug } })
  if (!page) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(page)
}

export async function PATCH(req: NextRequest, { params }: Props) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { slug } = await params
  const existing = await prisma.landingPage.findUnique({ where: { slug } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const {
    title, content, status, ctaTitle, ctaSubtitle, autoTags,
    agentName, agentTitle, agentPhone, agentEmail, agentPhoto, agentBio,
    metaTitle, metaDesc,
  } = await req.json()

  const page = await prisma.landingPage.update({
    where: { slug },
    data: {
      title, content, status, ctaTitle, ctaSubtitle, autoTags,
      agentName, agentTitle, agentPhone, agentEmail, agentPhoto, agentBio,
      metaTitle, metaDesc,
      publishedAt: status === 'published' && !existing.publishedAt ? new Date() : existing.publishedAt,
    },
  })
  return NextResponse.json(page)
}

export async function DELETE(_req: NextRequest, { params }: Props) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { slug } = await params
  const existing = await prisma.landingPage.findUnique({ where: { slug } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.landingPage.delete({ where: { slug } })
  return NextResponse.json({ ok: true })
}
