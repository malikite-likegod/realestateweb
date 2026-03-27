import { headers, cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import { PropertyService } from '@/lib/property-service'
import { getGateSettings } from '@/lib/site-settings'
import { Container } from '@/components/layout'
import { PropertyGallery } from '@/components/real-estate'
import { PropertyInquiryForm } from '@/components/forms'
import { ListingGateModal } from '@/components/public/ListingGateModal'
import { Badge } from '@/components/ui'
import { formatPrice, parseJsonSafe } from '@/lib/utils'
import { Bed, Bath, Square, MapPin, Calendar } from 'lucide-react'
import type { Metadata } from 'next'
import { MlsDisclaimer } from '@/components/mls/MlsDisclaimer'
import { BrokerageAttribution } from '@/components/mls/BrokerageAttribution'

interface Props { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const property = await PropertyService.getProperty(id)
  if (!property) return {}
  const address = [property.streetNumber, property.streetName, property.city].filter(Boolean).join(' ')
  return {
    title: address || property.listingKey,
    description: property.publicRemarks ?? undefined,
  }
}

export default async function ListingDetailPage({ params }: Props) {
  const { id } = await params
  const property = await PropertyService.getProperty(id)
  if (!property) notFound()

  // ── Gate decision ──────────────────────────────────────────────────────────
  const reqHeaders  = await headers()
  const isBypass    = reqHeaders.get('x-gate-bypass')  === 'true'
  const isPending   = reqHeaders.get('x-gate-pending') === 'true'
  const viewCount   = parseInt(reqHeaders.get('x-view-count') ?? '0', 10)
  const { limit, enabled } = await getGateSettings()
  const showGate    = enabled && !isBypass && !isPending && viewCount >= limit
  const showPending = enabled && !isBypass && isPending

  // ── Track view for verified contacts ──────────────────────────────────────
  if (isBypass) {
    const cookieStore = await cookies()
    const contactId   = cookieStore.get('re_verified')?.value
    const sessionId   = reqHeaders.get('x-session-id') ?? undefined
    if (contactId) {
      const { trackBehaviorEvent } = await import('@/services/ai/lead-scoring')
      void trackBehaviorEvent('listing_view', property.id, contactId, sessionId, undefined).catch(() => null)
      const { prisma } = await import('@/lib/prisma')
      void prisma.contactPropertyInterest.upsert({
        where:  { contactId_resoPropertyId: { contactId, resoPropertyId: property.id } },
        update: { updatedAt: new Date() },
        create: { contactId, resoPropertyId: property.id, source: 'auto' },
      }).catch(() => null)
    }
  }

  const mediaItems = parseJsonSafe<{ url: string; order: number }[]>(property.media, [])
  const images     = mediaItems.length > 0 ? mediaItems.map(m => m.url) : ['/images/minimal-light-placeholder.svg']
  const address    = [property.streetNumber, property.streetName, property.unitNumber ? `#${property.unitNumber}` : null].filter(Boolean).join(' ')
  const returnUrl  = `/listings/${id}`

  return (
    <div className="pt-20">
      {(showGate || showPending) && (
        <ListingGateModal
          initialState={showPending ? 'pending' : 'gate'}
          returnUrl={returnUrl}
        />
      )}

      <div className={showGate || showPending ? 'blur-sm pointer-events-none select-none' : ''}>
        <Container className="py-8">
          <PropertyGallery images={images} title={address} />

          <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="font-serif text-4xl font-bold text-charcoal-900">
                    {formatPrice(property.listPrice ?? 0)}
                  </p>
                  <h1 className="text-xl font-semibold text-charcoal-700 mt-1">{address}</h1>
                  <p className="flex items-center gap-1.5 text-charcoal-500 mt-1">
                    <MapPin size={15} /> {property.city}, {property.stateOrProvince} {property.postalCode}
                  </p>
                  <BrokerageAttribution
                    listAgentFullName={property.listAgentFullName}
                    listOfficeName={property.listOfficeName}
                  />
                </div>
                <div className="flex flex-col gap-2 items-end">
                  <Badge variant={property.standardStatus === 'Active' ? 'success' : 'warning'} className="capitalize">
                    {property.standardStatus}
                  </Badge>
                  {property.propertySubType && (
                    <Badge variant="default" className="capitalize">{property.propertySubType}</Badge>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-6 py-5 border-y border-charcoal-100 mb-6">
                {property.bedroomsTotal         != null && <span className="flex items-center gap-2 text-charcoal-700"><Bed    size={18} /> <strong>{property.bedroomsTotal}</strong> Bedrooms</span>}
                {property.bathroomsTotalInteger != null && <span className="flex items-center gap-2 text-charcoal-700"><Bath   size={18} /> <strong>{property.bathroomsTotalInteger}</strong> Bathrooms</span>}
                {property.livingArea            != null && <span className="flex items-center gap-2 text-charcoal-700"><Square size={18} /> <strong>{Math.round(property.livingArea).toLocaleString()}</strong> sqft</span>}
                {property.yearBuilt             != null && <span className="flex items-center gap-2 text-charcoal-700"><Calendar size={18} /> Built <strong>{property.yearBuilt}</strong></span>}
              </div>

              {property.publicRemarks && (
                <div className="mb-8">
                  <h2 className="font-serif text-2xl font-bold text-charcoal-900 mb-3">About This Property</h2>
                  <p className="text-charcoal-600 leading-relaxed whitespace-pre-wrap">{property.publicRemarks}</p>
                </div>
              )}
            </div>

            <div>
              <PropertyInquiryForm
                propertyId={property.id}
                propertyTitle={address}
              />
            </div>
          </div>
        </Container>
        <MlsDisclaimer variant="idx" />
      </div>
    </div>

  )
}
