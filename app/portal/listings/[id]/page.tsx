import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { getContactSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PortalHeader } from '@/components/portal/PortalHeader'
import { SaveButton } from '@/components/portal/SaveButton'
import { MlsDisclaimer } from '@/components/mls/MlsDisclaimer'
import { BrokerageAttribution } from '@/components/mls/BrokerageAttribution'

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
          bedrooms: true, bathrooms: true, sqft: true,
          address: true, city: true, province: true, postalCode: true,
          images: true, listedAt: true, soldAt: true,
        },
      },
      savedByContacts: { where: { contactId: contact.id }, select: { id: true } },
    },
  })

  if (!listing) notFound()
  if (listing.property.status === 'draft') notFound()

  const p = listing.property
  const images = Array.isArray(p.images) ? p.images as string[] : []
  const isSaved = listing.savedByContacts.length > 0

  return (
    <>
      <PortalHeader firstName={contact.firstName} />
      <main className="max-w-4xl mx-auto px-4 py-8">
        <Link href="/portal" className="text-sm text-gray-500 hover:text-gray-700 mb-6 inline-block">← Back to listings</Link>

        {/* Photo gallery */}
        {images.length > 0 && (
          <div className="grid grid-cols-2 gap-2 mb-6">
            {images.slice(0, 4).map((src, i) => (
              <img key={i} src={src} alt={`Photo ${i + 1}`} className="w-full h-48 object-cover rounded-lg" />
            ))}
          </div>
        )}

        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">{p.title || p.address}</h1>
            <p className="text-sm text-gray-500">{[p.address, p.city, p.province, p.postalCode].filter(Boolean).join(', ')}</p>
            <BrokerageAttribution />
          </div>
          <SaveButton listingId={listing.id} initialSaved={isSaved} />
        </div>

        <div className="flex items-center gap-4 mb-6">
          <p className="text-2xl font-bold text-gray-900">{p.price ? `$${p.price.toLocaleString()}` : 'Price N/A'}</p>
          <span className="text-xs font-medium px-2 py-1 rounded-full bg-gray-100 text-gray-600 capitalize">{p.status}</span>
        </div>

        {(p.bedrooms || p.bathrooms || p.sqft) && (
          <div className="flex gap-6 text-sm text-gray-600 mb-6">
            {p.bedrooms  && <span>{p.bedrooms} bedrooms</span>}
            {p.bathrooms && <span>{p.bathrooms} bathrooms</span>}
            {p.sqft      && <span>{p.sqft.toLocaleString()} sqft</span>}
          </div>
        )}

        <MlsDisclaimer variant="vow" />
      </main>
    </>
  )
}
