import { NextResponse } from 'next/server'
import { writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { getSession } from '@/lib/auth'
import { ampreGet } from '@/services/reso/client'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    // Fetch one record with no $select so the API returns all available fields
    const batch = await ampreGet<Record<string, unknown>>('idx', 'Property', {
      $top: 1,
    })

    const record = batch.value[0]
    if (!record) return NextResponse.json({ error: 'No records returned' }, { status: 500 })

    const fields = Object.keys(record).sort()
    const filePath = join(tmpdir(), 'proptz-fields.txt')
    writeFileSync(filePath, fields.join('\n'), 'utf8')

    return NextResponse.json({ count: fields.length, filePath, fields })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    )
  }
}
