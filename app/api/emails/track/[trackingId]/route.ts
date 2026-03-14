/**
 * GET /api/emails/track/[trackingId]
 *
 * Email open-tracking pixel endpoint. When the contact's email client loads
 * the 1×1 transparent GIF, this handler records the open event and increments
 * the open count on the EmailMessage record. Returns a minimal GIF so no
 * error is shown in the email client.
 */

import { NextResponse } from 'next/server'
import { recordEmailOpen } from '@/lib/communications/email-service'

// 1×1 transparent GIF (43 bytes)
const TRANSPARENT_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64',
)

interface Props { params: Promise<{ trackingId: string }> }

export async function GET(_req: Request, { params }: Props) {
  const { trackingId } = await params

  // Fire-and-forget — don't block the pixel response on the DB write
  recordEmailOpen(trackingId).catch(err =>
    console.error('[email-track]', err),
  )

  return new NextResponse(TRANSPARENT_GIF, {
    status:  200,
    headers: {
      'Content-Type':  'image/gif',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  })
}
