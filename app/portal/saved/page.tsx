import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getContactSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PortalHeader } from '@/components/portal/PortalHeader'
import { ResoListingCard } from '@/components/portal/ResoListingCard'
import { MlsDisclaimer } from '@/components/mls/MlsDisclaimer'

export default async function SavedListingsPage() {
  const contact = await getContactSession()
  if (!contact) redirect('/portal/login?redirect=/portal')

  const saved = await prisma.contactPropertyInterest.findMany({
    where:   { contactId: contact.id, source: 'portal_saved' },
    include: { resoProperty: { select: {
      id: true, listingKey: true, standardStatus: true,
      propertyType: true, propertySubType: true, transactionType: true,
      listPrice: true, bedroomsTotal: true, bathroomsTotalInteger: true,
      garageSpaces: true, livingArea: true,
      streetNumber: true, streetName: true, streetSuffix: true, unitNumber: true,
      city: true, stateOrProvince: true, postalCode: true,
      media: true, listAgentFullName: true, listOfficeName: true,
    } } },
    orderBy: { createdAt: 'desc' },
  })

  const properties = saved.map(s => ({ ...s.resoProperty, isSaved: true }))

  return (
    <>
      <PortalHeader firstName={contact.firstName} />
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold text-gray-900">Saved Listings</h1>
          <Link href="/portal" className="text-sm text-gray-500 hover:text-gray-700">Browse all</Link>
        </div>

        {properties.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-400 mb-2">No saved listings yet.</p>
            <Link href="/portal" className="text-sm text-amber-600 hover:text-amber-700">Browse listings →</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {properties.map(p => <ResoListingCard key={p.id} property={p} />)}
          </div>
        )}
        <div className="mt-8"><MlsDisclaimer variant="vow" /></div>
      </main>
    </>
  )
}
