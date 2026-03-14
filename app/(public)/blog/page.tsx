import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { prisma } from '@/lib/prisma'
import { Container, Section, ContentBlock } from '@/components/layout'
import { formatDate } from '@/lib/utils'

export const metadata: Metadata = { title: 'Blog & Market Insights', description: 'Stay informed with the latest Toronto real estate market insights, tips, and news.' }

export const revalidate = 3600 // hourly

async function getPosts() {
  return prisma.blogPost.findMany({
    where: { status: 'published' },
    orderBy: { publishedAt: 'desc' },
    take: 12,
  })
}

export default async function BlogPage() {
  const posts = await getPosts()

  return (
    <div className="pt-20">
      <Section background="light" padding="md">
        <Container>
          <ContentBlock eyebrow="Blog & Resources" title="Market Insights & Real Estate Advice" centered />
        </Container>
      </Section>

      <Section>
        <Container>
          {posts.length === 0 ? (
            <div className="text-center py-16 text-charcoal-400">No posts yet. Check back soon!</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {posts.map(post => (
                <Link key={post.id} href={`/blog/${post.slug}`} className="group flex flex-col rounded-2xl overflow-hidden border border-charcoal-100 shadow-sm hover:shadow-md transition-shadow">
                  {post.coverImage ? (
                    <div className="relative aspect-[16/9] overflow-hidden">
                      <Image src={post.coverImage} alt={post.title} fill className="object-cover group-hover:scale-105 transition-transform duration-500" sizes="33vw" />
                    </div>
                  ) : (
                    <div className="aspect-[16/9] bg-charcoal-100 flex items-center justify-center text-charcoal-300">No image</div>
                  )}
                  <div className="p-5 flex flex-col gap-2">
                    <p className="text-xs text-charcoal-400">{post.publishedAt ? formatDate(post.publishedAt, { month: 'long', day: 'numeric', year: 'numeric' }) : 'Draft'}</p>
                    <h2 className="font-serif text-lg font-bold text-charcoal-900 group-hover:text-gold-600 transition-colors line-clamp-2">{post.title}</h2>
                    {post.excerpt && <p className="text-sm text-charcoal-500 line-clamp-3">{post.excerpt}</p>}
                    <p className="text-sm font-medium text-gold-600 mt-1">Read more →</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Container>
      </Section>
    </div>
  )
}
