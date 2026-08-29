import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Container, Section, ContentBlock, HeroSection } from '@/components/layout'
import { PropertyGrid } from '@/components/real-estate'
import { MlsDisclaimer } from '@/components/mls/MlsDisclaimer'
import { LeadCaptureForm } from '@/components/forms'
import { prisma } from '@/lib/prisma'
import { parseJsonSafe } from '@/lib/utils'
import { PropertyService } from '@/lib/property-service'
import type { PropertySummary } from '@/types/real-estate'

interface Props { params: Promise<{ slug: string }> }

const GRID_LIMIT = 24

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

  // Site-wide active residential for-sale MLS listings for this area.
  // PropertyService resolves raw / friendly / district-code city values.
  const { listings, total } = await PropertyService.getProperties({
    city:          community.city,
    propertyClass: 'Residential',
    listingType:   'sale',
    pageSize:      GRID_LIMIT,
  })

  const propertySummaries: PropertySummary[] = listings.map(p => {
    const mediaItems = parseJsonSafe<{ url: string; order: number }[]>(p.media, [])
    const images = mediaItems.length
      ? mediaItems.sort((a, b) => a.order - b.order).map(m => m.url)
      : ['/images/minimal-light-placeholder.svg']

    const addressParts = [
      p.streetNumber,
      p.streetName,
      p.streetSuffix,
      p.streetDirPrefix,
      p.streetDirSuffix,
      p.unitNumber ? `#${p.unitNumber}` : null,
    ].filter(Boolean)

    return {
      id:           p.listingKey,
      title:        addressParts.join(' ') || p.city,
      price:        p.listPrice ?? 0,
      bedrooms:     p.bedroomsTotal,
      bathrooms:    p.bathroomsTotalInteger,
      sqft:         p.livingArea ? Math.round(p.livingArea) : null,
      address:      addressParts.join(' ') || '',
      city:         p.city,
      propertyType: p.propertySubType ?? p.propertyType ?? 'Residential',
      listingType:  (p.transactionType ?? '').toLowerCase().includes('lease') ? 'lease' : 'sale',
      status:       p.standardStatus.toLowerCase(),
      images,
      latitude:     p.latitude,
      longitude:    p.longitude,
      listedAt:     p.listingContractDate,
    }
  })

  const viewAllHref = `/listings?city=${encodeURIComponent(community.city)}&propertyClass=Residential&listingType=sale`

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
            <h2 className="font-serif text-3xl font-bold text-charcoal-900 mb-8">
              Homes for Sale in {community.name}
            </h2>
            <PropertyGrid properties={propertySummaries} loading={false} />
            {total > propertySummaries.length && (
              <div className="mt-8 text-center">
                <Link
                  href={viewAllHref}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-charcoal-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-charcoal-700 transition-colors"
                >
                  View all {total} listings
                </Link>
              </div>
            )}
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
