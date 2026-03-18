import Link from 'next/link'
import Image from 'next/image'
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
    { label: 'Login', href: '/admin/login' },
  ],
}

const socialLinks = [
  { icon: Instagram, href: 'https://www.instagram.com/miketaylorrealestate/', label: 'Instagram' },
  { icon: Facebook, href: 'https://www.facebook.com/profile.php?id=100077757978224', label: 'Facebook' },
  { icon: Linkedin, href: 'https://www.linkedin.com/in/michael-taylor-81a1275a/', label: 'LinkedIn' },
]

export function Footer() {
  return (
    <footer className="bg-charcoal-950 text-charcoal-300">

      {/* ── Brand hero ── */}
      <div className="border-b border-charcoal-800">
        <Container>
          <div className="py-16 flex flex-col items-center gap-6 text-center">

            <Link href="/" aria-label={APP_NAME}>
              <Image
                src="/uploads/LOGO_horizontal_color%20on%20transparent.png"
                alt={APP_NAME}
                width={640}
                height={192}
                className="h-48 w-auto object-contain"
                priority
              />
            </Link>

            <p className="max-w-sm text-sm leading-relaxed text-charcoal-400">
              GTHA&apos;s premier first time home buyer &amp; upsizer specialist.
              Helping clients transition with confidence to a place that fits them.
            </p>

            {/* Social icons */}
            <div className="flex gap-3 pt-1">
              {socialLinks.map(({ icon: Icon, href, label }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-charcoal-800 text-charcoal-400 hover:bg-gold-600 hover:text-white transition-colors"
                >
                  <Icon size={18} />
                </a>
              ))}
            </div>

          </div>
        </Container>
      </div>

      {/* ── Nav links ── */}
      <Container>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-10 py-12">
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h4 className="mb-4 text-xs font-semibold uppercase tracking-widest text-gold-400">
                {category}
              </h4>
              <ul className="flex flex-col gap-3">
                {links.map(link => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-charcoal-400 hover:text-white transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* ── Bottom bar ── */}
        <div className="border-t border-charcoal-800 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-charcoal-500">
          <div className="flex flex-wrap justify-center sm:justify-start gap-5">
            <a href="tel:+14168888352" className="flex items-center gap-1.5 hover:text-white transition-colors">
              <Phone size={13} /> (416) 888-8352
            </a>
            <a href="mailto:miketaylor.realty@gmail.com" className="flex items-center gap-1.5 hover:text-white transition-colors">
              <Mail size={13} /> miketaylor.realty@gmail.com
            </a>
            <span className="flex items-center gap-1.5">
              <MapPin size={13} /> Toronto, Ontario, Canada
            </span>
          </div>
          <p className="shrink-0">© {new Date().getFullYear()} {APP_NAME}. All rights reserved.</p>
        </div>
        <div className="border-t border-charcoal-800 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-charcoal-500">
          <div className="flex flex-wrap justify-center sm:justify-start gap-5">
            <span className="items-center gap-1.5">
              <p className="shrink-0 text-wrap">© Copyright 2026 All rights reserved. Toronto Regional Real Estate Board (TRREB) assumes no responsibility for the accuracy of any information shown. The information provided herein must only be used by consumers that have a bona fide interest in the purchase, sale or lease of real estate and may not be used for any commercial purpose or any other purpose. </p>
            </span>
          </div>
        </div>
      </Container>

    </footer>
  )
}
