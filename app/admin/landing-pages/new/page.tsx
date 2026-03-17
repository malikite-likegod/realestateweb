import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { LandingPageForm } from '../LandingPageForm'

export default async function NewLandingPagePage() {
  const session = await getSession()
  if (!session) redirect('/admin/login')
  return <LandingPageForm />
}
