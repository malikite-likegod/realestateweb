import type { Metadata } from 'next'
import { Container, Section, ContentBlock, HeroSection } from '@/components/layout'
import { PropertyGrid } from '@/components/real-estate'
import { LeadCaptureForm } from '@/components/forms'

interface Props { params: Promise<{ slug: string }> }

const communities: Record<string, { name: string; description: string; image: string; longDesc: string }> = {
  'forest-hill': { name: 'Forest Hill', image: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=1920&q=80', description: 'Prestige and privacy in Toronto\'s most coveted enclave.', longDesc: 'Forest Hill is widely regarded as one of Toronto\'s most exclusive neighbourhoods. Known for its grand estates, lush parks, and top-tier schools, Forest Hill offers a lifestyle of unparalleled luxury and community.' },
  'rosedale': { name: 'Rosedale', image: 'https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=1920&q=80', description: 'Historic elegance meets modern luxury in Toronto\'s ravine country.', longDesc: 'Rosedale is one of Canada\'s most prestigious neighbourhoods, characterized by winding tree-lined streets, ravine lots, and magnificent Victorian and Edwardian homes.' },
  'yorkville': { name: 'Yorkville', image: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=1920&q=80', description: 'Toronto\'s most glamorous urban neighbourhood.', longDesc: 'Yorkville is synonymous with luxury and sophistication. Home to world-class boutiques, art galleries, and Michelin-calibre restaurants, it attracts discerning buyers seeking the finest urban lifestyle.' },
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const community = communities[slug]
  return { title: community?.name ?? slug, description: community?.description }
}

export default async function CommunityDetailPage({ params }: Props) {
  const { slug } = await params
  const community = communities[slug] ?? { name: slug, image: 'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=1920&q=80', description: '', longDesc: '' }

  return (
    <div className="pt-20">
      <HeroSection title={community.name} subtitle={community.description} backgroundImage={community.image} fullHeight={false} />
      <Section>
        <Container>
          <ContentBlock title="About the Neighbourhood" body={community.longDesc} />
          <div className="mt-16">
            <h2 className="font-serif text-3xl font-bold text-charcoal-900 mb-8">Available Properties</h2>
            <PropertyGrid properties={[]} loading={false} />
          </div>
        </Container>
      </Section>
      <Section background="charcoal">
        <Container size="sm">
          <ContentBlock eyebrow="Interested?" title={`Find Your Home in ${community.name}`} centered light />
          <div className="mt-10 bg-white rounded-3xl p-8">
            <LeadCaptureForm title="" source={`community_${slug}`} />
          </div>
        </Container>
      </Section>
    </div>
  )
}
