'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface Feature {
  icon: React.ReactNode
  title: string
  description: string
}

interface FeatureGridProps {
  features: Feature[]
  columns?: 2 | 3 | 4
  className?: string
}

const colMap = { 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-2 lg:grid-cols-3', 4: 'sm:grid-cols-2 lg:grid-cols-4' }

export function FeatureGrid({ features, columns = 3, className }: FeatureGridProps) {
  return (
    <div className={cn('grid grid-cols-1 gap-8', colMap[columns], className)}>
      {features.map((f, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: i * 0.1 }}
          className="flex flex-col gap-4"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-charcoal-100 text-charcoal-700">
            {f.icon}
          </div>
          <h3 className="font-serif text-xl font-semibold text-charcoal-900">{f.title}</h3>
          <p className="text-charcoal-600 leading-relaxed">{f.description}</p>
        </motion.div>
      ))}
    </div>
  )
}
