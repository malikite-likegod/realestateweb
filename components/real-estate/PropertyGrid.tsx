'use client'

import { motion } from 'framer-motion'
import { PropertyCard } from './PropertyCard'
import { Spinner } from '@/components/ui'
import type { PropertySummary } from '@/types'

interface PropertyGridProps {
  properties: PropertySummary[]
  loading?: boolean
  columns?: 2 | 3 | 4
}

const colMap = { 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-2 lg:grid-cols-3', 4: 'sm:grid-cols-2 lg:grid-cols-4' }

export function PropertyGrid({ properties, loading, columns = 3 }: PropertyGridProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner size={32} />
      </div>
    )
  }

  if (properties.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-charcoal-500 text-lg">No properties found</p>
        <p className="text-charcoal-400 text-sm mt-2">Try adjusting your search filters</p>
      </div>
    )
  }

  return (
    <motion.div
      className={`grid grid-cols-1 gap-6 ${colMap[columns]}`}
      initial="hidden"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.08 } } }}
    >
      {properties.map((property, i) => (
        <motion.div
          key={property.id}
          variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}
          transition={{ duration: 0.4 }}
        >
          <PropertyCard property={property} featured={i === 0} />
        </motion.div>
      ))}
    </motion.div>
  )
}
