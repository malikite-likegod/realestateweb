import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { Container } from '@/components/layout'
import { Section } from '@/components/layout'
import { PropertyGallery } from '@/components/real-estate'
import { PropertyInquiryForm } from '@/components/forms'
import { Badge } from '@/components/ui'
import { formatPrice, parseJsonSafe } from '@/lib/utils'
import { Bed, Bath, Square, MapPin, Calendar, Car } from 'lucide-react'
import type { Metadata } from 'next'

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const property = await prisma.property.findUnique({ where: { id } })
  if (!property) return {}
  return { title: property.title, description: property.description ?? undefined }
}

export default async function ListingDetailPage({ params }: Props) {
  const { id } = await params
  const property = await prisma.property.findUnique({
    where: { id },
    include: { listings: true },
  })
  if (!property) notFound()

  const images = parseJsonSafe<string[]>(property.images, ['/placeholder-property.jpg'])
  const features = parseJsonSafe<string[]>(property.features, [])

  return (
    <div className="pt-20">
      <Container className="py-8">
        {/* Gallery */}
        <PropertyGallery images={images} title={property.title} />

        <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main info */}
          <div className="lg:col-span-2">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="font-serif text-4xl font-bold text-charcoal-900">{formatPrice(property.price)}</p>
                <h1 className="text-xl font-semibold text-charcoal-700 mt-1">{property.title}</h1>
                <p className="flex items-center gap-1.5 text-charcoal-500 mt-1"><MapPin size={15} /> {property.address}, {property.city}, {property.province}</p>
              </div>
              <div className="flex flex-col gap-2 items-end">
                <Badge variant={property.status === 'active' ? 'success' : 'warning'} className="capitalize">{property.status}</Badge>
                <Badge variant="default" className="capitalize">{property.listingType}</Badge>
              </div>
            </div>

            {/* Stats */}
            <div className="flex flex-wrap gap-6 py-5 border-y border-charcoal-100 mb-6">
              {property.bedrooms != null && <span className="flex items-center gap-2 text-charcoal-700"><Bed size={18} /> <strong>{property.bedrooms}</strong> Bedrooms</span>}
              {property.bathrooms != null && <span className="flex items-center gap-2 text-charcoal-700"><Bath size={18} /> <strong>{property.bathrooms}</strong> Bathrooms</span>}
              {property.sqft != null && <span className="flex items-center gap-2 text-charcoal-700"><Square size={18} /> <strong>{property.sqft.toLocaleString()}</strong> sqft</span>}
              {property.parkingSpaces != null && <span className="flex items-center gap-2 text-charcoal-700"><Car size={18} /> <strong>{property.parkingSpaces}</strong> Parking</span>}
              {property.yearBuilt != null && <span className="flex items-center gap-2 text-charcoal-700"><Calendar size={18} /> Built <strong>{property.yearBuilt}</strong></span>}
            </div>

            {/* Description */}
            {property.description && (
              <div className="mb-8">
                <h2 className="font-serif text-2xl font-bold text-charcoal-900 mb-3">About This Property</h2>
                <p className="text-charcoal-600 leading-relaxed whitespace-pre-wrap">{property.description}</p>
              </div>
            )}

            {/* Features */}
            {features.length > 0 && (
              <div>
                <h2 className="font-serif text-2xl font-bold text-charcoal-900 mb-4">Features & Amenities</h2>
                <div className="grid grid-cols-2 gap-2">
                  {features.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-charcoal-600">
                      <span className="h-1.5 w-1.5 rounded-full bg-gold-500" />
                      {f}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar — inquiry form */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 rounded-2xl border border-charcoal-100 shadow-sm p-6">
              <h3 className="font-serif text-xl font-bold text-charcoal-900 mb-4">Request Information</h3>
              <PropertyInquiryForm propertyTitle={property.title} propertyId={property.id} />
            </div>
          </div>
        </div>
      </Container>
    </div>
  )
}
