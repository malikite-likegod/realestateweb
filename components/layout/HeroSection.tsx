'use client'

import { motion } from 'framer-motion'
import Image from 'next/image'
import { cn } from '@/lib/utils'

interface HeroSectionProps {
  title: string
  subtitle?: string
  cta?: React.ReactNode
  backgroundImage?: string
  overlay?: boolean
  centered?: boolean
  fullHeight?: boolean
  children?: React.ReactNode
  className?: string
}

export function HeroSection({
  title,
  subtitle,
  cta,
  backgroundImage,
  overlay = true,
  centered = true,
  fullHeight = true,
  children,
  className,
}: HeroSectionProps) {
  return (
    <section className={cn(
      'relative flex items-center',
      fullHeight ? 'min-h-screen' : 'min-h-[60vh]',
      className,
    )}>
      {backgroundImage && (
        <Image
          src={backgroundImage}
          alt=""
          fill
          priority
          className="object-cover"
          sizes="100vw"
        />
      )}
      {overlay && backgroundImage && (
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/30 to-black/60" />
      )}
      <div className={cn('relative z-10 w-full px-4 sm:px-6 lg:px-8', centered && 'text-center')}>
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className={cn('max-w-4xl', centered && 'mx-auto')}
        >
          <motion.h1
            className={cn(
              'font-serif text-5xl sm:text-6xl lg:text-7xl font-bold leading-tight',
              backgroundImage ? 'text-white' : 'text-charcoal-900',
            )}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1 }}
          >
            {title}
          </motion.h1>
          {subtitle && (
            <motion.p
              className={cn(
                'mt-6 text-lg sm:text-xl leading-relaxed',
                backgroundImage ? 'text-white/85' : 'text-charcoal-600',
              )}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              {subtitle}
            </motion.p>
          )}
          {cta && (
            <motion.div
              className={cn('mt-8 flex flex-wrap gap-4', centered && 'justify-center')}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.3 }}
            >
              {cta}
            </motion.div>
          )}
          {children}
        </motion.div>
      </div>
    </section>
  )
}
