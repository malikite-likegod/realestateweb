// lib/communications/verification-service.ts

/**
 * Handles email and phone verification flows.
 *
 * All tokens are stored as SHA-256 hashes — raw values are only held in memory
 * and sent to the contact. Consistent with the User.resetTokenHash pattern.
 */

import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { sendTransactionalEmail } from '@/lib/communications/email-service'
import { sendSms } from '@/lib/communications/sms-service'

// ─── Helpers ────────────────────────────────────────────────────────────────

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex')
}

function timingSafeEqual(a: string, b: string): boolean {
  // Pad to equal length before comparison to prevent length leaks
  const aHash = sha256(a)
  const bHash = sha256(b) // both are hex strings of equal length
  return crypto.timingSafeEqual(Buffer.from(aHash), Buffer.from(bHash))
}

// ─── Email verification ──────────────────────────────────────────────────────

/**
 * Send a one-click email verification link to the contact.
 * No-op if contact has no email or is already verified.
 */
export async function sendEmailVerification(contactId: string): Promise<void> {
  const contact = await prisma.contact.findUnique({
    where:  { id: contactId },
    select: { email: true, emailVerified: true },
  })

  if (!contact?.email) {
    console.warn(`[verification-service] Contact ${contactId} has no email — skipping verification`)
    return
  }

  if (contact.emailVerified) {
    // Already verified — do not reset or re-send
    return
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (!appUrl) {
    console.warn('[verification-service] NEXT_PUBLIC_APP_URL not set — verification link will be malformed')
  }

  const rawToken = crypto.randomBytes(32).toString('hex')
  const tokenHash = sha256(rawToken)

  await prisma.contact.update({
    where: { id: contactId },
    data: {
      emailVerificationTokenHash: tokenHash,
      emailVerificationSentAt:    new Date(),
    },
  })

  const verifyUrl = `${appUrl ?? ''}/api/verify/email/${rawToken}`

  const html = `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px">
      <h2 style="margin:0 0 12px;font-size:22px;color:#1a1a2e">Confirm your email address</h2>
      <p style="margin:0 0 24px;color:#555;line-height:1.6">
        Thanks for getting in touch! Please click the button below to confirm your email address.
      </p>
      <a href="${verifyUrl}"
         style="display:inline-block;background:#b8952a;color:#fff;font-weight:600;padding:14px 28px;border-radius:10px;text-decoration:none;font-size:16px">
        Confirm Email Address
      </a>
      <p style="margin:24px 0 0;font-size:13px;color:#999">
        This link expires once used. If you did not submit a form on our website, you can safely ignore this email.
      </p>
    </div>
  `

  try {
    await sendTransactionalEmail({
      to:      contact.email,
      subject: 'Please confirm your email address',
      html,
    })
  } catch (err) {
    // Log but do not throw — fire-and-forget from lead route
    console.error('[verification-service] Failed to send verification email:', err)
  }
}

// ─── Phone OTP ───────────────────────────────────────────────────────────────

/**
 * Generate and send a 6-digit SMS OTP to the contact's phone number.
 * Returns { sent: false } if the contact has no phone or Twilio is not configured.
 * Returns { sent: true, sessionToken } on success — sessionToken is stored as an
 * HttpOnly cookie by the email verify route and used to identify the contact for
 * OTP submission (avoids IDOR).
 */
export async function sendPhoneOtp(contactId: string): Promise<{ sent: boolean; sessionToken?: string }> {
  const twilioConfigured =
    !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER)

  if (!twilioConfigured) return { sent: false }

  // Load both the legacy scalar `phone` field and the `phones` relation.
  // The landing page lead route writes only to the legacy scalar field, so contacts
  // created via landing pages will have an empty `phones` relation. We must fall back
  // to `contact.phone` — the same pattern used on the contact detail page.
  const contact = await prisma.contact.findUnique({
    where:  { id: contactId },
    select: {
      phone:  true,                                                           // legacy scalar — always check this
      phones: { select: { number: true }, orderBy: { createdAt: 'asc' }, take: 1 }, // multi-value relation
    },
  })

  // Prefer the phones relation (primary/first entry), fall back to legacy scalar
  const phoneNumber = contact?.phones[0]?.number ?? contact?.phone ?? null
  if (!phoneNumber) return { sent: false }

  // Generate OTP and session token
  const rawOtp          = String(Math.floor(100000 + Math.random() * 900000))
  const rawSessionToken = crypto.randomBytes(32).toString('hex')

  await prisma.contact.update({
    where: { id: contactId },
    data: {
      phoneOtpCode:          sha256(rawOtp),
      phoneOtpExpiresAt:     new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      phoneOtpAttempts:      0,
      phoneSessionTokenHash: sha256(rawSessionToken),
    },
  })

  try {
    await sendSms({
      contactId,
      toNumber: phoneNumber,
      body:     `Your verification code is: ${rawOtp}. It expires in 1 hour.`,
    })
  } catch (err) {
    console.error('[verification-service] Failed to send OTP SMS:', err)
    return { sent: false }
  }

  return { sent: true, sessionToken: rawSessionToken }
}

// ─── Phone OTP verification ──────────────────────────────────────────────────

export type OtpVerifyResult = 'verified' | 'invalid' | 'expired' | 'locked' | 'not_found'

/**
 * Verify a phone OTP submitted via the success page.
 * The sessionToken identifies the contact without exposing their database ID.
 */
export async function verifyPhoneOtp(sessionToken: string, code: string): Promise<OtpVerifyResult> {
  const sessionHash = sha256(sessionToken)

  const contact = await prisma.contact.findFirst({
    where:  { phoneSessionTokenHash: sessionHash },
    select: {
      id:               true,
      phoneOtpCode:     true,
      phoneOtpExpiresAt:true,
      phoneOtpAttempts: true,
    },
  })

  if (!contact) return 'not_found'

  if (contact.phoneOtpAttempts >= 5) return 'locked'

  if (!contact.phoneOtpExpiresAt || contact.phoneOtpExpiresAt < new Date()) {
    // Clear stale OTP
    await prisma.contact.update({
      where: { id: contact.id },
      data: {
        phoneOtpCode:          null,
        phoneOtpExpiresAt:     null,
        phoneOtpAttempts:      0,
        phoneSessionTokenHash: null,
      },
    })
    return 'expired'
  }

  const codeHash = sha256(code)
  const storedHash = contact.phoneOtpCode ?? ''

  // Constant-time comparison (compare hashes of equal length)
  const match = timingSafeEqual(code, storedHash.length > 0 ? storedHash : '__invalid__')
  // Re-check: timingSafeEqual above hashes both inputs; compare to stored hash directly
  const actualMatch = codeHash === storedHash

  if (!actualMatch) {
    await prisma.contact.update({
      where: { id: contact.id },
      data:  { phoneOtpAttempts: { increment: 1 } },
    })
    return 'invalid'
  }

  await prisma.contact.update({
    where: { id: contact.id },
    data: {
      phoneVerified:         true,
      phoneVerifiedAt:       new Date(),
      phoneOtpCode:          null,
      phoneOtpExpiresAt:     null,
      phoneOtpAttempts:      0,
      phoneSessionTokenHash: null,
    },
  })

  return 'verified'
}
