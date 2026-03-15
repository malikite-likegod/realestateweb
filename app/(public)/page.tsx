import { Suspense } from 'react'
import { HeroSection } from '@/components/layout'
import { Section } from '@/components/layout'
import { Container } from '@/components/layout'
import { ContentBlock } from '@/components/layout'
import { SplitSection } from '@/components/layout'
import { FeatureGrid } from '@/components/layout'
import { TestimonialCarousel, PropertyGrid, AgentProfileCard } from '@/components/real-estate'
import { LeadCaptureForm } from '@/components/forms'
import { NewsletterSignupForm } from '@/components/forms'
import { Button } from '@/components/ui'
import { SearchBar } from '@/components/navigation'
import { prisma } from '@/lib/prisma'
import { parseJsonSafe } from '@/lib/utils'
import { Home, TrendingUp, Award, Users, Shield, Clock } from 'lucide-react'
import Link from 'next/link'
import type { PropertySummary } from '@/types'

async function getFeaturedProperties(): Promise<PropertySummary[]> {
  const properties = await prisma.property.findMany({
    where: { status: 'active', listings: { some: { featured: true } } },
    orderBy: { createdAt: 'desc' },
    take: 6,
    include: { listings: { where: { featured: true }, take: 1 } },
  })

  return properties.map(p => ({
    id: p.id,
    title: p.title,
    price: p.price,
    bedrooms: p.bedrooms,
    bathrooms: p.bathrooms,
    sqft: p.sqft,
    address: p.address,
    city: p.city,
    propertyType: p.propertyType,
    listingType: p.listingType,
    status: p.status,
    images: parseJsonSafe<string[]>(p.images, ['/placeholder-property.jpg']),
    latitude: p.latitude,
    longitude: p.longitude,
    listedAt: p.listedAt,
  }))
}

const testimonials = [
  { name: 'Shawn & Diana Bennett', location: 'Alliston, Ontario', text: 'Michael Taylor made our home selling and buyer easy, quick and smooth. With the selling process he arranged staging, which resulted in a quick sale of the home. As for the buying he would find what were in our wants list and also give us realistic advice, during this process. He made all the scheduling and was very responsive when we found a home that we wanted to view. Closing was easy and he was about the client, us, and making sure that we don’t over-do it. All in all I can confidently recommend Michael. ', rating: 5 },
  { name: 'Mary & Chuk Law', location: 'Scarborough, Toronto', text: 'Throughout the buying/selling process, he provided invaluable insights, guided me through each step, and ensured that I felt confident in my decisions. Mike’s dedication to client satisfaction is truly commendable, and I couldn’t have asked for a better advocate in my real estate journey.', rating: 5 },
  { name: 'Wayne & Ellen Lo', location: 'North York, Toronto', text: 'I had the pleasure of working with Michael to sell my condo, and I couldn’t be happier with the experience. Michael was incredibly professional, patient, and knowledgeable throughout the entire process. He provided expert guidance, answered all my questions, and made what could have been a stressful situation smooth and manageable. Thanks to his hard work and dedication, my condo sold quickly and for a great price. I highly recommend Michael to anyone looking for a top-notch real estate agent.', rating: 5 },
]

const features = [
  { icon: <Home size={20} />, title: 'Deep Market Knowledge', description: 'Over 15 years specializing in Toronto\'s luxury real estate market with unparalleled neighbourhood expertise.' },
  { icon: <TrendingUp size={20} />, title: 'Results-Driven Strategy', description: 'Our data-driven approach consistently delivers above-asking offers and top-dollar results for our sellers.' },
  { icon: <Award size={20} />, title: 'White-Glove Service', description: 'Ensuring that every detail of the buying or selling process is handled with care, professionalism, and clear communication. ' },
  { icon: <Users size={20} />, title: 'Personal Attention', description: 'Every client receives dedicated, white-glove service tailored to their unique needs and goals.' },
  { icon: <Shield size={20} />, title: 'Trusted & Transparent', description: 'Honest, straightforward advice you can rely on — we put your interests first, always.' },
  { icon: <Clock size={20} />, title: '24/7 Availability', description: 'The Toronto market moves fast. We\'re always available when you need us, day or night.' },
]

