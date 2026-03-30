import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { Bed, Bath, Car, Ruler, MapPin, Building2, Calendar, ChevronLeft } from 'lucide-react'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { MlsDisclaimer } from '@/components/mls/MlsDisclaimer'

function getAddress(p: {
  streetNumber: string | null; streetName: string | null;
  streetSuffix: string | null; unitNumber: string | null; listingKey: string
}): string {
  return [p.streetNumber, p.streetName, p.streetSuffix, p.unitNumber ? `#${p.unitNumber}` : null]
    .filter(Boolean).join(' ') || p.listingKey
}

function getImages(media: string | null): string[] {
  try {
    const items = JSON.parse(media ?? '[]') as { url?: string; MediaURL?: string; order?: number }[]
    const sorted = items.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map(i => i.url ?? i.MediaURL ?? '')
      .filter(Boolean)
    return sorted.length > 0 ? sorted : ['/images/minimal-light-placeholder.svg']
  } catch {
    return ['/images/minimal-light-placeholder.svg']
  }
}

function isLease(transactionType: string | null) {
  return (transactionType ?? '').toLowerCase().includes('lease')
}

export default async function AdminListingDetailPage({
  params,
  searchParams,
}: {
  params:       Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const session = await getSession()
  if (!session) redirect('/admin/login')

  const { id }     = await params
  const sp         = await searchParams
  const contactId  = sp.contactId  as string | undefined
  const contactName = sp.contactName as string | undefined

  const property = await prisma.resoProperty.findUnique({ where: { id } })
  if (!property) notFound()

  const images  = getImages(property.media)
  const address = getAddress(property)
  const lease   = isLease(property.transactionType)

  const backHref = contactId
    ? `/admin/listings/browse?contactId=${contactId}&contactName=${encodeURIComponent(contactName ?? '')}`
    : '/admin/listings/browse'

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* Back */}
      <Link href={backHref} className="inline-flex items-center gap-1 text-sm text-charcoal-500 hover:text-charcoal-900 mb-6 transition-colors">
        <ChevronLeft size={16} />
        Back to Browse
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Photo gallery */}
        <div className="space-y-2">
          <div className="relative rounded-xl overflow-hidden h-72 bg-charcoal-100">
            <img src={images[0]} alt={address} className="w-full h-full object-cover" />
            <span className={`absolute top-3 left-3 text-xs font-semibold px-2.5 py-1 rounded-full ${
              lease ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'
            }`}>
              {lease ? 'For Lease' : 'For Sale'}
            </span>
          </div>
          {images.length > 1 && (
            <div className="grid grid-cols-4 gap-1.5">
              {images.slice(1, 5).map((url, i) => (
                <div key={i} className="relative h-20 bg-charcoal-100 rounded-lg overflow-hidden">
                  <img src={url} alt={`${address} photo ${i + 2}`} className="w-full h-full object-cover" />
                  {i === 3 && images.length > 5 && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <span className="text-white text-xs font-semibold">+{images.length - 5} more</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Details */}
        <div>
          <h1 className="text-xl font-bold text-charcoal-900 mb-1">{address}</h1>

          <p className="text-sm text-charcoal-500 flex items-center gap-1 mb-3">
            <MapPin size={13} />
            {[property.city, property.stateOrProvince, property.postalCode].filter(Boolean).join(', ')}
          </p>

          <p className="text-3xl font-bold text-charcoal-900 mb-1">
            {property.listPrice
              ? `$${property.listPrice.toLocaleString()}${lease ? '/mo' : ''}`
              : 'Price N/A'}
          </p>

          {property.propertySubType && (
            <p className="text-sm text-charcoal-500 capitalize mb-4">{property.propertySubType}</p>
          )}

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            {property.bedroomsTotal != null && (
              <div className="flex items-center gap-2 rounded-lg bg-charcoal-50 px-3 py-2.5">
                <Bed size={16} className="text-gold-500" />
                <div>
                  <p className="text-xs text-charcoal-500">Bedrooms</p>
                  <p className="text-sm font-semibold text-charcoal-900">{property.bedroomsTotal}</p>
                </div>
              </div>
            )}
            {property.bathroomsTotalInteger != null && (
              <div className="flex items-center gap-2 rounded-lg bg-charcoal-50 px-3 py-2.5">
                <Bath size={16} className="text-gold-500" />
                <div>
                  <p className="text-xs text-charcoal-500">Bathrooms</p>
                  <p className="text-sm font-semibold text-charcoal-900">{property.bathroomsTotalInteger}</p>
                </div>
              </div>
            )}
            {property.garageSpaces != null && property.garageSpaces > 0 && (
              <div className="flex items-center gap-2 rounded-lg bg-charcoal-50 px-3 py-2.5">
                <Car size={16} className="text-gold-500" />
                <div>
                  <p className="text-xs text-charcoal-500">Garage</p>
                  <p className="text-sm font-semibold text-charcoal-900">{property.garageSpaces} spaces</p>
                </div>
              </div>
            )}
            {property.livingArea != null && (
              <div className="flex items-center gap-2 rounded-lg bg-charcoal-50 px-3 py-2.5">
                <Ruler size={16} className="text-gold-500" />
                <div>
                  <p className="text-xs text-charcoal-500">Living Area</p>
                  <p className="text-sm font-semibold text-charcoal-900">{Math.round(property.livingArea).toLocaleString()} sqft</p>
                </div>
              </div>
            )}
            {property.yearBuilt != null && (
              <div className="flex items-center gap-2 rounded-lg bg-charcoal-50 px-3 py-2.5">
                <Calendar size={16} className="text-gold-500" />
                <div>
                  <p className="text-xs text-charcoal-500">Year Built</p>
                  <p className="text-sm font-semibold text-charcoal-900">{property.yearBuilt}</p>
                </div>
              </div>
            )}
            {property.lotSizeSquareFeet != null && (
              <div className="flex items-center gap-2 rounded-lg bg-charcoal-50 px-3 py-2.5">
                <Ruler size={16} className="text-gold-500" />
                <div>
                  <p className="text-xs text-charcoal-500">Lot Size</p>
                  <p className="text-sm font-semibold text-charcoal-900">{Math.round(property.lotSizeSquareFeet).toLocaleString()} sqft</p>
                </div>
              </div>
            )}
          </div>

          {/* Agent / Office */}
          {(property.listAgentFullName || property.listOfficeName) && (
            <div className="flex items-start gap-2 rounded-lg bg-charcoal-50 px-3 py-2.5 mb-4">
              <Building2 size={16} className="text-charcoal-400 mt-0.5 shrink-0" />
              <div>
                {property.listAgentFullName && (
                  <p className="text-sm text-charcoal-700">{property.listAgentFullName}</p>
                )}
                {property.listOfficeName && (
                  <p className="text-xs text-charcoal-500">{property.listOfficeName}</p>
                )}
              </div>
            </div>
          )}

          {/* List date */}
          {property.listDate && (
            <p className="text-xs text-charcoal-400">
              Listed {new Date(property.listDate).toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
          )}

          {/* MLS key */}
          <p className="text-xs text-charcoal-300 mt-1">MLS# {property.listingKey}</p>
        </div>
      </div>

      {/* Description */}
      {property.publicRemarks && (
        <div className="mt-8">
          <h2 className="text-base font-semibold text-charcoal-900 mb-2">About this property</h2>
          <p className="text-sm text-charcoal-600 leading-relaxed whitespace-pre-line">{property.publicRemarks}</p>
        </div>
      )}

      {/* Private remarks (admin only) */}
      {property.privateRemarks && (
        <div className="mt-6 p-4 rounded-lg bg-gold-50 border border-gold-200">
          <h2 className="text-xs font-semibold text-gold-700 uppercase tracking-wide mb-1">Private Remarks (Admin)</h2>
          <p className="text-sm text-charcoal-700 leading-relaxed whitespace-pre-line">{property.privateRemarks}</p>
        </div>
      )}

      <div className="mt-10"><MlsDisclaimer variant="vow" /></div>
    </div>
  )
}
