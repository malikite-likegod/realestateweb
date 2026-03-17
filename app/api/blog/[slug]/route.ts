import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

type Props = { params: Promise<{ slug: string }> }

export async function GET(_: Request, { params }: Props) {
  const { slug } = await params
  const post = await prisma.blogPost.findUnique({ where: { slug } })
  if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.blogPost.update({ where: { slug }, data: { views: { increment: 1 } } })

  return NextResponse.json({ data: post })
}

export async function PATCH(request: Request, { params }: Props) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { slug } = await params
  const existing = await prisma.blogPost.findUnique({ where: { slug } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await request.json()
  const { title, excerpt, body: postBody, coverImage, authorName, status, metaTitle, metaDesc } = body

  const post = await prisma.blogPost.update({
    where: { slug },
    data: {
      title, excerpt, body: postBody, coverImage, authorName, status, metaTitle, metaDesc,
      publishedAt: status === 'published' && !existing.publishedAt ? new Date() : existing.publishedAt,
    },
  })
  return NextResponse.json({ data: post })
}

export async function DELETE(_: Request, { params }: Props) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { slug } = await params
  const existing = await prisma.blogPost.findUnique({ where: { slug } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.blogPost.delete({ where: { slug } })
  return NextResponse.json({ ok: true })
}
