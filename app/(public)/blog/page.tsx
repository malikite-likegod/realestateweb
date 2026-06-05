import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { prisma } from '@/lib/prisma'
import { Container, Section, ContentBlock } from '@/components/layout'
import { formatDate } from '@/lib/utils'

export const metadata: Metadata = { title: 'Blog & Market Insights', description: 'Stay informed with the latest Toronto real estate market insights, tips, and news.' }

export const revalidate = 3600

type CardItem =
  | { kind: 'post';   id: string; slug: string; title: string; excerpt: string | null; coverImage: string | null; publishedAt: Date | null; area?: never; reportMonth?: never }
  | { kind: 'report'; id: string; slug: string; title: string; excerpt: string | null; coverImage: string | null; publishedAt: Date | null; area: string | null; reportMonth: string | null }

async function getItems(): Promise<CardItem[]> {
  try {
    const [posts, reports] = await Promise.all([
      prisma.blogPost.findMany({
        where: { status: 'published' },
        orderBy: { publishedAt: 'desc' },
        take: 20,
        select: { id: true, slug: true, title: true, excerpt: true, coverImage: true, publishedAt: true },
      }),
      prisma.marketReport.findMany({
        where: { status: 'published' },
        orderBy: { publishedAt: 'desc' },
        take: 20,
        select: { id: true, slug: true, title: true, excerpt: true, coverImage: true, publishedAt: true, area: true, reportMonth: true },
      }),
    ])

    const items: CardItem[] = [
      ...posts.map(p => ({ kind: 'post' as const, ...p })),
      ...reports.map(r => ({ kind: 'report' as const, ...r })),
    ]

    return items.sort((a, b) => {
      const aDate = a.publishedAt?.getTime() ?? 0
      const bDate = b.publishedAt?.getTime() ?? 0
      return bDate - aDate
    })
  } catch {
    return []
  }
}

export default async function BlogPage() {
  const items = await getItems()

  return (
    <div className="pt-20">
      <Section background="light" padding="md">
        <Container>
          <ContentBlock eyebrow="Blog & Resources" title="Market Insights & Real Estate Advice" centered />
        </Container>
      </Section>

      <Section>
        <Container>
          {items.length === 0 ? (
            <div className="text-center py-16 text-charcoal-400">No posts yet. Check back soon!</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {items.map(item => (
                <Link
                  key={`${item.kind}-${item.id}`}
                  href={item.kind === 'report' ? `/market-report/${item.slug}` : `/blog/${item.slug}`}
                  className="group flex flex-col rounded-2xl overflow-hidden border border-charcoal-100 shadow-sm hover:shadow-md transition-shadow"
                >
                  {item.coverImage ? (
                    <div className="relative aspect-[16/9] overflow-hidden">
                      <Image src={item.coverImage} alt={item.title} fill className="object-cover group-hover:scale-105 transition-transform duration-500" sizes="33vw" />
                    </div>
                  ) : (
                    <div className="aspect-[16/9] bg-charcoal-100 flex items-center justify-center text-charcoal-300">No image</div>
                  )}
                  <div className="p-5 flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      {item.kind === 'report' && (
                        <span className="text-[10px] font-semibold uppercase tracking-widest text-gold-600 bg-gold-50 px-2 py-0.5 rounded-full border border-gold-200">
                          Market Report
                        </span>
                      )}
                      {item.kind === 'report' && item.area && (
                        <span className="text-[10px] text-charcoal-400">{item.area}</span>
                      )}
                      {item.kind === 'report' && item.reportMonth && (
                        <span className="text-[10px] text-charcoal-400">{item.reportMonth}</span>
                      )}
                      {item.kind === 'post' && item.publishedAt && (
                        <p className="text-xs text-charcoal-400">{formatDate(item.publishedAt, { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                      )}
                    </div>
                    <h2 className="font-serif text-lg font-bold text-charcoal-900 group-hover:text-gold-600 transition-colors line-clamp-2">{item.title}</h2>
                    {item.excerpt && <p className="text-sm text-charcoal-500 line-clamp-3">{item.excerpt}</p>}
                    <p className="text-sm font-medium text-gold-600 mt-1">
                      {item.kind === 'report' ? 'Read Report →' : 'Read more →'}
                    </p>
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
