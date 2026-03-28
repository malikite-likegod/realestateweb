import { NextResponse } from 'next/server'
import { getContactSession } from '@/lib/auth'

export async function GET() {
  const contact = await getContactSession()
  if (!contact) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json({ firstName: contact.firstName, lastName: contact.lastName })
}
