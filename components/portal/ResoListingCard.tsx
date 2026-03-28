import Link from 'next/link'
import { Bed, Bath, Car, Ruler } from 'lucide-react'
import { PortalSaveButton } from './PortalSaveButton'

export interface ResoProperty {
  id:                   string
  listingKey:           string
  propertyType:         string | null
  propertySubType:      string | null
  transactionType:      string | null
  listPrice:            number | null
  bedroomsTotal:        number | null
  bathroomsTotalInteger: number | null
  garageSpaces:         number | null
  livingArea:           number | null
  streetNumber:         string | null
  streetName:           string | null
  streetSuffix:         string | null
  unitNumber:           string | null
  city:                 string
  stateOrProvince:      string
  postalCode:           string | null
  media:                string | null
  listAgentFullName:    string | null
  listOfficeName:       string | null
  isSaved:              boolean
}

function getAddress(p: ResoProperty): string {
  return [p.streetNumber, p.streetName, p.streetSuffix, p.unitNumber ? `#${p.unitNumber}` : null]
    .filter(Boolean).join(' ') || p.listingKey
}

function getFirstImage(media: string | null): string {
  try {
    const items = JSON.parse(media ?? '[]') as { url: string; order?: number }[]
    return items.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))[0]?.url ?? '/images/minimal-light-placeholder.svg'
  } catch {
    return '/images/minimal-light-placeholder.svg'
  }
}

function isLease(p: ResoProperty) {
  return (p.transactionType ?? '').toLowerCase().includes('lease')
}

export function ResoListingCard({ property }: { property: ResoProperty }) {
  const address = getAddress(property)
  const photo   = getFirstImage(property.media)
  const lease   = isLease(property)

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      <Link href={`/portal/properties/${property.id}`}>
        <div className="relative h-48 bg-gray-100">
          <img src={photo} alt={address} className="w-full h-full object-cover" />
          <span className={`absolute top-2 left-2 text-xs font-semibold px-2 py-0.5 rounded-full ${
            lease ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'
          }`}>
            {lease ? 'For Lease' : 'For Sale'}
          </span>
        </div>
      </Link>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-1">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{address}</p>
            <p className="text-xs text-gray-500 truncate">{[property.city, property.stateOrProvince, property.postalCode].filter(Boolean).join(', ')}</p>
          </div>
          <PortalSaveButton propertyId={property.id} initialSaved={property.isSaved} />
        </div>

        <p className="text-base font-bold text-gray-900 mt-1">
          {property.listPrice
            ? `$${property.listPrice.toLocaleString()}${lease ? '/mo' : ''}`
            : 'Price N/A'}
        </p>

        {property.propertySubType && (
          <p className="text-xs text-gray-400 mt-0.5 capitalize">{property.propertySubType}</p>
        )}

        <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-500">
          {property.bedroomsTotal != null && (
            <span className="flex items-center gap-1"><Bed size={12} />{property.bedroomsTotal} bed</span>
          )}
          {property.bathroomsTotalInteger != null && (
            <span className="flex items-center gap-1"><Bath size={12} />{property.bathroomsTotalInteger} bath</span>
          )}
          {property.garageSpaces != null && property.garageSpaces > 0 && (
            <span className="flex items-center gap-1"><Car size={12} />{property.garageSpaces} garage</span>
          )}
          {property.livingArea != null && (
            <span className="flex items-center gap-1"><Ruler size={12} />{Math.round(property.livingArea).toLocaleString()} sqft</span>
          )}
        </div>
      </div>
    </div>
  )
}
