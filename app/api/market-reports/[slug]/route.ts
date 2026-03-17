import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const report = await prisma.marketReport.findUnique({ where: { slug } })
  if (!report) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  await prisma.marketReport.update({ where: { slug }, data: { views: { increment: 1 } } })
  return NextResponse.json(report)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { slug } = await params
  const body = await req.json()

  const existing = await prisma.marketReport.findUnique({ where: { slug } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Whitelist updatable fields — never allow id, slug, createdAt to be overwritten
  const {
    title, reportMonth, area, excerpt, body: reportBody, coverImage,
    status, authorName, ctaTitle, ctaSubtitle, metaTitle, metaDesc,
  } = body

  const report = await prisma.marketReport.update({
    where: { slug },
    data: {
      title, reportMonth, area, excerpt, body: reportBody, coverImage,
      status, authorName, ctaTitle, ctaSubtitle, metaTitle, metaDesc,
      publishedAt: status === 'published' && !existing.publishedAt ? new Date() : existing.publishedAt,
    },
  })
  return NextResponse.json(report)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { slug } = await params
  const existing = await prisma.marketReport.findUnique({ where: { slug } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.marketReport.delete({ where: { slug } })
  return NextResponse.json({ ok: true })
}
