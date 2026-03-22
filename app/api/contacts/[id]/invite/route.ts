import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendTransactionalEmail } from '@/lib/communications/email-service'

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex')
}

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const contact = await prisma.contact.findUnique({
    where:  { id },
    select: { id: true, firstName: true, lastName: true, email: true, accountStatus: true },
  })

  if (!contact) return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
  if (!contact.email) return NextResponse.json({ error: 'Contact has no email address' }, { status: 400 })
  if (contact.accountStatus === 'active') {
    return NextResponse.json({ error: 'Contact already has an active account' }, { status: 400 })
  }

  // Generate single-use invitation token
  const rawToken = crypto.randomBytes(32).toString('hex')
  const tokenHash = sha256(rawToken)
  const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000) // 72 hours

  await prisma.contact.update({
    where: { id },
    data: {
      invitationTokenHash: tokenHash,
      invitationExpiresAt: expiresAt,
      accountStatus:       'invited',
    },
  })

  const appUrl   = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const inviteUrl = `${appUrl}/portal/invite/${rawToken}?contactId=${id}`
  const agentName = process.env.AGENT_NAME ?? 'Your Agent'

  const html = `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px">
      <h2 style="margin:0 0 12px;font-size:22px;color:#1a1a2e">You're invited to the Client Portal</h2>
      <p style="margin:0 0 8px;color:#555;line-height:1.6">Hi ${contact.firstName},</p>
      <p style="margin:0 0 24px;color:#555;line-height:1.6">
        ${agentName} has invited you to access the client portal, where you can browse all property listings — active and historical — and save your favourites.
      </p>
      <a href="${inviteUrl}"
         style="display:inline-block;background:#b8952a;color:#fff;font-weight:600;padding:14px 28px;border-radius:10px;text-decoration:none;font-size:16px">
        Set Up Your Account
      </a>
      <p style="margin:24px 0 0;font-size:13px;color:#999">
        This invitation expires in 72 hours. If you did not expect this invitation, you can safely ignore this email.
      </p>
    </div>
  `

  try {
    await sendTransactionalEmail({
      to:      contact.email,
      subject: `You're invited to the Client Portal`,
      html,
    })
  } catch (err) {
    console.error('[invite] Failed to send invitation email:', err)
    return NextResponse.json({ error: 'Failed to send invitation email' }, { status: 500 })
  }

  return NextResponse.json({ message: 'Invitation sent' })
}
