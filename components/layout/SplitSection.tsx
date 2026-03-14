'use client'

import { motion } from 'framer-motion'
import Image from 'next/image'
import { cn } from '@/lib/utils'

interface SplitSectionProps {
  image: string
  imageAlt?: string
  imagePosition?: 'left' | 'right'
  children: React.ReactNode
  className?: string
}

export function SplitSection({ image, imageAlt = '', imagePosition = 'right', children, className }: SplitSectionProps) {
  return (
    <div className={cn('grid grid-cols-1 lg:grid-cols-2 items-center gap-12 lg:gap-20', className)}>
      {imagePosition === 'left' && (
        <motion.div
          className="relative aspect-[4/3] rounded-2xl overflow-hidden"
          initial={{ opacity: 0, x: -30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
        >
          <Image src={image} alt={imageAlt} fill className="object-cover" />
        </motion.div>
      )}
      <motion.div
        initial={{ opacity: 0, x: imagePosition === 'left' ? 30 : -30 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.7 }}
      >
        {children}
      </motion.div>
      {imagePosition === 'right' && (
        <motion.div
          className="relative aspect-[4/3] rounded-2xl overflow-hidden"
          initial={{ opacity: 0, x: 30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
        >
          <Image src={image} alt={imageAlt} fill className="object-cover" />
        </motion.div>
      )}
    </div>
  )
}
