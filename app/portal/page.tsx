import { redirect } from 'next/navigation'
import { getContactSession } from '@/lib/auth'
import { PortalHeader } from '@/components/portal/PortalHeader'
import { PortalListings } from '@/components/portal/PortalListings'

export default async function PortalPage() {
  const contact = await getContactSession()
  if (!contact) redirect('/portal/login')

  return (
    <>
      <PortalHeader firstName={contact.firstName} />
      <PortalListings firstName={contact.firstName} />
    </>
  )
}
