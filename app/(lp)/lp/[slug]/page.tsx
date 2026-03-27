import { notFound } from 'next/navigation'
import Image from 'next/image'
import { prisma } from '@/lib/prisma'
import { sanitizeContent } from '@/lib/sanitize'
import { LeadForm } from './LeadForm'
import type { Metadata } from 'next'

interface Props { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const page = await prisma.landingPage.findUnique({ where: { slug } })
  if (!page) return {}
  return {
    title: page.metaTitle ?? page.title,
    description: page.metaDesc ?? undefined,
    robots: { index: false }, // landing pages shouldn't be indexed by default
  }
}

export const revalidate = 60

export default async function LandingPageRoute({ params }: Props) {
  const { slug } = await params
  const page = await prisma.landingPage.findUnique({ where: { slug } })
  if (!page || page.status !== 'published') notFound()

  await prisma.landingPage.update({ where: { slug }, data: { views: { increment: 1 } } })

  const ctaTitle    = page.ctaTitle    ?? 'Ready to Take the Next Step?'
  const ctaSubtitle = page.ctaSubtitle ?? "Fill in your details and I'll be in touch shortly."

  return (
    <div className="min-h-screen bg-white">

      {/* ── HTML content block ─────────────────────────────────── */}
      {/* Rendered as-is — author controls all styling via inline HTML */}
      <div dangerouslySetInnerHTML={{ __html: sanitizeContent(page.content) }} />

      {/* ── Lead capture form ──────────────────────────────────── */}
      <section className="bg-charcoal-50 py-20 px-4">
        <div className="max-w-xl mx-auto">
          <LeadForm slug={slug} ctaTitle={ctaTitle} ctaSubtitle={ctaSubtitle} />
        </div>
      </section>

      {/* ── Agent info ─────────────────────────────────────────── */}
      <section className="bg-white border-t border-charcoal-100 py-14 px-4">
        <div className="max-w-xl mx-auto flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left">
          {page.agentPhoto && (
            <div className="relative w-24 h-24 rounded-full overflow-hidden shrink-0 ring-4 ring-gold-100">
              <Image src={page.agentPhoto} alt={page.agentName ?? 'Agent'} fill className="object-cover" />
            </div>
          )}
          {!page.agentPhoto && (
            <div className="w-24 h-24 rounded-full bg-charcoal-100 flex items-center justify-center shrink-0 ring-4 ring-gold-100">
              <span className="text-3xl font-serif font-bold text-charcoal-400">
                {page.agentName?.[0] ?? 'A'}
              </span>
            </div>
          )}
          <div>
            {page.agentName  && <p className="font-serif text-xl font-bold text-charcoal-900">{page.agentName}</p>}
            {page.agentTitle && <p className="text-sm text-gold-600 font-medium mt-0.5">{page.agentTitle}</p>}
            {page.agentBio   && <p className="text-sm text-charcoal-500 mt-2 leading-relaxed">{page.agentBio}</p>}
            <div className="flex flex-wrap gap-4 mt-3 justify-center sm:justify-start">
              {page.agentPhone && (
                <a href={`tel:${page.agentPhone}`} className="flex items-center gap-1.5 text-sm text-charcoal-700 hover:text-gold-600 transition-colors">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  {page.agentPhone}
                </a>
              )}
              {page.agentEmail && (
                <a href={`mailto:${page.agentEmail}`} className="flex items-center gap-1.5 text-sm text-charcoal-700 hover:text-gold-600 transition-colors">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  {page.agentEmail}
                </a>
              )}
            </div>
          </div>
        </div>
      </section>

    </div>
  )
}
