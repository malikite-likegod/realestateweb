/**
 * POST /api/emails/sync
 *
 * Polls the IMAP inbox and imports new inbound messages into the database.
 * Matches each email to a Contact by sender address when possible.
 *
 * Auth: same as /api/automation/process —
 *   x-cron-secret header, Authorization: Bearer <secret>, or admin session.
 *
 * Safe to call repeatedly — already-imported messages are skipped via
 * the imapMessageId deduplication field.
 */

import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { verifySecret } from '@/lib/cron-auth'
import { syncInbox }    from '@/lib/communications/imap-service'

export async function POST(request: Request) {
  const xCronSecret  = request.headers.get('x-cron-secret')
  const authHeader   = request.headers.get('authorization') ?? ''
  const bearerSecret = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null

  const hasValidSecret = verifySecret(xCronSecret, process.env.AUTOMATION_PROCESS_SECRET) ||
                         verifySecret(bearerSecret, process.env.AUTOMATION_PROCESS_SECRET)

  if (!hasValidSecret) {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await syncInbox()
    return NextResponse.json({ data: result })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[POST /api/emails/sync]', error)

    // Surface IMAP config errors clearly
    if (message.includes('IMAP not configured')) {
      return NextResponse.json({ error: message }, { status: 503 })
    }

    // Return the actual error message to help diagnose connection issues
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
