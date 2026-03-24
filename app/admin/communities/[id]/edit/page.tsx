import { redirect, notFound } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { CommunityForm } from '@/components/admin/CommunityForm'

interface Props { params: Promise<{ id: string }> }

export default async function EditCommunityPage({ params }: Props) {
  const session = await getSession()
  if (!session) redirect('/admin/login')

  const { id } = await params
  const community = await prisma.community.findUnique({ where: { id } })
  if (!community) notFound()

  return <CommunityForm initial={community} />
}
