'use client'

import { motion } from 'framer-motion'
import Image from 'next/image'
import Link from 'next/link'
import { Bed, Bath, Square, MapPin, Heart } from 'lucide-react'
import { cn, formatPrice } from '@/lib/utils'
import { Badge } from '@/components/ui'
import type { PropertySummary } from '@/types'
import { BrokerageAttribution } from '@/components/mls/BrokerageAttribution'

interface PropertyCardProps {
  property: PropertySummary
  featured?: boolean
  className?: string
}

export function PropertyCard({ property, featured = false, className }: PropertyCardProps) {
  const images = property.images ?? []
  const mainImage = images[0] ?? '/placeholder-property.jpg'

  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
      className={cn('group rounded-2xl overflow-hidden bg-white border border-charcoal-100 shadow-sm hover:shadow-md transition-shadow', className)}
    >
      <Link href={`/listings/${property.id}`}>
        {/* Image */}
        <div className={cn('relative overflow-hidden', featured ? 'aspect-[16/10]' : 'aspect-[4/3]')}>
          <Image
            src={mainImage}
            alt={property.title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-500"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />

          {/* Badges */}
          <div className="absolute top-3 left-3 flex gap-2">
            <Badge variant={property.status === 'active' ? 'success' : 'warning'} className="capitalize">
              {property.listingType === 'lease' ? 'For Lease' : property.listingType === 'sale' ? 'For Sale' : 'For Rent'}
            </Badge>
            {featured && <Badge variant="gold">Featured</Badge>}
          </div>

          {/* Wishlist */}
          <button
            className="absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-charcoal-500 hover:text-red-500 transition-colors"
            onClick={e => e.preventDefault()}
          >
            <Heart size={14} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          <p className="text-xl font-bold text-charcoal-900 font-serif">{formatPrice(property.price)}</p>
          <h3 className="mt-1 text-sm font-medium text-charcoal-700 line-clamp-1">{property.title}</h3>
          <p className="mt-1 flex items-center gap-1 text-xs text-charcoal-400">
            <MapPin size={11} /> {property.address}, {property.city}
          </p>

          {/* Stats */}
          <div className="mt-3 flex items-center gap-4 border-t border-charcoal-100 pt-3 text-xs text-charcoal-600">
            {property.bedrooms != null && (
              <span className="flex items-center gap-1"><Bed size={13} /> {property.bedrooms} bd</span>
            )}
            {property.bathrooms != null && (
              <span className="flex items-center gap-1"><Bath size={13} /> {property.bathrooms} ba</span>
            )}
            {property.sqft != null && (
              <span className="flex items-center gap-1"><Square size={13} /> {property.sqft.toLocaleString()} sqft</span>
            )}
          </div>
          <BrokerageAttribution
            listAgentFullName={property.listAgentFullName}
            listOfficeName={property.listOfficeName}
          />
        </div>
      </Link>
    </motion.div>
  )
}
