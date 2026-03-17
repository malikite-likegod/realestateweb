import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { MarketReportEditForm } from './MarketReportEditForm'

interface Props { params: Promise<{ id: string }> }

export default async function EditMarketReportPage({ params }: Props) {
  const session = await getSession()
  if (!session) return null

  const { id } = await params
  const report = await prisma.marketReport.findUnique({ where: { id } })
  if (!report) notFound()

  return <MarketReportEditForm report={report} />
}
