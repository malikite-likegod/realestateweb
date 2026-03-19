import { NextResponse } from 'next/server'
import { validateMockResoToken } from '@/lib/mock-reso-auth'
import { MOCK_RESO_MEMBERS } from '@/data/mock-reso-seed'

export async function GET(request: Request) {
  if (!validateMockResoToken(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return NextResponse.json({
    '@odata.context': `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/api/mock-reso/$metadata#Member`,
    '@odata.count':   MOCK_RESO_MEMBERS.length,
    value: MOCK_RESO_MEMBERS,
  })
}
