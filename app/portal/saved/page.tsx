import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getContactSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PortalHeader } from '@/components/portal/PortalHeader'
import { ListingCard } from '@/components/portal/ListingCard'

export default async function SavedListingsPage() {
  const contact = await getContactSession()
  if (!contact) redirect('/portal/login')

  const saved = await prisma.contactSavedListing.findMany({
    where:   { contactId: contact.id },
    include: {
      listing: {
        include: {
          property: {
            select: {
              id: true, title: true, status: true, price: true,
              bedrooms: true, bathrooms: true, sqft: true,
              address: true, city: true, province: true, postalCode: true,
              images: true,
            },
          },
        },
      },
    },
    orderBy: { savedAt: 'desc' },
  })

  return (
    <>
      <PortalHeader firstName={contact.firstName} />
      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold text-gray-900">Saved Listings</h1>
          <Link href="/portal" className="text-sm text-gray-500 hover:text-gray-700">Browse all</Link>
        </div>

        {saved.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-400 mb-2">No saved listings yet.</p>
            <Link href="/portal" className="text-sm text-amber-600 hover:text-amber-700">Browse listings</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {saved.map(s => (
              <ListingCard key={s.id} listing={s.listing} isSaved={true} />
            ))}
          </div>
        )}
      </main>
    </>
  )
}
