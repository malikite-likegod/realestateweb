import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { CommunityForm } from '@/components/admin/CommunityForm'

export default async function NewCommunityPage() {
  const session = await getSession()
  if (!session) redirect('/admin/login')

  return <CommunityForm />
}
