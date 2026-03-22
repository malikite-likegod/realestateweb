import { redirect } from 'next/navigation'
import { getContactSession } from '@/lib/auth'
import { PortalHeader } from '@/components/portal/PortalHeader'
import { ListingCard } from '@/components/portal/ListingCard'
import { prisma } from '@/lib/prisma'

export default async function PortalPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; minPrice?: string; maxPrice?: string; minBeds?: string }>
}) {
  const contact = await getContactSession()
  if (!contact) redirect('/portal/login')

  const sp = await searchParams
  const statusFilter = sp.status && ['active','sold','expired'].includes(sp.status) ? sp.status : undefined

  const propertyWhere: Record<string, unknown> = {}
  if (statusFilter) propertyWhere.status = statusFilter
  if (sp.minPrice && !isNaN(Number(sp.minPrice))) propertyWhere.price = { ...(propertyWhere.price as object ?? {}), gte: Number(sp.minPrice) }
  if (sp.maxPrice && !isNaN(Number(sp.maxPrice))) propertyWhere.price = { ...(propertyWhere.price as object ?? {}), lte: Number(sp.maxPrice) }
  if (sp.minBeds  && !isNaN(Number(sp.minBeds)))  propertyWhere.bedrooms = { gte: Number(sp.minBeds) }

  const listings = await prisma.listing.findMany({
    where:   { property: propertyWhere },
    include: {
      property:        { select: { id: true, title: true, status: true, price: true, bedrooms: true, bathrooms: true, sqft: true, address: true, city: true, province: true, postalCode: true, images: true, listedAt: true } },
      savedByContacts: { where: { contactId: contact.id }, select: { id: true } },
    },
    orderBy: [{ property: { status: 'asc' } }, { property: { listedAt: 'desc' } }],
  })

  return (
    <>
      <PortalHeader firstName={contact.firstName} />
      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold text-gray-900">Properties</h1>
          <p className="text-sm text-gray-500">{listings.length} listing{listings.length !== 1 ? 's' : ''}</p>
        </div>

        {/* Filters */}
        <form className="flex flex-wrap gap-3 mb-6">
          <select name="status" defaultValue={sp.status ?? ''} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="sold">Sold</option>
            <option value="expired">Expired</option>
          </select>
          <input name="minBeds" type="number" min="0" placeholder="Min beds" defaultValue={sp.minBeds ?? ''} className="w-28 rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          <input name="minPrice" type="number" placeholder="Min price" defaultValue={sp.minPrice ?? ''} className="w-32 rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          <input name="maxPrice" type="number" placeholder="Max price" defaultValue={sp.maxPrice ?? ''} className="w-32 rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          <button type="submit" className="bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-700">Filter</button>
          <a href="/portal" className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">Clear</a>
        </form>

        {listings.length === 0 ? (
          <p className="text-center text-gray-400 py-16">No listings found.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {listings.map(l => (
              <ListingCard key={l.id} listing={l} isSaved={l.savedByContacts.length > 0} />
            ))}
          </div>
        )}
      </main>
    </>
  )
}
