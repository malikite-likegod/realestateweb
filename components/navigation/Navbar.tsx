'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import { Menu, Phone } from 'lucide-react'
import { cn } from '@/lib/utils'
import { NAV_LINKS, APP_NAME } from '@/lib/constants'
import { Button } from '@/components/ui'
import { MobileMenu } from './MobileMenu'

export function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()
  const isHome = pathname === '/'

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  // On non-home pages the nav is always solid; on the home page it starts transparent
  const solid = !isHome || scrolled

  return (
    <>
      <motion.header
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.5 }}
        className={cn(
          'fixed top-0 left-0 right-0 z-40 transition-all duration-300',
          solid ? 'bg-white/95 backdrop-blur-md shadow-sm' : 'bg-transparent',
        )}
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-20 items-center justify-between">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2">
              <span className={cn(
                'font-serif text-2xl font-bold tracking-tight transition-colors',
                solid ? 'text-charcoal-900' : 'text-white',
              )}>
                {APP_NAME}
              </span>
            </Link>

            {/* Desktop nav */}
            <nav className="hidden lg:flex items-center gap-8">
              {NAV_LINKS.map(link => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    'text-sm font-medium tracking-wide transition-colors hover:text-gold-500',
                    solid ? 'text-charcoal-700' : 'text-white/90',
                  )}
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            {/* CTA */}
            <div className="hidden lg:flex items-center gap-4">
              <a
                href="tel:+14168888352"
                className={cn(
                  'flex items-center gap-1.5 text-sm font-medium transition-colors',
                  solid ? 'text-charcoal-700' : 'text-white/90',
                )}
              >
                <Phone size={15} />
                (416) 888-8352
              </a>
              <Button variant="gold" size="sm" asChild>
                <Link href="/contact">Get in Touch</Link>
              </Button>
            </div>

            {/* Mobile toggle */}
            <button
              onClick={() => setMobileOpen(true)}
              className={cn('lg:hidden p-2', solid ? 'text-charcoal-900' : 'text-white')}
            >
              <Menu size={24} />
            </button>
          </div>
        </div>
      </motion.header>

      <MobileMenu open={mobileOpen} onClose={() => setMobileOpen(false)} />
    </>
  )
}