export default async function HomePage() {
  const featuredProperties = await getFeaturedProperties()

  return (
    <>
      {/* Hero */}
      <HeroSection
        title="Find Your Dream Home in Toronto"
        subtitle="Helping first time home buyers and upsizers navigate The Greater Toronto Area's neighbourhoods. I deliver exceptional results for buyers and sellers."
        backgroundImage="https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1920&q=80"
      >
        <div className="mt-10 flex justify-center">
          <SearchBar variant="hero" />
        </div>
        <div className="mt-6 flex justify-center gap-8 text-white/70 text-sm">
          <span>🏠 100+ Transactions</span>
          <span>⭐ 4.9/5 Rating</span>
          <span>🏆 19+ Years of Experience</span>
        </div>
      </HeroSection>

      {/* Featured listings */}
      <Section padding="lg">
        <Container>
          <ContentBlock
            eyebrow="Featured Properties"
            title="Exceptional Homes, Curated for You"
            body="Explore our hand-selected listings across Toronto's most desirable neighbourhoods."
            centered
          />
          <div className="mt-12">
            <Suspense fallback={<PropertyGrid properties={[]} loading />}>
              <PropertyGrid properties={featuredProperties} />
            </Suspense>
          </div>
          <div className="mt-10 flex justify-center">
            <Button variant="outline" size="lg" asChild>
              <Link href="/listings">View All Listings</Link>
            </Button>
          </div>
        </Container>
      </Section>

      {/* Agent intro */}
      <Section background="light" padding="lg">
        <Container size="lg">
          <AgentProfileCard
            name="Michael Taylor"
            title="First Time Home Buyer & Upsizer Real Estate Specialist"
            phone="(416) 888-8352"
            email="miketaylor.realty@gmail.com"
            bio="With over 19 years of experience in The Greater Toronto Area's real estate market, Michael has built a reputation for exceptional results and unparalleled client service. His deep market knowledge and strategic approach consistently deliver above-market outcomes for his clients."
            photo="/images/test.png"
            stats={[
              { value: '100+', label: 'Transactions' },
              { value: '$50M+', label: 'In Sales' },
              { value: '19+', label: 'Years Exp.' },
            ]}
          />
        </Container>
      </Section>

      {/* Why us */}
      <Section padding="xl">
        <Container>
          <ContentBlock eyebrow="Why Work With Michael" title="The Standard of Excellence" body="We combine deep market expertise with personalized service to deliver extraordinary results." centered />
          <div className="mt-16">
            <FeatureGrid features={features} columns={3} />
          </div>
        </Container>
      </Section>

      {/* Buying section */}
      <Section background="light" padding="lg">
        <Container>
          <SplitSection image="https://images.unsplash.com/photo-1560185007-cde436f6a4d0?w=900&q=80" imagePosition="right">
            <ContentBlock
              eyebrow="Buying a Home"
              title="Your Journey Starts Here"
              body="Whether you're a first-time buyer or seasoned investor, we guide you through every step of the buying process with expertise and care."
            >
              <Button variant="primary" size="lg" asChild>
                <Link href="/buying">Learn About Buying</Link>
              </Button>
            </ContentBlock>
          </SplitSection>
        </Container>
      </Section>

      {/* Testimonials */}
      <Section padding="xl">
        <Container size="md">
          <ContentBlock eyebrow="Client Stories" title="What My Clients Say" centered />
          <div className="mt-12">
            <TestimonialCarousel testimonials={testimonials} />
          </div>
        </Container>
      </Section>

      {/* Lead capture */}
      <Section background="charcoal" padding="xl">
        <Container size="sm">
          <div className="text-center mb-10">
            <p className="text-sm font-semibold uppercase tracking-widest text-gold-400 mb-3">Get Started Today</p>
            <h2 className="font-serif text-4xl font-bold text-white">Ready to Find Your Dream Home?</h2>
            <p className="mt-4 text-charcoal-300">Tell us what you&apos;re looking for and we&apos;ll be in touch within 24 hours.</p>
          </div>
          <div className="bg-white rounded-3xl p-8 shadow-2xl">
            <LeadCaptureForm title="" source="homepage_cta" />
          </div>
        </Container>
      </Section>

      {/* Newsletter */}
      <Section background="charcoal" padding="md">
        <Container>
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <h3 className="font-serif text-2xl font-bold text-white">Stay Ahead of the Market</h3>
              <p className="text-charcoal-400 mt-1">Weekly insights, new listings, and market reports delivered to your inbox.</p>
            </div>
            <NewsletterSignupForm />
          </div>
        </Container>
      </Section>
    </>
  )
}
