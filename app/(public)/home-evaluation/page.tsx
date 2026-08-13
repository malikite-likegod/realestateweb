import type { Metadata } from 'next'
import { HeroSection, Container, Section, ContentBlock, FeatureGrid } from '@/components/layout'
import { HomeValuationForm } from '@/components/forms'
import { TrendingUp, ClipboardCheck, MapPin, Clock } from 'lucide-react'

export const metadata: Metadata = { title: 'Free Home Evaluation', description: 'Get a free, no-obligation home valuation report for your Toronto property.' }

const points = [
  { icon: <TrendingUp size={20} />, title: 'Accurate Market Pricing', description: 'We analyze recent comparable sales and current market conditions to price your home precisely.' },
  { icon: <MapPin size={20} />, title: 'Local Expertise', description: 'Deep knowledge of your neighbourhood means a valuation that reflects what buyers are really paying nearby.' },
  { icon: <ClipboardCheck size={20} />, title: 'No Obligation', description: 'Your report is free, with zero pressure or commitment to list with us.' },
  { icon: <Clock size={20} />, title: 'Fast Turnaround', description: "We'll be in touch within 24 hours with your home's estimated market value." },
]

export default function HomeEvaluationPage() {
  return (
    <div className="pt-20">
      <HeroSection
        title="What's Your Home Really Worth?"
        subtitle="Get a free, no-obligation home evaluation from a local market expert — find out what your home could sell for today."
        backgroundImage="https://images.unsplash.com/photo-1582407947304-fd86f028f716?w=1920&q=80"
        fullHeight={false}
      />

      <Section>
        <Container>
          <ContentBlock eyebrow="Why Get an Evaluation" title="Know Your Home's True Value" centered />
          <div className="mt-16">
            <FeatureGrid features={points} columns={4} />
          </div>
        </Container>
      </Section>

      <Section background="charcoal">
        <Container size="sm">
          <ContentBlock eyebrow="Free Home Evaluation" title="Get Your Free Report" body="Tell us a bit about your property and we'll prepare a detailed market analysis, no obligation." centered light />
          <div className="mt-10 bg-white rounded-3xl p-8">
            <HomeValuationForm source="home_evaluation_page" />
          </div>
        </Container>
      </Section>
    </div>
  )
}
