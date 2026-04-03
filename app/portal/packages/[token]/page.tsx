import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { setPackageSessionCookie } from '@/lib/pkg-session'

interface Props { params: Promise<{ token: string }> }

function getFirstPhoto(media: string | null): string {
  try { return JSON.parse(media ?? '[]')[0]?.MediaURL ?? '' } catch { return '' }
}

function formatPrice(price: number | null): string {
  if (price == null) return 'Price on request'
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(price)
}

function formatAddress(p: { streetNumber: string | null; streetDirPrefix: string | null; streetName: string | null; streetSuffix: string | null; streetDirSuffix: string | null; unitNumber: string | null } | null): string {
  if (!p) return 'Address TBD'
  return [p.unitNumber, p.streetNumber, p.streetDirPrefix, p.streetName, p.streetSuffix, p.streetDirSuffix].filter(Boolean).join(' ') || 'Address TBD'
}

export default async function PackagePage({ params }: Props) {
  const { token } = await params
  const pkg = await prisma.listingPackage.findUnique({
    where:   { magicToken: token },
    include: {
      contact: { select: { id: true, firstName: true } },
      items:   { orderBy: { addedAt: 'asc' } },
    },
  })

  if (!pkg) notFound()

  await setPackageSessionCookie({ contactId: pkg.contactId, packageId: pkg.id })

  const listingKeys = pkg.items.map(i => i.listingKey)
  const properties  = await prisma.resoProperty.findMany({
    where:  { listingKey: { in: listingKeys } },
    select: {
      listingKey:            true,
      streetNumber:          true,
      streetDirPrefix:       true,
      streetName:            true,
      streetSuffix:          true,
      streetDirSuffix:       true,
      unitNumber:            true,
      city:                  true,
      listPrice:             true,
      bedroomsTotal:         true,
      bathroomsTotalInteger: true,
      livingArea:            true,
      media:                 true,
    },
  })
  const propMap = Object.fromEntries(properties.map(p => [p.listingKey, p]))

  const items = pkg.items.map(item => ({
    ...item,
    property: propMap[item.listingKey] ?? null,
  }))

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-charcoal-900 text-white py-6 px-4">
        <div className="max-w-3xl mx-auto">
          <p className="text-lg font-semibold">Michael Taylor Realty</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-charcoal-900 mb-2">{pkg.title}</h1>
        {pkg.message && <p className="text-charcoal-600 mb-6">{pkg.message}</p>}

        {/* View all CTA */}
        <div className="bg-white border border-charcoal-100 rounded-xl p-6 text-center mb-8 shadow-sm">
          <p className="text-charcoal-700 font-medium mb-3">{items.length} listing{items.length !== 1 ? 's' : ''} selected for you</p>
          <a href="#listings" className="inline-block px-6 py-3 bg-gold-600 text-white rounded-lg font-semibold hover:bg-gold-700">
            View All {items.length} Listings ↓
          </a>
        </div>

        {/* Listing cards */}
        <div id="listings" className="flex flex-col gap-4">
          {items.map(item => {
            const p     = item.property
            const photo = p ? getFirstPhoto(p.media) : ''
            const link  = `${baseUrl}/portal/properties/${item.listingKey}?packageItemId=${item.id}&token=${token}`
            return (
              <div key={item.id} className="bg-white rounded-xl border border-charcoal-100 overflow-hidden shadow-sm flex flex-col sm:flex-row">
                {photo
                  ? <img src={photo} alt="" className="w-full sm:w-48 h-40 object-cover flex-shrink-0" />
                  : <div className="w-full sm:w-48 h-40 bg-charcoal-100 flex-shrink-0 flex items-center justify-center text-charcoal-400 text-xs">No photo</div>
                }
                <div className="p-5 flex flex-col justify-between flex-1">
                  <div>
                    <p className="font-semibold text-charcoal-900">
                      {formatAddress(p)}{p?.city ? `, ${p.city}` : ''}
                    </p>
                    <p className="text-xl font-bold text-gold-600 mt-1">{formatPrice(p?.listPrice ?? null)}</p>
                    <p className="text-sm text-charcoal-500 mt-1">
                      {p?.bedroomsTotal ?? '—'} bed · {p?.bathroomsTotalInteger ?? '—'} bath
                      {p?.livingArea ? ` · ${p.livingArea.toLocaleString()} sqft` : ''}
                    </p>
                    {!p && <p className="text-sm text-charcoal-400 italic mt-1">Listing no longer available</p>}
                  </div>
                  {p && (
                    <a href={link} className="mt-4 inline-block px-4 py-2 bg-charcoal-900 text-white rounded-lg text-sm font-medium hover:bg-charcoal-700 self-start">
                      View Listing →
                    </a>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
