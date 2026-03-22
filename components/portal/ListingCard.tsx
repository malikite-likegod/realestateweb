import Link from 'next/link'
import { SaveButton } from './SaveButton'

interface Property {
  id:        string
  title:     string
  status:    string
  price:     number | null
  bedrooms:  number | null
  bathrooms: number | null
  sqft:      number | null
  address:   string | null
  city:      string | null
  province:  string | null
  images:    unknown
}

interface Props {
  listing:  { id: string; property: Property }
  isSaved:  boolean
}

const statusColors: Record<string, string> = {
  active:  'bg-emerald-100 text-emerald-700',
  sold:    'bg-red-100 text-red-700',
  expired: 'bg-gray-100 text-gray-600',
  draft:   'bg-yellow-100 text-yellow-700',
}

export function ListingCard({ listing, isSaved }: Props) {
  const p = listing.property
  const images = Array.isArray(p.images) ? p.images as string[] : []
  const photo  = images[0] ?? null

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      <Link href={`/portal/listings/${listing.id}`}>
        <div className="h-48 bg-gray-100">
          {photo
            ? <img src={photo} alt={p.title} className="w-full h-full object-cover" />
            : <div className="w-full h-full flex items-center justify-center text-gray-300 text-sm">No photo</div>
          }
        </div>
      </Link>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{p.title || [p.address, p.city].filter(Boolean).join(', ')}</p>
            <p className="text-xs text-gray-500 truncate">{[p.address, p.city, p.province].filter(Boolean).join(', ')}</p>
          </div>
          <SaveButton listingId={listing.id} initialSaved={isSaved} />
        </div>
        <div className="flex items-center justify-between">
          <p className="text-base font-bold text-gray-900">
            {p.price ? `$${p.price.toLocaleString()}` : 'Price N/A'}
          </p>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${statusColors[p.status] ?? 'bg-gray-100 text-gray-600'}`}>
            {p.status}
          </span>
        </div>
        {(p.bedrooms || p.bathrooms || p.sqft) && (
          <p className="text-xs text-gray-400 mt-1">
            {[
              p.bedrooms  ? `${p.bedrooms} bed`  : null,
              p.bathrooms ? `${p.bathrooms} bath` : null,
              p.sqft      ? `${p.sqft.toLocaleString()} sqft` : null,
            ].filter(Boolean).join(' · ')}
          </p>
        )}
      </div>
    </div>
  )
}
