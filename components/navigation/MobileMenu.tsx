'use client'

import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Phone } from 'lucide-react'
import { NAV_LINKS, APP_NAME } from '@/lib/constants'
import { Button } from '@/components/ui'

interface MobileMenuProps {
  open: boolean
  onClose: () => void
}

export function MobileMenu({ open, onClose }: MobileMenuProps) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm lg:hidden"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 bottom-0 z-50 w-80 bg-white shadow-2xl flex flex-col lg:hidden"
          >
            <div className="flex items-center justify-between px-6 py-5 border-b border-charcoal-100">
              <span className="font-serif text-xl font-bold text-charcoal-900">{APP_NAME}</span>
              <button onClick={onClose} className="p-2 text-charcoal-500 hover:text-charcoal-900">
                <X size={20} />
              </button>
            </div>
            <nav className="flex flex-col py-4 flex-1">
              {NAV_LINKS.map(link => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={onClose}
                  className="px-6 py-3.5 text-base font-medium text-charcoal-700 hover:bg-charcoal-50 hover:text-charcoal-900 transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
            <div className="px-6 py-6 border-t border-charcoal-100 flex flex-col gap-3">
              <a href="tel:+16471234567" className="flex items-center gap-2 text-charcoal-600">
                <Phone size={16} /> (647) 123-4567
              </a>
              <Button variant="gold" fullWidth onClick={onClose} asChild>
                <Link href="/contact">Get in Touch</Link>
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
