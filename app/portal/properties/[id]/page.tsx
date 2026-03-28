import { redirect, notFound } from 'next/navigation'
import { Bed, Bath, Car, Ruler, MapPin, Building2, Calendar } from 'lucide-react'
import { getContactSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PortalHeader } from '@/components/portal/PortalHeader'
import { PortalSaveButton } from '@/components/portal/PortalSaveButton'
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
    const items = JSON.parse(media ?? '[]') as { url: string; order?: number }[]
    const sorted = items.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map(i => i.url)
    return sorted.length > 0 ? sorted : ['/images/minimal-light-placeholder.svg']
  } catch {
    return ['/images/minimal-light-placeholder.svg']
  }
}

function isLease(transactionType: string | null) {
  return (transactionType ?? '').toLowerCase().includes('lease')
}

export default async function PropertyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const contact = await getContactSession()
  if (!contact) redirect('/portal/login')

  const [property, saved] = await Promise.all([
    prisma.resoProperty.findUnique({ where: { id } }),
    prisma.contactPropertyInterest.findFirst({
      where: { contactId: contact.id, resoPropertyId: id, source: 'portal_saved' },
    }),
  ])

  if (!property) notFound()

  const images  = getImages(property.media)
  const address = getAddress(property)
  const lease   = isLease(property.transactionType)
  const isSaved = !!saved

  return (
    <>
      <PortalHeader firstName={contact.firstName} />
      <main className="max-w-5xl mx-auto px-4 py-8">

        {/* Back link */}
        <a href="/portal" className="text-sm text-gray-500 hover:text-gray-700 mb-4 inline-block">← Back to listings</a>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Photo gallery */}
          <div className="space-y-2">
            <div className="relative rounded-xl overflow-hidden h-72 bg-gray-100">
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
                  <div key={i} className="relative h-20 bg-gray-100 rounded-lg overflow-hidden">
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
            <div className="flex items-start justify-between gap-2 mb-2">
              <h1 className="text-xl font-bold text-gray-900">{address}</h1>
              <PortalSaveButton propertyId={property.id} initialSaved={isSaved} />
            </div>

            <p className="text-sm text-gray-500 flex items-center gap-1 mb-3">
              <MapPin size={13} />
              {[property.city, property.stateOrProvince, property.postalCode].filter(Boolean).join(', ')}
            </p>

            <p className="text-3xl font-bold text-gray-900 mb-1">
              {property.listPrice
                ? `$${property.listPrice.toLocaleString()}${lease ? '/mo' : ''}`
                : 'Price N/A'}
            </p>

            {property.propertySubType && (
              <p className="text-sm text-gray-500 capitalize mb-4">{property.propertySubType}</p>
            )}

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              {property.bedroomsTotal != null && (
                <div className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2.5">
                  <Bed size={16} className="text-amber-500" />
                  <div>
                    <p className="text-xs text-gray-500">Bedrooms</p>
                    <p className="text-sm font-semibold text-gray-900">{property.bedroomsTotal}</p>
                  </div>
                </div>
              )}
              {property.bathroomsTotalInteger != null && (
                <div className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2.5">
                  <Bath size={16} className="text-amber-500" />
                  <div>
                    <p className="text-xs text-gray-500">Bathrooms</p>
                    <p className="text-sm font-semibold text-gray-900">{property.bathroomsTotalInteger}</p>
                  </div>
                </div>
              )}
              {property.garageSpaces != null && property.garageSpaces > 0 && (
                <div className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2.5">
                  <Car size={16} className="text-amber-500" />
                  <div>
                    <p className="text-xs text-gray-500">Garage</p>
                    <p className="text-sm font-semibold text-gray-900">{property.garageSpaces} spaces</p>
                  </div>
                </div>
              )}
              {property.livingArea != null && (
                <div className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2.5">
                  <Ruler size={16} className="text-amber-500" />
                  <div>
                    <p className="text-xs text-gray-500">Living Area</p>
                    <p className="text-sm font-semibold text-gray-900">{Math.round(property.livingArea).toLocaleString()} sqft</p>
                  </div>
                </div>
              )}
              {property.yearBuilt != null && (
                <div className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2.5">
                  <Calendar size={16} className="text-amber-500" />
                  <div>
                    <p className="text-xs text-gray-500">Year Built</p>
                    <p className="text-sm font-semibold text-gray-900">{property.yearBuilt}</p>
                  </div>
                </div>
              )}
              {property.lotSizeSquareFeet != null && (
                <div className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2.5">
                  <Ruler size={16} className="text-amber-500" />
                  <div>
                    <p className="text-xs text-gray-500">Lot Size</p>
                    <p className="text-sm font-semibold text-gray-900">{Math.round(property.lotSizeSquareFeet).toLocaleString()} sqft</p>
                  </div>
                </div>
              )}
            </div>

            {/* Agent / Office */}
            {(property.listAgentFullName || property.listOfficeName) && (
              <div className="flex items-start gap-2 rounded-lg bg-gray-50 px-3 py-2.5 mb-4">
                <Building2 size={16} className="text-gray-400 mt-0.5 shrink-0" />
                <div>
                  {property.listAgentFullName && (
                    <p className="text-sm text-gray-700">{property.listAgentFullName}</p>
                  )}
                  {property.listOfficeName && (
                    <p className="text-xs text-gray-500">{property.listOfficeName}</p>
                  )}
                </div>
              </div>
            )}

            {/* List date */}
            {property.listDate && (
              <p className="text-xs text-gray-400">
                Listed {new Date(property.listDate).toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' })}
              </p>
            )}
          </div>
        </div>

        {/* Description */}
        {property.publicRemarks && (
          <div className="mt-8">
            <h2 className="text-base font-semibold text-gray-900 mb-2">About this property</h2>
            <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{property.publicRemarks}</p>
          </div>
        )}

        <div className="mt-10"><MlsDisclaimer variant="vow" /></div>
      </main>
    </>
  )
}
