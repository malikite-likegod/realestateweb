'use server'

import { redirect, notFound } from 'next/navigation'
import { Bed, Bath, Car, Ruler, Calendar, MapPin, Tag, Building2, ExternalLink, ChevronLeft } from 'lucide-react'
import { getContactSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PortalHeader } from '@/components/portal/PortalHeader'
import { PortalSaveButton } from '@/components/portal/PortalSaveButton'
import { MlsDisclaimer } from '@/components/mls/MlsDisclaimer'
import { PackageViewTracker } from '@/components/portal/PackageViewTracker'
import { PhotoGallery } from '@/components/real-estate/PhotoGallery'
import { ListingMap } from '@/components/real-estate/ListingMap'
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
    const items = JSON.parse(media ?? '[]') as { url: string; order?: number }[]
    const sorted = items.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map(i => i.url)
    return sorted.length > 0 ? sorted : []
  } catch {
    return []
  }
}

function isLease(transactionType: string | null) {
  return (transactionType ?? '').toLowerCase().includes('lease')
}

function row(label: string, value: string | number | null | undefined): DetailRow | null {
  if (value == null || value === '') return null
  return { label, value }
}

function yn(label: string, value: boolean | null | undefined): DetailRow | null {
  if (value == null) return null
  return { label, value: value ? 'Yes' : 'No' }
}

