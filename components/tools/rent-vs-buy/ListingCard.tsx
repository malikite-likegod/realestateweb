import Link from 'next/link'
import { Card } from '@/components/layout'
import { Badge } from '@/components/ui'
import { formatPrice } from '@/lib/utils'
import { BedDouble, Bath, Ruler, MapPin } from 'lucide-react'
import type { RentVsBuyListing } from '@/lib/rent-vs-buy'
import { getDisplayCity } from '@/lib/trreb-districts'

export function ListingCard({ listing }: { listing: RentVsBuyListing }) {
  const displayCity = getDisplayCity(listing.city)
  return (
    <Link href={`/listings/${listing.listingKey}`} className="block h-full">
      <Card padding="none" hover className="relative h-full min-h-[380px] flex flex-col overflow-hidden">
        {/* Photo background, or a branded fallback when no MLS media is synced yet */}
        {listing.imageUrl ? (
          <img
            src={listing.imageUrl}
            alt={listing.address}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-charcoal-800 to-charcoal-950" />
        )}
        {/* Grey gradient scrim — dark across the whole photo, darkest at the bottom */}
        <div className="absolute inset-0 bg-gradient-to-t from-charcoal-950/95 via-charcoal-950/80 to-charcoal-950/45" />

        <div className="relative z-10 flex flex-1 flex-col p-5 text-white">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h4 className="font-serif text-lg font-bold drop-shadow-sm">{listing.address}</h4>
              <p className="text-sm text-white/80">
                {listing.neighbourhood ? `${listing.neighbourhood}, ${displayCity}` : displayCity}
              </p>
            </div>
            {listing.distanceKm != null && (
              <Badge variant="gold">
                <span className="inline-flex items-center gap-1"><MapPin size={11} /> {listing.distanceKm} km</span>
              </Badge>
            )}
          </div>

          <p className="font-serif text-2xl font-bold mt-3 drop-shadow-sm">{formatPrice(listing.price)}</p>

          <div className="mt-3 flex items-center gap-4 text-sm text-white/90">
            {listing.beds != null && <span className="inline-flex items-center gap-1"><BedDouble size={15} /> {listing.beds} bd</span>}
            {listing.baths != null && <span className="inline-flex items-center gap-1"><Bath size={15} /> {listing.baths} ba</span>}
            {listing.sqft != null && <span className="inline-flex items-center gap-1"><Ruler size={15} /> {listing.sqft.toLocaleString()} sqft</span>}
          </div>

          {/* Transparent — sits directly on the darkened photo, set off by a top divider */}
          <div className="mt-4 flex-1 border-t border-white/20 pt-3">
            <p className="text-xs uppercase tracking-wide text-white/70">Est. Monthly Mortgage Payment</p>
            <p className="text-lg font-bold text-white drop-shadow-sm">
              {formatPrice(listing.estimatedMonthlyPayment)}
              <span className="text-xs font-normal text-white/70"> /mo (estimate)</span>
            </p>
          </div>

          <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold">
            View listing →
          </span>
        </div>
      </Card>
    </Link>
  )
}
