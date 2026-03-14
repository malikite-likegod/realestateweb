import type { Metadata } from 'next'
import { HeroSection, Container, Section, ContentBlock, FeatureGrid } from '@/components/layout'
import { HomeValuationForm } from '@/components/forms'
import { TrendingUp, Camera, Megaphone, DollarSign, Shield, Clock } from 'lucide-react'

export const metadata: Metadata = { title: 'Selling Your Home', description: 'Sell your Toronto home for maximum value with our proven strategy.' }

const services = [
  { icon: <TrendingUp size={20} />, title: 'Strategic Pricing', description: 'Our data-driven pricing strategy positions your home to attract maximum buyer interest and multiple offers.' },
  { icon: <Camera size={20} />, title: 'Premium Marketing', description: 'Professional photography, 3D tours, video walkthroughs, and targeted digital advertising.' },
  { icon: <Megaphone size={20} />, title: 'Maximum Exposure', description: 'Your listing reaches thousands of qualified buyers through MLS, social media, and our exclusive network.' },
  { icon: <DollarSign size={20} />, title: 'Expert Negotiation', description: 'We negotiate aggressively on your behalf to secure the highest possible price and best terms.' },
  { icon: <Shield size={20} />, title: 'Full Protection', description: 'We handle all paperwork, disclosures, and legal requirements to protect your interests throughout the sale.' },
  { icon: <Clock size={20} />, title: 'Fast Results', description: 'Our proven process consistently sells homes faster than the market average.' },
]

export default function SellingPage() {
  return (
    <div className="pt-20">
      <HeroSection
        title="Sell Your Home for Maximum Value"
        subtitle="Our proven marketing strategy and expert negotiation consistently deliver above-asking results for our sellers."
        backgroundImage="https://images.unsplash.com/photo-1582407947304-fd86f028f716?w=1920&q=80"
        fullHeight={false}
      />

      <Section>
        <Container>
          <ContentBlock eyebrow="Our Selling Services" title="Everything You Need to Sell Successfully" centered />
          <div className="mt-16">
            <FeatureGrid features={services} columns={3} />
          </div>
        </Container>
      </Section>

      <Section id="valuation" background="charcoal">
        <Container size="sm">
          <ContentBlock eyebrow="Free Home Valuation" title="What Is Your Home Worth?" body="Get a professional market analysis with no obligation. Find out what your home could sell for in today's market." centered light />
          <div className="mt-10 bg-white rounded-3xl p-8">
            <HomeValuationForm />
          </div>
        </Container>
      </Section>
    </div>
  )
}
