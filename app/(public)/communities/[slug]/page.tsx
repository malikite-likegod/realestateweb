import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Container, Section, ContentBlock, HeroSection } from '@/components/layout'
import { PropertyGrid } from '@/components/real-estate'
import { MlsDisclaimer } from '@/components/mls/MlsDisclaimer'
import { LeadCaptureForm } from '@/components/forms'
import { prisma } from '@/lib/prisma'
import type { PropertySummary } from '@/types/real-estate'

interface Props { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const community = await prisma.community.findUnique({ where: { slug } })
  if (!community) return { title: slug }
  return { title: community.name, description: community.description ?? undefined }
}

export default async function CommunityDetailPage({ params }: Props) {
  const { slug } = await params

  const community = await prisma.community.findUnique({ where: { slug } })
  if (!community) notFound()

  // SQLite does not support mode: 'insensitive'; PostgreSQL requires it.
  const isRelationalDB = !process.env.DATABASE_URL?.startsWith('file:')

  // Use Record<string, unknown> to avoid Prisma's mode type restriction on SQLite schemas
  const cityFilter: Record<string, unknown> = isRelationalDB
    ? { contains: community.city, mode: 'insensitive' }
    : { contains: community.city }

  const properties = await prisma.property.findMany({
    where: {
      city:     cityFilter as { contains: string },
      status:   'active',
      listings: { some: { publishedAt: { not: null } } },
    },
    orderBy: { listedAt: 'desc' },
  })

  // Map to PropertySummary — Property.images is a JSON string
  const propertySummaries: PropertySummary[] = properties.map(p => ({
    id:           p.id,
    title:        p.title,
    price:        p.price,
    bedrooms:     p.bedrooms,
    bathrooms:    p.bathrooms,
    sqft:         p.sqft,
    address:      p.address,
    city:         p.city,
    propertyType: p.propertyType,
    listingType:  p.listingType,
    status:       p.status,
    images:       JSON.parse(p.images ?? '[]') as string[],
    latitude:     p.latitude,
    longitude:    p.longitude,
    listedAt:     p.listedAt,
  }))

  return (
    <div className="pt-20">
      <HeroSection
        title={community.name}
        subtitle={community.description ?? ''}
        backgroundImage={community.imageUrl ?? ''}
        fullHeight={false}
      />
      <Section>
        <Container>
          <ContentBlock
            title="About the Neighbourhood"
            body={community.description ?? ''}
          />
          <div className="mt-16">
            <h2 className="font-serif text-3xl font-bold text-charcoal-900 mb-8">Available Properties</h2>
            <PropertyGrid properties={propertySummaries} loading={false} />
          </div>
          <MlsDisclaimer variant="idx" />
        </Container>
      </Section>
      <Section background="charcoal">
        <Container size="sm">
          <ContentBlock
            eyebrow="Interested?"
            title={`Find Your Home in ${community.name}`}
            centered
            light
          />
          <div className="mt-10 bg-white rounded-3xl p-8">
            <LeadCaptureForm title="" source={`community_${slug}`} />
          </div>
        </Container>
      </Section>
    </div>
  )
}
