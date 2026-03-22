import type { Metadata } from 'next'
import { Container } from '@/components/layout'
import { Section } from '@/components/layout'
import { ContentBlock } from '@/components/layout'
import { ContactForm } from '@/components/forms'
import { Phone, Mail, MapPin, Clock } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Contact Us',
  description: 'Get in touch with our team. We\'re here to help with all your real estate needs.',
}

const contactInfo = [
  { icon: Phone, label: 'Phone', value: '(416) 888-8352', href: 'tel:+14168888352' },
  { icon: Mail, label: 'Email', value: 'miketaylor.realty@gmail.com', href: 'mailto:miketaylor.realty@gmail.com' },
  { icon: MapPin, label: 'Office', value: 'Union Capital Realty Brokerage  - 245 West Beaver Creek Road, Richmond Hill, ON L4B 1L9', href: undefined },
  { icon: Clock, label: 'Hours', value: 'Mon–Sat 9am–7pm, Sun 11am–5pm', href: undefined },
]

export default function ContactPage() {
  return (
    <div className="pt-20">
      <Section background="light" padding="md">
        <Container>
          <ContentBlock eyebrow="Get in Touch" title="I'd Love to Hear From You" body="Whether you're buying, selling, or just exploring your options, I'm ready to help." centered />
        </Container>
      </Section>

      <Section>
        <Container>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
            {/* Form */}
            <div className="rounded-3xl border border-charcoal-100 shadow-sm p-8">
              <h2 className="font-serif text-2xl font-bold text-charcoal-900 mb-6">Send a Message</h2>
              <ContactForm />
            </div>

            {/* Info */}
            <div className="flex flex-col gap-8">
              <div>
                <h2 className="font-serif text-2xl font-bold text-charcoal-900 mb-6">Contact Information</h2>
                <div className="flex flex-col gap-6">
                  {contactInfo.map(({ icon: Icon, label, value, href }) => (
                    <div key={label} className="flex items-start gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-charcoal-100 text-charcoal-700 shrink-0">
                        <Icon size={18} />
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-charcoal-400 mb-0.5">{label}</p>
                        {href ? (
                          <a href={href} className="text-charcoal-900 hover:text-gold-600 transition-colors">{value}</a>
                        ) : (
                          <p className="text-charcoal-700">{value}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Container>
      </Section>
    </div>
  )
}
