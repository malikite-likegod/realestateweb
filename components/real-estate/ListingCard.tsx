'use client'

import { motion } from 'framer-motion'
import Image from 'next/image'
import Link from 'next/link'
import { Bed, Bath, Square, MapPin } from 'lucide-react'
import { formatPrice } from '@/lib/utils'
import type { IdxPropertySummary } from '@/types'

interface ListingCardProps {
  listing: IdxPropertySummary
}

export function ListingCard({ listing }: ListingCardProps) {
  const image = listing.images?.[0] ?? '/placeholder-property.jpg'
  return (
    <motion.div whileHover={{ y: -4 }} transition={{ duration: 0.2 }} className="group rounded-2xl overflow-hidden bg-white border border-charcoal-100 shadow-sm hover:shadow-md transition-shadow">
      <Link href={`/listings/idx/${listing.idxId}`}>
        <div className="relative aspect-[4/3] overflow-hidden">
          <Image src={image} alt={listing.address ?? 'Property'} fill className="object-cover group-hover:scale-105 transition-transform duration-500" sizes="33vw" />
        </div>
        <div className="p-4">
          {listing.price && <p className="text-xl font-bold text-charcoal-900 font-serif">{formatPrice(listing.price)}</p>}
          <p className="mt-1 flex items-center gap-1 text-sm text-charcoal-600">
            <MapPin size={12} /> {listing.address}, {listing.city}
          </p>
          <div className="mt-3 flex items-center gap-3 text-xs text-charcoal-500 border-t border-charcoal-100 pt-3">
            {listing.bedrooms != null && <span className="flex items-center gap-1"><Bed size={12} /> {listing.bedrooms}</span>}
            {listing.bathrooms != null && <span className="flex items-center gap-1"><Bath size={12} /> {listing.bathrooms}</span>}
            {listing.mlsNumber && <span className="text-charcoal-300">MLS® {listing.mlsNumber}</span>}
          </div>
        </div>
      </Link>
    </motion.div>
  )
}
