import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const post = await prisma.blogPost.findUnique({ where: { slug } })
  if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Increment views
  await prisma.blogPost.update({ where: { slug }, data: { views: { increment: 1 } } })

  return NextResponse.json({ data: post })
}

export async function PATCH(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const body = await request.json()
  const post = await prisma.blogPost.update({
    where: { slug },
    data: {
      ...body,
      tags: body.tags ? JSON.stringify(body.tags) : undefined,
      publishedAt: body.status === 'published' ? new Date() : undefined,
    },
  })
  return NextResponse.json({ data: post })
}

export async function DELETE(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  await prisma.blogPost.delete({ where: { slug } })
  return NextResponse.json({ message: 'Deleted' })
}
