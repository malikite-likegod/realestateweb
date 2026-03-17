import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

function slugify(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const pages = await prisma.landingPage.findMany({ orderBy: { createdAt: 'desc' } })
  return NextResponse.json(pages)
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const data = await req.json()
  const {
    title, content, status, ctaTitle, ctaSubtitle, autoTags,
    agentName, agentTitle, agentPhone, agentEmail, agentPhoto, agentBio,
    metaTitle, metaDesc, slug: customSlug,
  } = data

  if (!title || !content) {
    return NextResponse.json({ error: 'title and content are required' }, { status: 400 })
  }

  const baseSlug = slugify(customSlug || title)
  let slug = baseSlug
  let i = 1
  while (await prisma.landingPage.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${i++}`
  }

  const page = await prisma.landingPage.create({
    data: {
      title, slug, content,
      status: status ?? 'draft',
      publishedAt: status === 'published' ? new Date() : null,
      ctaTitle, ctaSubtitle, autoTags,
      agentName, agentTitle, agentPhone, agentEmail, agentPhoto, agentBio,
      metaTitle, metaDesc,
    },
  })

  return NextResponse.json(page, { status: 201 })
}
