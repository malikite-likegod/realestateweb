import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

function slugify(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const reports = await prisma.marketReport.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(reports)
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const data = await req.json()
  const { title, reportMonth, area, excerpt, body, coverImage, status, authorName, ctaTitle, ctaSubtitle, metaTitle, metaDesc } = data

  if (!title || !body) return NextResponse.json({ error: 'title and body are required' }, { status: 400 })

  const baseSlug = slugify(title)
  let slug = baseSlug
  let i = 1
  while (await prisma.marketReport.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${i++}`
  }

  const report = await prisma.marketReport.create({
    data: {
      title, slug, reportMonth, area, excerpt, body, coverImage,
      status: status ?? 'draft', authorName, ctaTitle, ctaSubtitle,
      metaTitle, metaDesc,
      publishedAt: status === 'published' ? new Date() : null,
    },
  })

  return NextResponse.json(report, { status: 201 })
}
