import type { Metadata } from 'next'
import { HeroSection, Container, Section, ContentBlock, FeatureGrid } from '@/components/layout'
import { LeadCaptureForm } from '@/components/forms'
import { Plane, MapPin, School, Stethoscope, ShoppingBag, Car } from 'lucide-react'

export const metadata: Metadata = { title: 'Relocation to Toronto', description: 'Moving to Toronto? Our relocation specialists make your transition seamless.' }

const services = [
  { icon: <Plane size={20} />, title: 'Relocation Planning', description: 'Comprehensive support before, during, and after your move to Toronto.' },
  { icon: <MapPin size={20} />, title: 'Neighbourhood Matching', description: 'We match you to the perfect neighbourhood based on your lifestyle and priorities.' },
  { icon: <School size={20} />, title: 'School Guidance', description: 'Detailed information on public, private, and international school options.' },
  { icon: <Stethoscope size={20} />, title: 'Healthcare Network', description: 'Connect with top doctors, specialists, and healthcare facilities.' },
  { icon: <ShoppingBag size={20} />, title: 'Local Resources', description: 'Curated guides to shopping, dining, culture, and community services.' },
  { icon: <Car size={20} />, title: 'Transport & Commute', description: 'Expert advice on commute times, transit options, and parking.' },
]

export default function RelocationPage() {
  return (
    <div className="pt-20">
      <HeroSection
        title="Relocating to Toronto?"
        subtitle="Moving to a new city is exciting and overwhelming. Our dedicated relocation specialists make your transition seamless and stress-free."
        backgroundImage="https://images.unsplash.com/photo-1517935706615-2717063c2225?w=1920&q=80"
        fullHeight={false}
      />
      <Section>
        <Container>
          <ContentBlock eyebrow="Relocation Services" title="Everything You Need to Settle In" centered />
          <div className="mt-16"><FeatureGrid features={services} columns={3} /></div>
        </Container>
      </Section>
      <Section background="charcoal">
        <Container size="sm">
          <ContentBlock eyebrow="Start Planning" title="Let's Plan Your Move" centered light />
          <div className="mt-10 bg-white rounded-3xl p-8">
            <LeadCaptureForm title="" source="relocation" />
          </div>
        </Container>
      </Section>
    </div>
  )
}
