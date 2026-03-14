'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface ContentBlockProps {
  eyebrow?: string
  title: string
  body?: string
  children?: React.ReactNode
  centered?: boolean
  light?: boolean
  className?: string
}

export function ContentBlock({ eyebrow, title, body, children, centered, light, className }: ContentBlockProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6 }}
      className={cn(centered && 'text-center mx-auto max-w-3xl', className)}
    >
      {eyebrow && (
        <p className={cn('mb-3 text-sm font-semibold tracking-widest uppercase', light ? 'text-gold-400' : 'text-gold-600')}>
          {eyebrow}
        </p>
      )}
      <h2 className={cn('font-serif text-4xl font-bold leading-tight', light ? 'text-white' : 'text-charcoal-900')}>
        {title}
      </h2>
      {body && (
        <p className={cn('mt-5 text-lg leading-relaxed', light ? 'text-charcoal-300' : 'text-charcoal-600')}>
          {body}
        </p>
      )}
      {children && <div className="mt-6">{children}</div>}
    </motion.div>
  )
}
