import { NextResponse } from 'next/server'
import { getSession, verifySecret } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  purgeOldBehaviorEvents,
  purgeOldSearchLogs,
  purgeContactData,
  purgeMlsData,
} from '@/services/data-lifecycle'

function isCronRequest(request: Request): boolean {
  return verifySecret(request.headers.get('x-cron-secret'), process.env.RESO_SYNC_SECRET)
}

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type')

  // type=retention accepts admin session OR cron secret
  if (type === 'retention') {
    const isCron = isCronRequest(request)
    if (!isCron) {
      const session = await getSession()
      if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const [behaviorEvents, searchLogs] = await Promise.all([
      purgeOldBehaviorEvents(),
      purgeOldSearchLogs(),
    ])
    return NextResponse.json({ behaviorEvents: behaviorEvents.deleted, searchLogs: searchLogs.deleted })
  }

  // All other types require admin session
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (type === 'contact') {
    const contactId = searchParams.get('contactId')
    if (!contactId) return NextResponse.json({ error: 'contactId required' }, { status: 400 })
    const result = await purgeContactData(contactId)
    return NextResponse.json(result)
  }

  if (type === 'mls-termination') {
    const body = await request.json().catch(() => ({})) as Record<string, unknown>
    if (body.confirm !== 'TERMINATE_MLS_DATA') {
      return NextResponse.json({ error: 'Confirmation required: { "confirm": "TERMINATE_MLS_DATA" }' }, { status: 400 })
    }
    const result = await purgeMlsData()
    await prisma.activity.create({
      data: {
        type:    'note',
        subject: 'MLS Data Termination',
        body:    `Full MLS data purge executed. Deleted: ${JSON.stringify(result.deleted)}`,
      },
    })
    return NextResponse.json(result)
  }

  return NextResponse.json({ error: 'Invalid type. Use: retention | contact | mls-termination' }, { status: 400 })
}