export default async function PropertyDetailPage({
  params,
  searchParams,
}: {
  params:       Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { id }          = await params
  const resolvedParams  = await searchParams
  const packageItemId   = resolvedParams.packageItemId as string | undefined
  const token           = resolvedParams.token         as string | undefined
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

  const statusLabel = property.standardStatus ?? 'Active'
  const badgeVariant: 'green' | 'blue' = lease ? 'blue' : 'green'
  const badgeText = lease ? 'For Lease' : 'For Sale'

  // Computed totals
  const totalBedrooms = (property.bedroomsTotal ?? 0) + (property.bedroomsPlus ?? 0)
  const totalKitchens = (property.kitchensTotal ?? 0) + (property.kitchensPlusTotal ?? 0)

  // Tab data
  const tabInterior: DetailRow[] = [
    row('Bedrooms',           property.bedroomsTotal),
    row('Bedrooms Plus',      property.bedroomsPlus),
    totalBedrooms > 0 && property.bedroomsPlus ? { label: 'Total Bedrooms', value: totalBedrooms } : null,
    row('Washrooms',          property.bathroomsTotalInteger),
    row('Partial Bathrooms',  property.bathroomsPartial),
    row('Square Footage',     property.sqftRange ? `${property.sqftRange} sqft` : null),
    row('Garage Spaces',      property.garageSpaces),
    row('Parking Total',      property.parkingTotal),
    row('Basement',           property.basement),
    row('Heating Source',     property.heatSource),
    row('Heating Fuel',       property.heatType),
    row('Air Conditioning',   property.airConditioning),
    row('Family Room',        property.familyRoom),
    row('Kitchens',           property.kitchensTotal),
    row('Kitchens Plus',      property.kitchensPlusTotal),
    totalKitchens > 0 && property.kitchensPlusTotal ? { label: 'Total Kitchens', value: totalKitchens } : null,
    row('Fireplace Features', property.fireplaceFeatures),
    yn('Pool',                property.poolPrivateYN),
  ].filter((d): d is DetailRow => d !== null)

  const tabExterior: DetailRow[] = [
    row('Exterior',           property.exteriorFeatures),
    row('Construction',       property.constructionMaterials),
    row('Roof',               property.roof),
    row('Foundation',         property.foundationDetails),
    row('Parking Features',   property.parkingFeatures),
    row('Pool Features',      property.poolFeatures),
    row('Fronting On',        property.frontingOn),
    property.lotFront != null ? { label: 'Lot Frontage (ft)', value: property.lotFront } : null,
    property.lotDepth != null ? { label: 'Lot Depth (ft)',    value: property.lotDepth } : null,
    row('Waterfront',         property.waterFrontType),
  ].filter((d): d is DetailRow => d !== null)

  const tabBuilding: DetailRow[] = [
    row('Style',              property.style ?? property.propertySubType),
    row('Ownership',          property.ownershipType),
    row('Storeys',            property.storiesTotal),
    row('Approximate Age',    property.approximateAge),
    row('Sewer',              property.sewer),
    row('Water',              property.water),
  ].filter((d): d is DetailRow => d !== null)

  const tabCommunity: DetailRow[] = [
    row('Community',          property.community),
    row('Municipality',       property.municipality),
    row('Cross Street',       property.crossStreet),
    row('City',               property.city),
    row('Province',           property.stateOrProvince),
    row('Postal Code',        property.postalCode),
    row('Amenities',          property.amenities),
  ].filter((d): d is DetailRow => d !== null)

  const tabTaxes: DetailRow[] = [
    property.taxAnnualAmount != null ? { label: 'Annual Taxes',    value: `$${property.taxAnnualAmount.toLocaleString()}` } : null,
    row('Tax Year',           property.taxYear),
    property.maintenanceFee != null  ? { label: 'Maintenance Fee', value: `$${property.maintenanceFee.toLocaleString()}/mo` } : null,
    row('Fee Includes',       property.maintenanceFeeIncludes),
    row('Assessment Year',    property.assessmentYear),
    row('Inclusions',         property.inclusions),
    row('Exclusions',         property.exclusions),
  ].filter((d): d is DetailRow => d !== null)

  return (
    <>
      <PortalHeader firstName={contact.firstName} />
      {packageItemId && token && (
        <PackageViewTracker token={token} packageItemId={packageItemId} />
      )}
      <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">

        {/* Back */}
        <a href="/portal" className="inline-flex items-center gap-1 text-sm text-charcoal-500 hover:text-charcoal-800">
          <ChevronLeft size={14} /> Back to listings
        </a>

        {/* Photo gallery */}
        <PhotoGallery images={images} address={address} badge={badgeText} badgeVariant={badgeVariant} />

        {/* Main content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Left — details */}
          <div className="lg:col-span-2 space-y-6">

            {/* Title & price */}
            <div>
              <h1 className="text-2xl font-bold text-charcoal-900">{address}</h1>
              <p className="text-sm text-charcoal-500 flex items-center gap-1 mt-1">
                <MapPin size={13} />
                {[property.city, property.stateOrProvince, property.postalCode].filter(Boolean).join(', ')}
              </p>
              <p className="text-3xl font-bold text-charcoal-900 mt-3">
                {property.listPrice
                  ? `$${property.listPrice.toLocaleString()}${lease ? '/mo' : ''}`
                  : 'Price N/A'}
              </p>
              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                {property.ownershipType && (
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gold-100 text-gold-700">{property.ownershipType}</span>
                )}
                {property.propertySubType && (
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-charcoal-100 text-charcoal-600">{property.propertySubType}</span>
                )}
                {property.style && (
                  <span className="text-xs text-charcoal-500">{property.style}</span>
                )}
                {property.approximateAge && (
                  <span className="text-xs text-charcoal-400">· {property.approximateAge}</span>
                )}
              </div>
            </div>

            {/* Key stats bar */}
            <div className="flex flex-wrap gap-4">
              {property.bedroomsTotal != null && (
                <div className="flex items-center gap-1.5 text-sm text-charcoal-700">
                  <Bed size={15} className="text-gold-500" />
                  <span className="font-medium">{property.bedroomsTotal}</span> bed{property.bedroomsTotal !== 1 ? 's' : ''}
                  {property.bedroomsPlus ? <span className="text-charcoal-400">+{property.bedroomsPlus}</span> : null}
                </div>
              )}
              {property.bathroomsTotalInteger != null && (
                <div className="flex items-center gap-1.5 text-sm text-charcoal-700">
                  <Bath size={15} className="text-gold-500" />
                  <span className="font-medium">{property.bathroomsTotalInteger}</span> bath{property.bathroomsTotalInteger !== 1 ? 's' : ''}
                  {property.bathroomsPartial ? <span className="text-charcoal-400">+{property.bathroomsPartial} partial</span> : null}
                </div>
              )}
              {property.garageSpaces != null && property.garageSpaces > 0 && (
                <div className="flex items-center gap-1.5 text-sm text-charcoal-700">
                  <Car size={15} className="text-gold-500" />
                  <span className="font-medium">{property.garageSpaces}</span> garage
                </div>
              )}
              {(property.sqftRange || property.livingArea != null) && (
                <div className="flex items-center gap-1.5 text-sm text-charcoal-700">
                  <Ruler size={15} className="text-gold-500" />
                  <span className="font-medium">
                    {property.sqftRange ? `${property.sqftRange} sqft` : `${Math.round(property.livingArea!).toLocaleString()} sqft`}
                  </span>
                </div>
              )}
              {property.yearBuilt != null && (
                <div className="flex items-center gap-1.5 text-sm text-charcoal-700">
                  <Calendar size={15} className="text-gold-500" />
                  Built <span className="font-medium">{property.yearBuilt}</span>
                </div>
              )}
              {property.listingId && (
                <div className="flex items-center gap-1.5 text-sm text-charcoal-500">
                  <Tag size={13} />
                  MLS® {property.listingId}
                </div>
              )}
            </div>

            {/* Description */}
            {property.publicRemarks && (
              <div>
                <h2 className="text-sm font-semibold text-charcoal-900 uppercase tracking-wide mb-2">About this property</h2>
                <p className="text-sm text-charcoal-600 leading-relaxed whitespace-pre-line">{property.publicRemarks}</p>
              </div>
            )}

            {/* Map */}
            {property.latitude && property.longitude && (
              <ListingMap
                markers={[{ lat: property.latitude, lng: property.longitude, title: address }]}
                zoom={15}
                height="280px"
              />
            )}

            {/* Full Property Details tabs */}
            <PropertyDetailTabs
              interior={tabInterior}
              exterior={tabExterior}
              building={tabBuilding}
              community={tabCommunity}
              taxes={tabTaxes}
            />
          </div>

          {/* Right sidebar */}
          <div className="space-y-4">

            {/* Save */}
            <div className="rounded-xl border border-charcoal-200 p-4">
              <PortalSaveButton propertyId={property.id} initialSaved={isSaved} />
            </div>

            {/* Property details card */}
            <div className="rounded-xl border border-charcoal-200 overflow-hidden">
              <div className="px-4 py-3 bg-charcoal-50 border-b border-charcoal-100">
                <h2 className="text-sm font-semibold text-charcoal-900 uppercase tracking-wide">Property Details</h2>
              </div>
              <dl className="divide-y divide-charcoal-50 px-4">
                {[
                  ['Type',          property.propertySubType],
                  ['Sale Type',     property.transactionType],
                  ['Status',        statusLabel],
                  ['Ownership',     property.ownershipType],
                  ['Style',         property.style],
                  ['Approx. Age',   property.approximateAge],
                  ['Bedrooms',      property.bedroomsTotal != null ? (property.bedroomsPlus ? `${property.bedroomsTotal}+${property.bedroomsPlus}` : String(property.bedroomsTotal)) : null],
                  ['Bathrooms',     property.bathroomsTotalInteger != null ? (property.bathroomsPartial ? `${property.bathroomsTotalInteger} full, ${property.bathroomsPartial} partial` : String(property.bathroomsTotalInteger)) : null],
                  ['Parking',       property.parkingTotal != null ? String(property.parkingTotal) : null],
                  ['Square Footage', property.sqftRange ? `${property.sqftRange} sqft` : (property.livingArea != null ? `${Math.round(property.livingArea).toLocaleString()} sqft` : null)],
                  ['Lot',           property.lotFront != null && property.lotDepth != null ? `${property.lotFront} × ${property.lotDepth} ft` : (property.lotSizeSquareFeet != null ? `${Math.round(property.lotSizeSquareFeet).toLocaleString()} sqft` : null)],
                  ['Year Built',    property.yearBuilt != null ? String(property.yearBuilt) : null],
                  ['Community',     property.community],
                  ['Municipality',  property.municipality],
                  ['Annual Taxes',  property.taxAnnualAmount != null ? `$${property.taxAnnualAmount.toLocaleString()}` : null],
                  ['Maint. Fee',    property.maintenanceFee != null ? `$${property.maintenanceFee.toLocaleString()}/mo` : null],
                  ['MLS®',          property.listingId],
                  ['Listed',        property.listingContractDate ? new Date(property.listingContractDate).toLocaleDateString('en-CA') : null],
                  ['Postal Code',   property.postalCode],
                ].filter(([, v]) => v != null).map(([label, value]) => (
                  <div key={label} className="flex justify-between items-baseline py-2.5 gap-3">
                    <dt className="text-xs text-charcoal-500 shrink-0">{label}</dt>
                    <dd className="text-xs font-medium text-charcoal-900 text-right">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>

            {/* Agent / Office */}
            {(property.listAgentFullName || property.listOfficeName) && (
              <div className="rounded-xl border border-charcoal-200 p-4 flex items-start gap-2">
                <Building2 size={15} className="text-charcoal-400 mt-0.5 shrink-0" />
                <div>
                  {property.listAgentFullName && (
                    <p className="text-sm font-medium text-charcoal-800">{property.listAgentFullName}</p>
                  )}
                  {property.listOfficeName && (
                    <p className="text-xs text-charcoal-500">{property.listOfficeName}</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <MlsDisclaimer variant="vow" />
      </main>
    </>
  )
}
