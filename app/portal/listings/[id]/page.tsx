import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { Bed, Bath, Car, Ruler, Calendar, MapPin, Tag, ExternalLink, ChevronLeft } from 'lucide-react'
import { getContactSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PortalHeader } from '@/components/portal/PortalHeader'
import { SaveButton } from '@/components/portal/SaveButton'
import { MlsDisclaimer } from '@/components/mls/MlsDisclaimer'
import { BrokerageAttribution } from '@/components/mls/BrokerageAttribution'
import { PhotoGallery } from '@/components/real-estate/PhotoGallery'
import { ListingMap } from '@/components/real-estate/ListingMap'

function fmtDate(d: Date | null | undefined) {
  if (!d) return null
  return new Date(d).toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' })
}

export default async function ListingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const contact = await getContactSession()
  if (!contact) redirect('/portal/login')

  const { id } = await params
  const listing = await prisma.listing.findUnique({
    where:   { id },
    include: {
      property: {
        select: {
          id: true, title: true, status: true, price: true,
          bedrooms: true, bathrooms: true, sqft: true, parkingSpaces: true,
          lotSize: true, lotSizeUnit: true, yearBuilt: true,
          address: true, city: true, province: true, postalCode: true,
          latitude: true, longitude: true,
          images: true, features: true, description: true,
          virtualTourUrl: true, openHouseDate: true,
          listedAt: true, soldAt: true,
          listingType: true, propertyType: true,
          mlsNumber: true,
        },
      },
      savedByContacts: { where: { contactId: contact.id }, select: { id: true } },
    },
  })

  if (!listing) notFound()
  if (listing.property.status === 'draft') notFound()

  const p      = listing.property
  const isSaved = listing.savedByContacts.length > 0

  // Parse JSON string fields
  const images: string[] = (() => {
    try { const v = JSON.parse(p.images ?? '[]'); return Array.isArray(v) ? v : [] } catch { return [] }
  })()
  const features: string[] = (() => {
    try { const v = JSON.parse(p.features ?? '[]'); return Array.isArray(v) ? v : [] } catch { return [] }
  })()

  const isRental   = p.listingType === 'rent' || p.listingType === 'lease'
  const badge      = p.listingType === 'lease' ? 'For Lease' : p.listingType === 'rent' ? 'For Rent' : 'For Sale'
  const lotSizeStr = p.lotSize != null ? `${Number(p.lotSize).toLocaleString()} ${p.lotSizeUnit ?? 'sqft'}` : null
  const hasMap     = p.latitude != null && p.longitude != null
  const openHouse  = p.openHouseDate && new Date(p.openHouseDate) > new Date() ? fmtDate(p.openHouseDate) : null

  type DetailRow = { label: string; value: string | number }
  const details: DetailRow[] = ([
    p.propertyType     ? { label: 'Property Type', value: p.propertyType }                                              : null,
    { label: 'Sale Type', value: badge },
    p.status           ? { label: 'Status',         value: p.status }                                                   : null,
    p.bedrooms  != null ? { label: 'Bedrooms',      value: p.bedrooms }                                                 : null,
    p.bathrooms != null ? { label: 'Bathrooms',     value: p.bathrooms }                                                : null,
    p.parkingSpaces != null ? { label: 'Parking',   value: p.parkingSpaces }                                            : null,
    p.sqft      != null ? { label: 'Living Area',   value: `${Number(p.sqft).toLocaleString()} sqft` }                 : null,
    lotSizeStr          ? { label: 'Lot Size',       value: lotSizeStr }                                                 : null,
    p.yearBuilt != null ? { label: 'Year Built',    value: p.yearBuilt }                                                : null,
    p.mlsNumber        ? { label: 'MLS #',           value: p.mlsNumber }                                               : null,
    fmtDate(p.listedAt)  ? { label: 'List Date',    value: fmtDate(p.listedAt) as string }                             : null,
    fmtDate(p.soldAt)    ? { label: 'Sold Date',    value: fmtDate(p.soldAt)   as string }                             : null,
    p.postalCode        ? { label: 'Postal Code',    value: p.postalCode }                                              : null,
  ] as (DetailRow | null)[]).filter((d): d is DetailRow => d !== null)

  return (
    <>
      <PortalHeader firstName={contact.firstName} />
      <main className="max-w-6xl mx-auto px-4 py-8">

        <Link href="/portal" className="inline-flex items-center gap-1 text-sm text-charcoal-500 hover:text-charcoal-900 mb-6 transition-colors">
          <ChevronLeft size={16} /> Back to listings
        </Link>

        <PhotoGallery
          images={images}
          address={p.address}
          badge={badge}
          badgeVariant={isRental ? 'blue' : 'green'}
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* ── Left: main content ── */}
          <div className="lg:col-span-2 space-y-6">

            {/* Title, address, price */}
            <div>
              <h1 className="text-2xl font-bold text-charcoal-900 mb-1">{p.title || p.address}</h1>
              <p className="text-sm text-charcoal-500 flex items-center gap-1 mb-3">
                <MapPin size={13} />
                {[p.address, p.city, p.province, p.postalCode].filter(Boolean).join(', ')}
              </p>
              <p className="text-4xl font-bold text-charcoal-900">
                {p.price ? `$${Number(p.price).toLocaleString()}${isRental ? '/mo' : ''}` : 'Price N/A'}
              </p>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${
                  p.status === 'sold'   ? 'bg-red-100 text-red-700'         :
                  p.status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                                          'bg-charcoal-100 text-charcoal-600'
                }`}>{p.status}</span>
                <BrokerageAttribution />
              </div>
            </div>

            {/* Key stats */}
            <div className="flex flex-wrap gap-3">
              {p.bedrooms != null && (
                <div className="flex items-center gap-2 rounded-xl bg-charcoal-50 px-4 py-3 min-w-[90px]">
                  <Bed size={18} className="text-gold-500 shrink-0" />
                  <div>
                    <p className="text-xs text-charcoal-500">Beds</p>
                    <p className="text-base font-bold text-charcoal-900">{p.bedrooms}</p>
                  </div>
                </div>
              )}
              {p.bathrooms != null && (
                <div className="flex items-center gap-2 rounded-xl bg-charcoal-50 px-4 py-3 min-w-[90px]">
                  <Bath size={18} className="text-gold-500 shrink-0" />
                  <div>
                    <p className="text-xs text-charcoal-500">Baths</p>
                    <p className="text-base font-bold text-charcoal-900">{p.bathrooms}</p>
                  </div>
                </div>
              )}
              {p.parkingSpaces != null && (
                <div className="flex items-center gap-2 rounded-xl bg-charcoal-50 px-4 py-3 min-w-[90px]">
                  <Car size={18} className="text-gold-500 shrink-0" />
                  <div>
                    <p className="text-xs text-charcoal-500">Parking</p>
                    <p className="text-base font-bold text-charcoal-900">{p.parkingSpaces}</p>
                  </div>
                </div>
              )}
              {p.sqft != null && (
                <div className="flex items-center gap-2 rounded-xl bg-charcoal-50 px-4 py-3 min-w-[90px]">
                  <Ruler size={18} className="text-gold-500 shrink-0" />
                  <div>
                    <p className="text-xs text-charcoal-500">Sqft</p>
                    <p className="text-base font-bold text-charcoal-900">{Number(p.sqft).toLocaleString()}</p>
                  </div>
                </div>
              )}
              {p.yearBuilt != null && (
                <div className="flex items-center gap-2 rounded-xl bg-charcoal-50 px-4 py-3 min-w-[90px]">
                  <Calendar size={18} className="text-gold-500 shrink-0" />
                  <div>
                    <p className="text-xs text-charcoal-500">Built</p>
                    <p className="text-base font-bold text-charcoal-900">{p.yearBuilt}</p>
                  </div>
                </div>
              )}
              {lotSizeStr && (
                <div className="flex items-center gap-2 rounded-xl bg-charcoal-50 px-4 py-3 min-w-[90px]">
                  <Ruler size={18} className="text-gold-500 shrink-0" />
                  <div>
                    <p className="text-xs text-charcoal-500">Lot</p>
                    <p className="text-base font-bold text-charcoal-900">{lotSizeStr}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Open house notice */}
            {openHouse && (
              <div className="flex items-center gap-3 rounded-xl bg-gold-50 border border-gold-200 px-4 py-3">
                <Calendar size={16} className="text-gold-600 shrink-0" />
                <p className="text-sm font-medium text-charcoal-800">Open House: {openHouse}</p>
              </div>
            )}

            {/* Virtual tour */}
            {p.virtualTourUrl && (
              <a
                href={p.virtualTourUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm font-medium text-gold-700 hover:text-gold-800 transition-colors"
              >
                <ExternalLink size={15} /> Take a Virtual Tour
              </a>
            )}

            {/* Description */}
            {p.description && (
              <div>
                <h2 className="text-base font-semibold text-charcoal-900 mb-2">About this property</h2>
                <p className="text-sm text-charcoal-600 leading-relaxed whitespace-pre-line">{p.description}</p>
              </div>
            )}

            {/* Features */}
            {features.length > 0 && (
              <div>
                <h2 className="text-base font-semibold text-charcoal-900 mb-3">Features</h2>
                <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                  {features.map((f, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-charcoal-600">
                      <span className="w-1.5 h-1.5 rounded-full bg-gold-500 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Map */}
            {hasMap && (
              <div>
                <h2 className="text-base font-semibold text-charcoal-900 mb-3">Location</h2>
                <ListingMap
                  markers={[{ lat: p.latitude!, lng: p.longitude!, title: p.address, price: p.price ?? undefined }]}
                  zoom={15}
                  height="320px"
                />
              </div>
            )}
          </div>

          {/* ── Right: sidebar ── */}
          <div className="space-y-4">

            {/* Save */}
            <div className="rounded-xl border border-charcoal-100 p-4">
              <h3 className="text-xs font-semibold text-charcoal-500 uppercase tracking-wide mb-3">Save this listing</h3>
              <SaveButton listingId={listing.id} initialSaved={isSaved} />
            </div>

            {/* Property details */}
            <div className="rounded-xl border border-charcoal-100 p-4">
              <h3 className="text-xs font-semibold text-charcoal-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <Tag size={12} /> Property Details
              </h3>
              <dl className="divide-y divide-charcoal-50">
                {details.map(({ label, value }) => (
                  <div key={label} className="flex justify-between py-2 gap-2">
                    <dt className="text-xs text-charcoal-500 shrink-0">{label}</dt>
                    <dd className="text-xs font-medium text-charcoal-900 text-right">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </div>

        <div className="mt-10">
          <MlsDisclaimer variant="vow" />
        </div>
      </main>
    </>
  )
}
