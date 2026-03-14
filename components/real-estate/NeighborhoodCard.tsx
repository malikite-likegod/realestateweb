'use client'

import { motion } from 'framer-motion'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

interface NeighborhoodCardProps {
  name: string
  slug: string
  description: string
  image: string
  listingCount?: number
}

export function NeighborhoodCard({ name, slug, description, image, listingCount }: NeighborhoodCardProps) {
  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
      className="group relative aspect-[3/4] rounded-2xl overflow-hidden cursor-pointer"
    >
      <Link href={`/communities/${slug}`}>
        <Image src={image} alt={name} fill className="object-cover group-hover:scale-105 transition-transform duration-500" sizes="33vw" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-6">
          <h3 className="font-serif text-2xl font-bold text-white mb-1">{name}</h3>
          <p className="text-white/70 text-sm line-clamp-2 mb-3">{description}</p>
          <div className="flex items-center justify-between">
            {listingCount != null && (
              <span className="text-xs text-white/60">{listingCount} listings</span>
            )}
            <span className="flex items-center gap-1 text-gold-400 text-sm font-medium group-hover:gap-2 transition-all">
              Explore <ArrowRight size={14} />
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  )
}
