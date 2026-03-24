import type { Metadata } from 'next'
import { Container, Section, ContentBlock } from '@/components/layout'
import { CommunityGrid } from '@/components/real-estate'
import { prisma } from '@/lib/prisma'

export const metadata: Metadata = {
  title:       'Explore Toronto Communities',
  description: 'Discover Toronto\'s most prestigious and vibrant neighbourhoods.',
}

export default async function CommunitiesPage() {
  const communities = await prisma.community.findMany({
    orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
  })

  // SQLite does not support mode: 'insensitive' on equals.
  // See lib/property-service.ts for the authoritative pattern.
  const isMySQL = process.env.DATABASE_URL?.includes('mysql')

  // Fetch listing counts in parallel
  const counts = await Promise.all(
    communities.map(c => {
      // Use Record<string, unknown> to avoid Prisma's mode type restriction on SQLite schemas
      const cityFilter: Record<string, unknown> = isMySQL
        ? { contains: c.city, mode: 'insensitive' }
        : { contains: c.city }
      return prisma.property.count({
        where: {
          city:     cityFilter as { contains: string },
          status:   'active',
          listings: { some: { publishedAt: { not: null } } },
        },
      })
    })
  )

  // CommunityGrid expects { name, slug, description, image, listingCount }
  const items = communities.map((c, i) => ({
    name:         c.name,
    slug:         c.slug,
    description:  c.description ?? '',
    image:        c.imageUrl    ?? '',
    listingCount: counts[i],
  }))

  return (
    <div className="pt-20">
      <Section background="light" padding="md">
        <Container>
          <ContentBlock
            eyebrow="Toronto Neighbourhoods"
            title="Find Your Perfect Community"
            body="Each neighbourhood in Toronto has its own unique character, amenities, and lifestyle. Explore them all."
            centered
          />
        </Container>
      </Section>
      <Section>
        <Container>
          <CommunityGrid communities={items} />
        </Container>
      </Section>
    </div>
  )
}
