import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { Bed, Bath, Car, Ruler, MapPin, Building2, Calendar, ChevronLeft, Tag, Hash } from 'lucide-react'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { MlsDisclaimer } from '@/components/mls/MlsDisclaimer'
import { ListingMap } from '@/components/real-estate/ListingMap'
import { PhotoGallery } from '@/components/real-estate/PhotoGallery'
import { PropertyDetailTabs, type DetailRow } from '@/components/real-estate/PropertyDetailTabs'

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

function fmtDate(d: Date | null | undefined) {
  if (!d) return null
  return new Date(d).toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' })
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

  const { id }      = await params
  const sp          = await searchParams
  const contactId   = sp.contactId   as string | undefined
  const contactName = sp.contactName as string | undefined

  const property = await prisma.resoProperty.findUnique({ where: { id } })
  if (!property) notFound()

  const images  = getImages(property.media)
  const address = getAddress(property)
  const lease   = isLease(property.transactionType)

  const backHref = contactId
    ? `/admin/listings/browse?contactId=${contactId}&contactName=${encodeURIComponent(contactName ?? '')}`
    : '/admin/listings/browse'

  const hasMap = property.latitude != null && property.longitude != null

  // Detail rows for the info table
  type DetailRow = { label: string; value: string | number }
  const details: DetailRow[] = ([
    property.propertySubType       ? { label: 'Property Type',   value: property.propertySubType }                                        : null,
    property.propertyType          ? { label: 'Style',            value: property.propertyType }                                          : null,
    property.transactionType       ? { label: 'Transaction',      value: property.transactionType }                                       : null,
    property.bedroomsTotal         != null ? { label: 'Bedrooms',      value: property.bedroomsTotal }                                   : null,
    property.bathroomsTotalInteger != null ? { label: 'Bathrooms',     value: property.bathroomsTotalInteger }                           : null,
    property.garageSpaces != null && property.garageSpaces > 0 ? { label: 'Garage Spaces', value: property.garageSpaces }               : null,
    property.livingArea        != null ? { label: 'Living Area',  value: `${Math.round(property.livingArea).toLocaleString()} sqft` }    : null,
    property.lotSizeSquareFeet != null ? { label: 'Lot Size',     value: `${Math.round(property.lotSizeSquareFeet).toLocaleString()} sqft` } : null,
    property.yearBuilt         != null ? { label: 'Year Built',   value: property.yearBuilt }                                            : null,
    property.poolPrivateYN         ? { label: 'Pool',             value: 'Yes' }                                                         : null,
    property.postalCode            ? { label: 'Postal Code',      value: property.postalCode }                                           : null,
    property.mlsStatus             ? { label: 'MLS Status',       value: property.mlsStatus }                                            : null,
    fmtDate(property.listDate)            ? { label: 'List Date',       value: fmtDate(property.listDate) as string }                    : null,
    fmtDate(property.listingContractDate) ? { label: 'Contract Date',   value: fmtDate(property.listingContractDate) as string }         : null,
    fmtDate(property.closeDate)           ? { label: 'Close Date',      value: fmtDate(property.closeDate) as string }                   : null,
    property.closePrice        != null ? { label: 'Close Price',  value: `$${property.closePrice.toLocaleString()}` }                   : null,
    property.originalListPrice != null ? { label: 'Original Price', value: `$${property.originalListPrice.toLocaleString()}` }          : null,
    property.listAgentFullName     ? { label: 'Listing Agent',    value: property.listAgentFullName }                                    : null,
    property.listOfficeName        ? { label: 'Listing Office',   value: property.listOfficeName }                                      : null,
  ] as (DetailRow | null)[]).filter((d): d is DetailRow => d !== null)

  // ── Full Property Details tab data ──────────────────────────────────────────
  function row(label: string, value: string | number | null | undefined): DetailRow | null {
    return value != null && value !== '' ? { label, value } : null
  }
  function yn(label: string, value: boolean | null | undefined, ifTrue = 'Yes', ifFalse = 'No'): DetailRow | null {
    return value != null ? { label, value: value ? ifTrue : ifFalse } : null
  }

  const totalBedrooms = (property.bedroomsTotal ?? 0) + (property.bedroomsPlus ?? 0)
  const totalKitchens = (property.kitchensTotal ?? 0) + (property.kitchensPlusTotal ?? 0)

  const tabInterior: DetailRow[] = [
    row('Bedrooms',          property.bedroomsTotal),
    row('Bedrooms Plus',     property.bedroomsPlus),
    totalBedrooms > 0 ? { label: 'Total Bedrooms', value: totalBedrooms } : null,
    row('Washrooms',         property.bathroomsTotalInteger),
    row('Garage Spaces',     property.garageSpaces),
    row('Parking Total',     property.parkingTotal),
    row('Basement',          property.basement),
    row('Heating Source',    property.heatSource),
    row('Heating Fuel',      property.heatType),
    row('Air Conditioning',  property.airConditioning),
    row('Family Room',       property.familyRoom),
    row('Kitchens',          property.kitchensTotal),
    row('Kitchens Plus',     property.kitchensPlusTotal),
    totalKitchens > 0 ? { label: 'Total Kitchens', value: totalKitchens } : null,
    row('Fireplace Features', property.fireplaceFeatures),
    yn('Pool',               property.poolPrivateYN),
  ].filter((d): d is DetailRow => d !== null)

  const tabExterior: DetailRow[] = [
    row('Exterior',          property.exteriorFeatures),
    row('Construction',      property.constructionMaterials),
    row('Roof',              property.roof),
    row('Foundation',        property.foundationDetails),
    row('Parking Features',  property.parkingFeatures),
    row('Pool Features',     property.poolFeatures),
    row('Fronting On',       property.frontingOn),
    property.lotFront != null ? row('Lot Frontage', `${property.lotFront} ft`) : null,
    property.lotDepth != null ? row('Lot Depth',    `${property.lotDepth} ft`) : null,
    row('Waterfront',        property.waterFrontType),
  ].filter((d): d is DetailRow => d !== null)

  const tabBuilding: DetailRow[] = [
    row('Style',             property.style ?? property.propertySubType),
    row('Storeys',           property.storiesTotal),
    row('Approximate Age',   property.approximateAge),
    row('Sewer',             property.sewer),
    row('Water',             property.water),
  ].filter((d): d is DetailRow => d !== null)

  const tabCommunity: DetailRow[] = [
    row('Community',         property.community),
    row('Municipality',      property.municipality),
    row('Cross Street',      property.crossStreet),
    row('City',              property.city),
    row('Province',          property.stateOrProvince),
    row('Postal Code',       property.postalCode),
  ].filter((d): d is DetailRow => d !== null)

  const tabTaxes: DetailRow[] = [
    property.taxAnnualAmount != null ? { label: 'Annual Taxes',    value: `$${property.taxAnnualAmount.toLocaleString()}` } : null,
    row('Tax Year',          property.taxYear),
    property.maintenanceFee != null  ? { label: 'Maintenance Fee', value: `$${property.maintenanceFee.toLocaleString()}/mo` } : null,
    row('Fee Includes',      property.maintenanceFeeIncludes),
    row('Assessment Year',   property.assessmentYear),
  ].filter((d): d is DetailRow => d !== null)

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      {/* Back */}
      <Link href={backHref} className="inline-flex items-center gap-1 text-sm text-charcoal-500 hover:text-charcoal-900 mb-6 transition-colors">
        <ChevronLeft size={16} />
        Back to Browse
      </Link>

      <PhotoGallery
        images={images}
        address={address}
        badge={lease ? 'For Lease' : 'For Sale'}
        badgeVariant={lease ? 'blue' : 'green'}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: main info */}
        <div className="lg:col-span-2 space-y-6">

          {/* Title + price */}
          <div>
            <h1 className="text-2xl font-bold text-charcoal-900 mb-1">{address}</h1>
            <p className="text-sm text-charcoal-500 flex items-center gap-1 mb-3">
              <MapPin size={13} />
              {[property.city, property.stateOrProvince, property.postalCode].filter(Boolean).join(', ')}
            </p>
            <p className="text-4xl font-bold text-charcoal-900">
              {property.listPrice
                ? `$${property.listPrice.toLocaleString()}${lease ? '/mo' : ''}`
                : 'Price N/A'}
            </p>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs text-charcoal-400 flex items-center gap-1">
                <Hash size={11} /> MLS# {property.listingKey}
              </span>
              {property.standardStatus && (
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-charcoal-100 text-charcoal-600">
                  {property.standardStatus}
                </span>
              )}
            </div>
          </div>

          {/* Key stats bar */}
          <div className="flex flex-wrap gap-3">
            {property.bedroomsTotal != null && (
              <div className="flex items-center gap-2 rounded-xl bg-charcoal-50 px-4 py-3 min-w-[90px]">
                <Bed size={18} className="text-gold-500 shrink-0" />
                <div>
                  <p className="text-xs text-charcoal-500">Beds</p>
                  <p className="text-base font-bold text-charcoal-900">{property.bedroomsTotal}</p>
                </div>
              </div>
            )}
            {property.bathroomsTotalInteger != null && (
              <div className="flex items-center gap-2 rounded-xl bg-charcoal-50 px-4 py-3 min-w-[90px]">
                <Bath size={18} className="text-gold-500 shrink-0" />
                <div>
                  <p className="text-xs text-charcoal-500">Baths</p>
                  <p className="text-base font-bold text-charcoal-900">{property.bathroomsTotalInteger}</p>
                </div>
              </div>
            )}
            {property.garageSpaces != null && property.garageSpaces > 0 && (
              <div className="flex items-center gap-2 rounded-xl bg-charcoal-50 px-4 py-3 min-w-[90px]">
                <Car size={18} className="text-gold-500 shrink-0" />
                <div>
                  <p className="text-xs text-charcoal-500">Garage</p>
                  <p className="text-base font-bold text-charcoal-900">{property.garageSpaces}</p>
                </div>
              </div>
            )}
            {property.livingArea != null && (
              <div className="flex items-center gap-2 rounded-xl bg-charcoal-50 px-4 py-3 min-w-[90px]">
                <Ruler size={18} className="text-gold-500 shrink-0" />
                <div>
                  <p className="text-xs text-charcoal-500">Sqft</p>
                  <p className="text-base font-bold text-charcoal-900">{Math.round(property.livingArea).toLocaleString()}</p>
                </div>
              </div>
            )}
            {property.yearBuilt != null && (
              <div className="flex items-center gap-2 rounded-xl bg-charcoal-50 px-4 py-3 min-w-[90px]">
                <Calendar size={18} className="text-gold-500 shrink-0" />
                <div>
                  <p className="text-xs text-charcoal-500">Built</p>
                  <p className="text-base font-bold text-charcoal-900">{property.yearBuilt}</p>
                </div>
              </div>
            )}
            {property.lotSizeSquareFeet != null && (
              <div className="flex items-center gap-2 rounded-xl bg-charcoal-50 px-4 py-3 min-w-[90px]">
                <Ruler size={18} className="text-gold-500 shrink-0" />
                <div>
                  <p className="text-xs text-charcoal-500">Lot</p>
                  <p className="text-base font-bold text-charcoal-900">{Math.round(property.lotSizeSquareFeet).toLocaleString()}</p>
                </div>
              </div>
            )}
          </div>

          {/* Description */}
          {property.publicRemarks && (
            <div>
              <h2 className="text-base font-semibold text-charcoal-900 mb-2">About this property</h2>
              <p className="text-sm text-charcoal-600 leading-relaxed whitespace-pre-line">{property.publicRemarks}</p>
            </div>
          )}

          {/* Private remarks (admin only) */}
          {property.privateRemarks && (
            <div className="p-4 rounded-xl bg-gold-50 border border-gold-200">
              <h2 className="text-xs font-semibold text-gold-700 uppercase tracking-wide mb-1.5">Private Remarks (Admin Only)</h2>
              <p className="text-sm text-charcoal-700 leading-relaxed whitespace-pre-line">{property.privateRemarks}</p>
            </div>
          )}

          {/* Map */}
          {hasMap && (
            <div>
              <h2 className="text-base font-semibold text-charcoal-900 mb-3">Location</h2>
              <ListingMap
                markers={[{ lat: property.latitude!, lng: property.longitude!, title: address, price: property.listPrice ?? undefined }]}
                zoom={15}
                height="320px"
              />
            </div>
          )}
        </div>

        {/* Right: detail table */}
        <div className="space-y-4">

          {/* Agent / Office card */}
          {(property.listAgentFullName || property.listOfficeName) && (
            <div className="rounded-xl border border-charcoal-100 p-4">
              <h3 className="text-xs font-semibold text-charcoal-500 uppercase tracking-wide mb-3">Listing Agent</h3>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-charcoal-100 flex items-center justify-center shrink-0">
                  <Building2 size={18} className="text-charcoal-400" />
                </div>
                <div>
                  {property.listAgentFullName && (
                    <p className="text-sm font-semibold text-charcoal-900">{property.listAgentFullName}</p>
                  )}
                  {property.listOfficeName && (
                    <p className="text-xs text-charcoal-500">{property.listOfficeName}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Property details table */}
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

          {/* Send to contact shortcut */}
          <Link
            href={`/admin/listings/browse?contactId=&contactName=`}
            className="block w-full text-center bg-charcoal-900 hover:bg-charcoal-700 text-white text-sm font-medium py-3 rounded-xl transition-colors"
          >
            Send to a Contact
          </Link>
        </div>
      </div>

      {/* Full property details — tabbed section */}
      <div className="mt-10">
        <PropertyDetailTabs
          interior={tabInterior}
          exterior={tabExterior}
          building={tabBuilding}
          community={tabCommunity}
          taxes={tabTaxes}
        />
      </div>

      <div className="mt-8"><MlsDisclaimer variant="vow" /></div>
    </div>
  )
}
