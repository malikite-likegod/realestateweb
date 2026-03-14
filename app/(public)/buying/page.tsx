import type { Metadata } from 'next'
import { HeroSection, Container, Section, ContentBlock, FeatureGrid, SplitSection } from '@/components/layout'
import { LeadCaptureForm } from '@/components/forms'
import { Button } from '@/components/ui'
import { Search, DollarSign, Key, FileText, Handshake, CheckCircle } from 'lucide-react'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Buying a Home', description: 'Your complete guide to buying a home in Toronto\'s luxury market.' }

const steps = [
  { icon: <Search size={20} />, title: '1. Define Your Goals', description: 'We start with a deep-dive consultation to understand your needs, lifestyle, timeline, and budget.' },
  { icon: <DollarSign size={20} />, title: '2. Get Pre-Approved', description: 'We connect you with top mortgage specialists to strengthen your offer and set a realistic budget.' },
  { icon: <Key size={20} />, title: '3. Find Your Home', description: 'Access exclusive off-market listings and IDX properties. We arrange showings at your convenience.' },
  { icon: <Handshake size={20} />, title: '4. Make an Offer', description: 'We craft a strategic offer designed to win in competitive situations while protecting your interests.' },
  { icon: <FileText size={20} />, title: '5. Due Diligence', description: 'We coordinate inspections, reviews, and all paperwork to ensure a smooth transaction.' },
  { icon: <CheckCircle size={20} />, title: '6. Close & Move In', description: 'We guide you through closing day and hand over the keys to your new home.' },
]

export default function BuyingPage() {
  return (
    <div className="pt-20">
      <HeroSection
        title="Buying Your Dream Home"
        subtitle="Navigating Toronto's competitive real estate market requires expertise, strategy, and a trusted partner by your side."
        backgroundImage="https://images.unsplash.com/photo-1560184897-ae75f418493e?w=1920&q=80"
        fullHeight={false}
        cta={
          <Button variant="gold" size="xl" asChild>
            <Link href="/listings">Browse Listings</Link>
          </Button>
        }
      />

      <Section>
        <Container>
          <ContentBlock eyebrow="Our Process" title="How We Help You Buy" body="A clear, stress-free journey from search to keys." centered />
          <div className="mt-16">
            <FeatureGrid features={steps} columns={3} />
          </div>
        </Container>
      </Section>

      <Section background="light">
        <Container>
          <SplitSection image="https://images.unsplash.com/photo-1605146769289-440113cc3d00?w=900&q=80">
            <ContentBlock
              eyebrow="Buyer Resources"
              title="Your Complete Buying Guide"
              body="From mortgage pre-approval to closing day, our comprehensive guide walks you through every step of purchasing a home in Toronto."
            >
              <div className="mt-6">
                <Button variant="primary" size="lg" asChild>
                  <Link href="/contact">Speak with an Agent</Link>
                </Button>
              </div>
            </ContentBlock>
          </SplitSection>
        </Container>
      </Section>

      <Section background="charcoal">
        <Container size="sm">
          <ContentBlock eyebrow="Start Your Search" title="Ready to Find Your Home?" body="Connect with us today and let's find your perfect property." centered light />
          <div className="mt-10 bg-white rounded-3xl p-8">
            <LeadCaptureForm title="" source="buying_page" />
          </div>
        </Container>
      </Section>
    </div>
  )
}
