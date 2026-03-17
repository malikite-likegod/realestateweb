import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { LandingPageForm } from '../LandingPageForm'

interface Props { params: Promise<{ id: string }> }

export default async function EditLandingPagePage({ params }: Props) {
  const session = await getSession()
  if (!session) return null

  const { id } = await params
  const page = await prisma.landingPage.findUnique({ where: { id } })
  if (!page) notFound()

  return <LandingPageForm initial={page} />
}
