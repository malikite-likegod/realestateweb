import { NextResponse } from 'next/server'
import { validateMockResoToken } from '@/lib/mock-reso-auth'
import { MOCK_RESO_OFFICES } from '@/data/mock-reso-seed'

export async function GET(request: Request) {
  if (!validateMockResoToken(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return NextResponse.json({
    '@odata.context': `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/api/mock-reso/$metadata#Office`,
    '@odata.count':   MOCK_RESO_OFFICES.length,
    value: MOCK_RESO_OFFICES,
  })
}
