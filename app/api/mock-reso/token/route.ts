import { NextResponse } from 'next/server'
import { createMockResoToken } from '@/lib/mock-reso-auth'

export async function POST(request: Request) {
  const text = await request.text()
  const params = new URLSearchParams(text)

  const grantType    = params.get('grant_type')
  const clientId     = params.get('client_id')
  const clientSecret = params.get('client_secret')

  if (grantType !== 'client_credentials') {
    return NextResponse.json({ error: 'unsupported_grant_type' }, { status: 400 })
  }
  if (clientId !== process.env.RESO_CLIENT_ID || clientSecret !== process.env.RESO_CLIENT_SECRET) {
    return NextResponse.json({ error: 'invalid_client' }, { status: 401 })
  }

  const access_token = createMockResoToken()
  return NextResponse.json({ access_token, token_type: 'Bearer', expires_in: 3600 })
}
