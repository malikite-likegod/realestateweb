import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { slugify } from '@/lib/utils'

const blogSchema = z.object({
  title:      z.string().min(1),
  excerpt:    z.string().optional(),
  body:       z.string(),
  coverImage: z.string().optional(),
  status:     z.enum(['draft', 'published', 'archived']).optional(),
  authorName: z.string().optional(),
  metaTitle:  z.string().optional(),
  metaDesc:   z.string().optional(),
  tags:       z.array(z.string()).optional(),
})

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const page   = parseInt(searchParams.get('page') ?? '1')
  const status = searchParams.get('status') ?? 'published'

  const [total, posts] = await Promise.all([
    prisma.blogPost.count({ where: { status } }),
    prisma.blogPost.findMany({
      where: { status },
      orderBy: { publishedAt: 'desc' },
      skip: (page - 1) * 12,
      take: 12,
    }),
  ])

  return NextResponse.json({ data: posts, total, page })
}

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json()
    const data = blogSchema.parse(body)

    const post = await prisma.blogPost.create({
      data: {
        ...data,
        slug: slugify(data.title),
        tags: data.tags ? JSON.stringify(data.tags) : null,
        publishedAt: data.status === 'published' ? new Date() : null,
      },
    })

    return NextResponse.json({ data: post }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.errors }, { status: 400 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
