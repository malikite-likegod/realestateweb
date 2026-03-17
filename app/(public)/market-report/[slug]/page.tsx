import { notFound } from 'next/navigation'
import Image from 'next/image'
import { prisma } from '@/lib/prisma'
import { Container, Section } from '@/components/layout'
import { formatDate } from '@/lib/utils'
import { MarketReportLeadForm } from './MarketReportLeadForm'
import type { Metadata } from 'next'

interface Props { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const report = await prisma.marketReport.findUnique({ where: { slug } })
  if (!report) return {}
  return {
    title: report.metaTitle ?? report.title,
    description: report.metaDesc ?? report.excerpt ?? undefined,
  }
}

export async function generateStaticParams() {
  const reports = await prisma.marketReport.findMany({ where: { status: 'published' }, select: { slug: true } })
  return reports.map(r => ({ slug: r.slug }))
}

export const revalidate = 3600

export default async function MarketReportPage({ params }: Props) {
  const { slug } = await params
  const report = await prisma.marketReport.findUnique({ where: { slug } })
  if (!report || report.status !== 'published') notFound()

  await prisma.marketReport.update({ where: { slug }, data: { views: { increment: 1 } } })

  const ctaTitle = report.ctaTitle ?? 'Get the Full In-Depth Report'
  const ctaSubtitle = report.ctaSubtitle ?? "Enter your details below and we'll send you a comprehensive market analysis."

  return (
    <div className="pt-20">
      {/* Header */}
      <Section background="light" padding="md">
        <Container size="md">
          <div className="flex items-center gap-2 mb-3">
            {report.area && (
              <span className="text-xs font-semibold uppercase tracking-widest text-gold-600 bg-gold-50 px-3 py-1 rounded-full">
                {report.area}
              </span>
            )}
            {report.reportMonth && (
              <span className="text-xs font-semibold uppercase tracking-widest text-charcoal-500 bg-charcoal-100 px-3 py-1 rounded-full">
                {report.reportMonth}
              </span>
            )}
          </div>
          <h1 className="font-serif text-4xl font-bold text-charcoal-900">{report.title}</h1>
          {report.excerpt && <p className="mt-3 text-lg text-charcoal-500">{report.excerpt}</p>}
          <div className="mt-4 flex items-center gap-4 text-sm text-charcoal-400">
            {report.authorName && <span>By {report.authorName}</span>}
            {report.publishedAt && (
              <span>{formatDate(report.publishedAt, { year: 'numeric', month: 'long', day: 'numeric' })}</span>
            )}
          </div>
        </Container>
      </Section>

      {/* Cover image */}
      {report.coverImage && (
        <div className="relative w-full aspect-[21/9] max-h-[500px]">
          <Image src={report.coverImage} alt={report.title} fill className="object-cover" priority />
        </div>
      )}

      {/* Market overview + lead form */}
      <Section>
        <Container size="lg">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            {/* Overview content — takes up 2/3 */}
            <div className="lg:col-span-2">
              <div className="prose prose-charcoal max-w-none prose-headings:font-serif prose-a:text-gold-600">
                <div dangerouslySetInnerHTML={{ __html: report.body.replace(/\n/g, '<br/>') }} />
              </div>
            </div>

            {/* Lead capture form — sticky in sidebar */}
            <div className="lg:col-span-1">
              <div className="sticky top-24 rounded-2xl border border-charcoal-100 bg-white shadow-sm p-6">
                <MarketReportLeadForm
                  reportTitle={report.title}
                  reportSlug={slug}
                  ctaTitle={ctaTitle}
                  ctaSubtitle={ctaSubtitle}
                />
              </div>
            </div>
          </div>
        </Container>
      </Section>

      {/* Bottom CTA banner (mobile-friendly full-width form) */}
      <Section background="charcoal" padding="lg">
        <Container size="sm">
          <div className="text-center mb-8">
            <h2 className="font-serif text-3xl font-bold text-white mb-3">{ctaTitle}</h2>
            <p className="text-charcoal-300">{ctaSubtitle}</p>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-xl">
            <MarketReportLeadForm
              reportTitle={report.title}
              reportSlug={slug}
              ctaTitle=""
              ctaSubtitle=""
            />
          </div>
        </Container>
      </Section>
    </div>
  )
}
