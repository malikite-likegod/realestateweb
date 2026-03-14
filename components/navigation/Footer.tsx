import Link from 'next/link'
import { Phone, Mail, MapPin, Instagram, Facebook, Linkedin } from 'lucide-react'
import { APP_NAME } from '@/lib/constants'
import { Container } from '@/components/layout'

const footerLinks = {
  'Buy & Sell': [
    { label: 'Buying a Home', href: '/buying' },
    { label: 'Selling a Home', href: '/selling' },
    { label: 'Current Listings', href: '/listings' },
    { label: 'Home Valuation', href: '/selling#valuation' },
  ],
  'Explore': [
    { label: 'Communities', href: '/communities' },
    { label: 'Relocation Guide', href: '/relocation' },
    { label: 'Blog & Resources', href: '/blog' },
    { label: 'Market Reports', href: '/blog?tag=market' },
  ],
  'Company': [
    { label: 'About Us', href: '/about' },
    { label: 'Contact', href: '/contact' },
    { label: 'Privacy Policy', href: '/privacy' },
    { label: 'Terms of Service', href: '/terms' },
  ],
}

export function Footer() {
  return (
    <footer className="bg-charcoal-950 text-charcoal-300">
      <Container>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 py-16">
          {/* Brand */}
          <div className="flex flex-col gap-5">
            <Link href="/" className="font-serif text-2xl font-bold text-white">{APP_NAME}</Link>
            <p className="text-sm leading-relaxed text-charcoal-400">
              GTHA&apos;s premier first time home buyer & upsizer specialist. Helping clients transition with confidence to a place that fits them.
            </p>
            <div className="flex gap-3">
              {[Instagram, Facebook, Linkedin].map((Icon, i) => (
                <a key={i} href="#" className="flex h-9 w-9 items-center justify-center rounded-lg bg-charcoal-800 text-charcoal-400 hover:bg-gold-600 hover:text-white transition-colors">
                  <Icon size={16} />
                </a>
              ))}
            </div>
          </div>

          {/* Links */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white">{category}</h4>
              <ul className="flex flex-col gap-2.5">
                {links.map(link => (
                  <li key={link.href}>
                    <Link href={link.href} className="text-sm text-charcoal-400 hover:text-white transition-colors">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Contact strip */}
        <div className="border-t border-charcoal-800 py-6 flex flex-wrap items-center justify-between gap-4 text-sm text-charcoal-500">
          <div className="flex flex-wrap gap-6">
            <a href="tel:+14168888352" className="flex items-center gap-2 hover:text-white transition-colors">
              <Phone size={14} /> (416) 888-8352
            </a>
            <a href="mailto:miketaylor.realty@gmail.com" className="flex items-center gap-2 hover:text-white transition-colors">
              <Mail size={14} /> miketaylor.realty@gmail.com
            </a>
            <span className="flex items-center gap-2">
              <MapPin size={14} /> Toronto, Ontario, Canada
            </span>
          </div>
          <p>© {new Date().getFullYear()} {APP_NAME}. All rights reserved.</p>
        </div>
      </Container>
    </footer>
  )
}
