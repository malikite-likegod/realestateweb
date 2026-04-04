import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const vars = [
    'TWILIO_ACCOUNT_SID',
    'TWILIO_AUTH_TOKEN',
    'TWILIO_API_KEY',
    'TWILIO_API_SECRET',
    'TWILIO_FROM_NUMBER',
    'SMTP_HOST',
    'SMTP_USER',
    'SMTP_PASS',
    'ZEROBOUNCE_API_KEY',
  ]

  const result: Record<string, boolean> = {}
  for (const v of vars) {
    result[v] = !!process.env[v]
  }

  return NextResponse.json(result)
}
