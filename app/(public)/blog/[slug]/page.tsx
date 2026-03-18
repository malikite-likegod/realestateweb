import { notFound } from 'next/navigation'
import Image from 'next/image'
import { prisma } from '@/lib/prisma'
import { Container, Section } from '@/components/layout'
import { formatDate } from '@/lib/utils'
import { sanitizeContent } from '@/lib/sanitize'
import type { Metadata } from 'next'

interface Props { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const post = await prisma.blogPost.findUnique({ where: { slug } })
  if (!post) return {}
  return { title: post.metaTitle ?? post.title, description: post.metaDesc ?? post.excerpt ?? undefined }
}

export async function generateStaticParams() {
  const posts = await prisma.blogPost.findMany({ where: { status: 'published' }, select: { slug: true } })
  return posts.map(p => ({ slug: p.slug }))
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params
  const post = await prisma.blogPost.findUnique({ where: { slug } })
  if (!post || post.status !== 'published') notFound()

  // Track view
  await prisma.blogPost.update({ where: { slug }, data: { views: { increment: 1 } } })

  return (
    <div className="pt-20">
      <Section background="light" padding="md">
        <Container size="md">
          <p className="text-xs text-charcoal-400 mb-2">{post.publishedAt ? formatDate(post.publishedAt, { year: 'numeric', month: 'long', day: 'numeric' }) : ''}</p>
          <h1 className="font-serif text-4xl font-bold text-charcoal-900">{post.title}</h1>
          {post.authorName && <p className="mt-3 text-charcoal-500 text-sm">By {post.authorName}</p>}
        </Container>
      </Section>

      {post.coverImage && (
        <div className="relative w-full aspect-[21/9] max-h-[500px]">
          <Image src={post.coverImage} alt={post.title} fill className="object-cover" priority />
        </div>
      )}

      <Section>
        <Container size="md">
          <div className="prose prose-charcoal max-w-none prose-headings:font-serif prose-a:text-gold-600">
            <div dangerouslySetInnerHTML={{ __html: sanitizeContent(post.body.replace(/\n/g, '<br/>')) }} />
          </div>
        </Container>
      </Section>
    </div>
  )
}
