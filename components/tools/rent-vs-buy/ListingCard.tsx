import { Card } from '@/components/layout'
import { Badge } from '@/components/ui'
import { formatPrice } from '@/lib/utils'
import { BedDouble, Bath, Ruler, MapPin } from 'lucide-react'
import type { ListingWithEstimate } from '@/lib/rent-vs-buy'

export function ListingCard({ listing }: { listing: ListingWithEstimate }) {
  return (
    <Card padding="lg" className="h-full flex flex-col">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h4 className="font-serif text-lg font-bold text-charcoal-900">{listing.address}</h4>
          <p className="text-sm text-charcoal-500">{listing.neighbourhood}, {listing.city}</p>
        </div>
        <Badge variant="gold">
          <span className="inline-flex items-center gap-1"><MapPin size={11} /> {listing.distanceKm} km</span>
        </Badge>
      </div>

      <p className="font-serif text-2xl font-bold text-charcoal-900 mt-3">{formatPrice(listing.price)}</p>

      <div className="mt-3 flex items-center gap-4 text-sm text-charcoal-600">
        <span className="inline-flex items-center gap-1"><BedDouble size={15} /> {listing.beds} bd</span>
        <span className="inline-flex items-center gap-1"><Bath size={15} /> {listing.baths} ba</span>
        <span className="inline-flex items-center gap-1"><Ruler size={15} /> {listing.sqft.toLocaleString()} sqft</span>
      </div>

      <div className="mt-4 flex-1 rounded-xl bg-charcoal-50 p-3">
        <p className="text-xs uppercase tracking-wide text-charcoal-500">Est. Monthly Mortgage Payment</p>
        <p className="text-lg font-bold text-charcoal-900">
          {formatPrice(listing.estimatedMonthlyPayment)}
          <span className="text-xs font-normal text-charcoal-500"> /mo (estimate)</span>
        </p>
      </div>
    </Card>
  )
}
