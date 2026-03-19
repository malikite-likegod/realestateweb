import { NextResponse } from 'next/server'
import { validateMockResoToken } from '@/lib/mock-reso-auth'
import { MOCK_RESO_LISTINGS } from '@/data/mock-reso-seed'

interface Props { params: Promise<{ ListingKey: string }> }

export async function GET(request: Request, { params }: Props) {
  if (!validateMockResoToken(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { ListingKey } = await params
  const listing = MOCK_RESO_LISTINGS.find(l => l.ListingKey === ListingKey)
  if (!listing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(listing)
}
