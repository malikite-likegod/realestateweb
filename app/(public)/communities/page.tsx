import type { Metadata } from 'next'
import { Container, Section, ContentBlock } from '@/components/layout'
import { CommunityGrid } from '@/components/real-estate'

export const metadata: Metadata = { title: 'Explore Toronto Communities', description: 'Discover Toronto\'s most prestigious and vibrant neighbourhoods.' }

const communities = [
  { name: 'Forest Hill', slug: 'forest-hill', description: 'One of Toronto\'s most prestigious neighbourhoods, known for its grand estates and lush tree-lined streets.', image: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=600&q=80', listingCount: 24 },
  { name: 'Rosedale', slug: 'rosedale', description: 'A historic neighbourhood with gracious Victorian and Edwardian homes set among ravines and parks.', image: 'https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=600&q=80', listingCount: 18 },
  { name: 'Yorkville', slug: 'yorkville', description: 'Toronto\'s most glamorous address, featuring luxury condos, boutiques, and fine dining.', image: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=600&q=80', listingCount: 31 },
  { name: 'Lawrence Park', slug: 'lawrence-park', description: 'A family-friendly enclave with beautiful homes, top schools, and a strong community feel.', image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80', listingCount: 15 },
  { name: 'The Annex', slug: 'the-annex', description: 'A vibrant, walkable neighbourhood beloved for its Victorian architecture, cafes, and culture.', image: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=600&q=80', listingCount: 22 },
  { name: 'Summerhill', slug: 'summerhill', description: 'An elegant uptown neighbourhood with charming streets, specialty shops, and beautiful homes.', image: 'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=600&q=80', listingCount: 12 },
]

export default function CommunitiesPage() {
  return (
    <div className="pt-20">
      <Section background="light" padding="md">
        <Container>
          <ContentBlock eyebrow="Toronto Neighbourhoods" title="Find Your Perfect Community" body="Each neighbourhood in Toronto has its own unique character, amenities, and lifestyle. Explore them all." centered />
        </Container>
      </Section>
      <Section>
        <Container>
          <CommunityGrid communities={communities} />
        </Container>
      </Section>
    </div>
  )
}
