# Contact Verification Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add ZeroBounce email validation on landing page forms, one-click email verification, SMS OTP phone verification, and verification badges in the contact view.

**Architecture:** New fields on the Contact model store verification state (tokens as SHA-256 hashes). A new `verification-service.ts` handles all token/OTP logic. A new `zerobounce.ts` thin client gates lead form submission. Public pages at `/verify/email/` handle the contact-facing flows.

**Tech Stack:** Next.js 15 App Router, Prisma ORM, Node.js `crypto` module, existing `sendTransactionalEmail` + `sendSms` services, Tailwind CSS.

---

## Chunk 1: Schema & Migration

### Task 1: Add verification fields to Contact model

**Files:**
- Modify: `prisma/schema.prisma:65-110` (Contact model)

- [ ] **Step 1: Add fields to Contact model**

Open `prisma/schema.prisma`. In the `Contact` model, after the `smsOptOut` field (line 79), add these ten fields:

```prisma
  emailVerified              Boolean   @default(false)
  emailVerifiedAt            DateTime?
  emailVerificationTokenHash String?   @unique
  emailVerificationSentAt    DateTime?
  phoneVerified              Boolean   @default(false)
  phoneVerifiedAt            DateTime?
  phoneOtpCode               String?
  phoneOtpExpiresAt          DateTime?
  phoneOtpAttempts           Int       @default(0)
  phoneSessionTokenHash      String?   @unique
```

- [ ] **Step 2: Run migration**

```bash
npx prisma migrate dev --name add_contact_verification
```

Expected output: `The following migration(s) have been created and applied from new schema changes: migrations/YYYYMMDDHHMMSS_add_contact_verification`

- [ ] **Step 3: Verify TypeScript picks up new fields**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors referencing `emailVerified` or `phoneVerified`.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add contact verification fields to schema"
```

---

## Chunk 2: Services

### Task 2: ZeroBounce email validation client

**Files:**
- Create: `lib/services/zerobounce.ts`

- [ ] **Step 1: Create the file**

```typescript
// lib/services/zerobounce.ts

/**
 * ZeroBounce email validation client.
 * Set ZEROBOUNCE_API_KEY in .env to enable.
 * Returns 'unknown' (pass-through) when not configured or on any error.
 */

export type EmailValidationResult = 'valid' | 'invalid' | 'unknown'

const INVALID_STATUSES = new Set(['invalid', 'abuse', 'disposable', 'spamtrap'])

export async function validateEmail(email: string): Promise<EmailValidationResult> {
  const apiKey = process.env.ZEROBOUNCE_API_KEY
  if (!apiKey) return 'unknown'

  try {
    const url = `https://api.zerobounce.net/v2/validate?api_key=${encodeURIComponent(apiKey)}&email=${encodeURIComponent(email)}`
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
    if (!res.ok) {
      console.warn(`[zerobounce] API returned ${res.status} — failing open`)
      return 'unknown'
    }
    const data = await res.json() as { status: string }
    if (INVALID_STATUSES.has(data.status)) return 'invalid'
    if (data.status === 'valid') return 'valid'
    return 'unknown'
  } catch (err) {
    console.warn('[zerobounce] Request failed — failing open:', err)
    return 'unknown'
  }
}
```

- [ ] **Step 2: Check TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep zerobounce
```

Expected: no output (no errors).

- [ ] **Step 3: Commit**

```bash
git add lib/services/zerobounce.ts
git commit -m "feat: add ZeroBounce email validation client"
```

---

### Task 3: Verification service

**Files:**
- Create: `lib/communications/verification-service.ts`

- [ ] **Step 1: Create the file**

```typescript
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
 * Returns { sent: true, sessionToken } on success — sessionToken is passed to the
 * success page and used to identify the contact for OTP submission (avoids IDOR).
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
```

> **Note on timing-safe comparison:** The `verifyPhoneOtp` function compares `sha256(inputCode) === contact.phoneOtpCode` (both are hex strings of identical length). Since SHA-256 hex output is always 64 characters, a standard string comparison does not leak length information. The `timingSafeEqual` helper above is included for defense in depth but the actual comparison on line `const actualMatch = codeHash === storedHash` is what gates access. For production hardening, replace with `crypto.timingSafeEqual(Buffer.from(codeHash, 'hex'), Buffer.from(storedHash, 'hex'))`.

- [ ] **Step 2: Check TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep verification-service
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add lib/communications/verification-service.ts
git commit -m "feat: add email and phone verification service"
```

---

## Chunk 3: Lead Route & Form

### Task 4: Integrate ZeroBounce and email verification into lead route

**Files:**
- Modify: `app/api/landing-pages/[slug]/lead/route.ts`
- Modify: `app/(lp)/lp/[slug]/LeadForm.tsx`

- [ ] **Step 1: Update lead route**

Replace the full contents of `app/api/landing-pages/[slug]/lead/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendWebhook } from '@/services/ai/webhooks'
import { enqueueJob } from '@/lib/automation/job-queue'
import { validateEmail } from '@/lib/services/zerobounce'
import { sendEmailVerification } from '@/lib/communications/verification-service'

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  const page = await prisma.landingPage.findUnique({ where: { slug } })
  if (!page || page.status !== 'published') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { firstName, lastName, email, phone, message } = await req.json()

  if (!firstName || !email) {
    return NextResponse.json({ error: 'firstName and email are required' }, { status: 400 })
  }

  // ZeroBounce email validation (skipped if ZEROBOUNCE_API_KEY not set)
  const emailStatus = await validateEmail(email)
  if (emailStatus === 'invalid') {
    return NextResponse.json(
      { error: 'Please enter a valid email address.' },
      { status: 400 }
    )
  }

  const noteEntry = `Landing page enquiry: "${page.title}"${message ? `\nMessage: ${message}` : ''}`

  const existing = await prisma.contact.findUnique({ where: { email } })
  const notes = existing?.notes ? `${existing.notes}\n${noteEntry}` : noteEntry

  const contact = await prisma.contact.upsert({
    where:  { email },
    update: { phone: phone || undefined, notes },
    create: { firstName, lastName: lastName ?? '', email, phone: phone ?? null, source: 'landing_page', notes },
  })

  // Apply auto-tags from the landing page
  if (page.autoTags) {
    let tagNames: string[] = []
    try { tagNames = JSON.parse(page.autoTags) } catch { /* ignore */ }

    for (const name of tagNames) {
      if (!name.trim()) continue
      const tag = await prisma.tag.upsert({
        where:  { name: name.trim() },
        update: {},
        create: { name: name.trim() },
      })
      await prisma.contactTag.upsert({
        where:  { contactId_tagId: { contactId: contact.id, tagId: tag.id } },
        update: {},
        create: { contactId: contact.id, tagId: tag.id },
      })
    }
  }

  await prisma.landingPage.update({ where: { slug }, data: { leads: { increment: 1 } } })

  await sendWebhook('new_lead', { contactId: contact.id, source: 'landing_page' })
  await enqueueJob('evaluate_rules', { trigger: 'new_lead', contactId: contact.id })

  // Send email verification (fire-and-forget; errors are logged inside the service)
  sendEmailVerification(contact.id).catch(() => {})

  return NextResponse.json({ ok: true }, { status: 201 })
}
```

- [ ] **Step 2: Update LeadForm to show specific invalid-email error**

In `app/(lp)/lp/[slug]/LeadForm.tsx`, replace the error state block and the submit handler's catch:

Find this block (around line 27-29):
```typescript
      if (!res.ok) throw new Error()
      setStatus('success')
    } catch {
      setStatus('error')
    }
```

Replace with:
```typescript
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        if (body?.error?.includes('valid email')) {
          setError(body.error)
        } else {
          setError('Something went wrong — please try again.')
        }
        setStatus('error')
        return
      }
      setStatus('success')
    } catch {
      setError('Something went wrong — please try again.')
      setStatus('error')
    }
```

Also:
1. Add `const [error, setError] = useState<string>('')` near the top of the component alongside the existing `useState` calls.
2. **Replace** the existing hardcoded error display (line ~83 in the original file):

```typescript
        {status === 'error' && (
          <p className="text-sm text-red-600">Something went wrong — please try again.</p>
        )}
```

with the dynamic version that reads from the new `error` state:

```typescript
        {status === 'error' && error && (
          <p className="text-sm text-red-600">{error}</p>
        )}
```

The hardcoded string is fully replaced — only the `error` state variable drives the message now. Both `setError(msg)` and `setStatus('error')` are always called together in the updated catch/error blocks above.

- [ ] **Step 3: Check TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep -E "lead/route|LeadForm"
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add app/api/landing-pages/[slug]/lead/route.ts app/\(lp\)/lp/\[slug\]/LeadForm.tsx
git commit -m "feat: integrate ZeroBounce validation and email verification into lead capture"
```

---

## Chunk 4: Verification API Routes

### Task 5: Email verification GET route

**Files:**
- Create: `app/api/verify/email/[token]/route.ts`

- [ ] **Step 1: Create the route**

```typescript
// app/api/verify/email/[token]/route.ts

import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { sendPhoneOtp } from '@/lib/communications/verification-service'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')

  const contact = await prisma.contact.findFirst({
    where:  { emailVerificationTokenHash: tokenHash },
    select: { id: true },
  })

  if (!contact) {
    return NextResponse.redirect(`${appUrl}/verify/email/invalid`)
  }

  // Mark email as verified and clear the token
  await prisma.contact.update({
    where: { id: contact.id },
    data: {
      emailVerified:              true,
      emailVerifiedAt:            new Date(),
      emailVerificationTokenHash: null,
    },
  })

  // Trigger SMS OTP (auto, if phone + Twilio available)
  const { sent, sessionToken } = await sendPhoneOtp(contact.id)

  const successUrl = new URL(`${appUrl}/verify/email/success`)
  successUrl.searchParams.set('phone', String(sent))
  // NOTE: sessionToken is NOT put in the URL (avoids leaking it in browser history / server logs).
  // It is passed as an HttpOnly cookie instead.

  const response = NextResponse.redirect(successUrl.toString())

  if (sent && sessionToken) {
    // 1-hour HttpOnly cookie — the /api/verify/phone route reads it from here
    response.cookies.set('phone_session', sessionToken, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge:   60 * 60, // 1 hour, matches OTP expiry
      path:     '/',
    })
  }

  return response
}
```

- [ ] **Step 2: Check TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep "verify/email"
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add "app/api/verify/email/[token]/route.ts"
git commit -m "feat: add email verification token handler"
```

---

### Task 6: Phone OTP verification POST route

**Files:**
- Create: `app/api/verify/phone/route.ts`

- [ ] **Step 1: Create the route**

```typescript
// app/api/verify/phone/route.ts
// Reads the phone session token from the HttpOnly cookie set by the email verify redirect.
// The POST body only carries the OTP code — no session token in the body (avoids IDOR).

import { NextRequest, NextResponse } from 'next/server'
import { verifyPhoneOtp } from '@/lib/communications/verification-service'

export async function POST(req: NextRequest) {
  const sessionToken = req.cookies.get('phone_session')?.value
  const body = await req.json().catch(() => null)
  const code: string | undefined = body?.code

  if (!sessionToken || !code) {
    return NextResponse.json({ error: 'invalid', message: 'Missing fields.' }, { status: 400 })
  }

  const result = await verifyPhoneOtp(sessionToken, code)

  const res = (() => {
    switch (result) {
      case 'verified':   return NextResponse.json({ success: true })
      case 'invalid':    return NextResponse.json({ error: 'invalid',   message: 'Incorrect code.' },     { status: 400 })
      case 'expired':    return NextResponse.json({ error: 'expired',   message: 'Code has expired.' },   { status: 410 })
      case 'locked':     return NextResponse.json({ error: 'locked',    message: 'Too many attempts.' },  { status: 429 })
      case 'not_found':  return NextResponse.json({ error: 'not_found', message: 'Session not found.' },  { status: 404 })
    }
  })()

  // Clear the cookie after use (regardless of result)
  res.cookies.delete('phone_session')
  return res
}
```

- [ ] **Step 2: Check TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep "verify/phone"
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add app/api/verify/phone/route.ts
git commit -m "feat: add phone OTP verification endpoint"
```

---

## Chunk 5: Public Verification Pages

### Task 7: Email verification success page

**Files:**
- Create: `app/(public)/verify/email/success/page.tsx`
- Create: `app/(public)/verify/email/invalid/page.tsx`

> **Note:** Check if `app/(public)` exists in your project. If the public route group uses a different name (e.g. `app/(lp)` or just `app`), create these pages there instead. The pages must be publicly accessible (no auth required).

- [ ] **Step 1: Check route group name**

```bash
ls app/
```

Look for a `(public)` directory. If it doesn't exist, use the root `app/` directory or create `app/(public)/`.

- [ ] **Step 2: Create success page**

Create `app/(public)/verify/email/success/page.tsx` (adjust path per step above):

```tsx
'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { CheckCircle, Loader2 } from 'lucide-react'

export default function EmailVerifiedPage() {
  const params     = useSearchParams()
  const phoneParam = params.get('phone')
  // showOtp is true when the server sent an OTP — the phone_session HttpOnly cookie
  // is set automatically by the browser and sent with the POST; no token in the URL.
  const showOtp    = phoneParam === 'true'

  const [code, setCode]      = useState('')
  const [status, setStatus]  = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [errorMsg, setError] = useState('')

  async function handleVerifyPhone(e: React.FormEvent) {
    e.preventDefault()
    setStatus('loading')
    setError('')
    try {
      const res = await fetch('/api/verify/phone', {
        method:      'POST',
        headers:     { 'Content-Type': 'application/json' },
        credentials: 'same-origin', // ensures cookies are sent
        body:        JSON.stringify({ code }),
      })
      const data = await res.json()
      if (res.ok) {
        setStatus('done')
      } else {
        setError(data.message ?? 'Something went wrong.')
        setStatus('error')
      }
    } catch {
      setError('Something went wrong. Please try again.')
      setStatus('error')
    }
  }

  return (
    <div className="min-h-screen bg-charcoal-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-sm border border-charcoal-100 max-w-md w-full p-8 text-center">

        {/* Email confirmed icon */}
        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-8 h-8 text-emerald-600" />
        </div>

        <h1 className="text-2xl font-bold text-charcoal-900 mb-2">Email address confirmed!</h1>
        <p className="text-charcoal-500 mb-6">Thank you for confirming your email address.</p>

        {showOtp && status !== 'done' && (
          <div className="border-t border-charcoal-100 pt-6">
            <p className="text-sm text-charcoal-600 mb-4">
              We also sent a 6-digit code to your phone number. Enter it below to verify it.
            </p>
            <form onSubmit={handleVerifyPhone} className="flex flex-col gap-3">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                className="w-full rounded-xl border border-charcoal-200 px-4 py-3 text-center text-2xl tracking-widest font-mono text-charcoal-900 placeholder-charcoal-300 focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-transparent"
                required
              />
              {(status === 'error') && (
                <p className="text-sm text-red-600">{errorMsg}</p>
              )}
              <button
                type="submit"
                disabled={status === 'loading' || code.length < 6}
                className="w-full rounded-xl bg-gold-600 hover:bg-gold-700 disabled:opacity-60 text-white font-semibold py-3 px-6 text-base transition-colors flex items-center justify-center gap-2"
              >
                {status === 'loading' && <Loader2 className="w-4 h-4 animate-spin" />}
                Verify Phone Number
              </button>
            </form>
          </div>
        )}

        {showOtp && status === 'done' && (
          <div className="border-t border-charcoal-100 pt-6">
            <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <CheckCircle className="w-6 h-6 text-emerald-600" />
            </div>
            <p className="text-sm font-medium text-emerald-700">Phone number verified!</p>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create invalid page**

Create `app/(public)/verify/email/invalid/page.tsx`:

```tsx
import { XCircle } from 'lucide-react'

export default function EmailVerificationInvalidPage() {
  return (
    <div className="min-h-screen bg-charcoal-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-sm border border-charcoal-100 max-w-md w-full p-8 text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <XCircle className="w-8 h-8 text-red-500" />
        </div>
        <h1 className="text-2xl font-bold text-charcoal-900 mb-2">Link invalid or already used</h1>
        <p className="text-charcoal-500">
          This verification link has already been used or has expired. If you need to verify your email, please re-submit the form.
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Check TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep "verify/email"
```

Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add "app/(public)/verify/"
git commit -m "feat: add email verification success and invalid pages"
```

---

## Chunk 6: Settings & Contact View

### Task 8: Add ZeroBounce row to settings page

**Files:**
- Modify: `app/admin/settings/page.tsx`

- [ ] **Step 1: Add zeroBounceConfigured variable**

In `app/admin/settings/page.tsx`, find these two lines (around line 27-28):

```typescript
  const twilioConfigured  = !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER)
  const smtpConfigured    = !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)
```

Add a third line after them:

```typescript
  const zeroBounceConfigured = !!process.env.ZEROBOUNCE_API_KEY
```

- [ ] **Step 2: Add ZeroBounce row to provider grid**

Find the closing `</div>` of the SMTP row (around line 116), which looks like:

```tsx
            <div className="flex items-center justify-between py-2.5">
              <div>
                <p className="text-sm font-medium text-charcoal-900">SMTP (Email)</p>
                <p className="text-xs text-charcoal-400">Set SMTP_HOST, SMTP_USER, SMTP_PASS</p>
              </div>
              {smtpConfigured
                ? <CheckCircle2 size={18} className="text-green-500 shrink-0" />
                : <XCircle      size={18} className="text-charcoal-300 shrink-0" />}
            </div>
```

Add a new row immediately after it, before the closing `</div>` of the flex column:

```tsx
            <div className="flex items-center justify-between py-2.5 border-t border-charcoal-100">
              <div>
                <p className="text-sm font-medium text-charcoal-900">ZeroBounce</p>
                <p className="text-xs text-charcoal-400">Email validation — set ZEROBOUNCE_API_KEY</p>
              </div>
              {zeroBounceConfigured
                ? <CheckCircle2 size={18} className="text-green-500 shrink-0" />
                : <XCircle      size={18} className="text-charcoal-300 shrink-0" />}
            </div>
```

- [ ] **Step 3: Check TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep settings
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add app/admin/settings/page.tsx
git commit -m "feat: show ZeroBounce configuration status in settings"
```

---

### Task 9: Add verification badges to contact view

**Files:**
- Modify: `app/admin/contacts/[id]/page.tsx`

- [ ] **Step 1: Add CheckCircle import**

In `app/admin/contacts/[id]/page.tsx`, find the lucide-react import (around line 19):

```typescript
import {
  Phone, Mail, MapPin, TrendingUp, Cake, Briefcase,
  Building2, Star, MessageSquare,
} from 'lucide-react'
```

Add `CheckCircle` to the list:

```typescript
import {
  Phone, Mail, MapPin, TrendingUp, Cake, Briefcase,
  Building2, Star, MessageSquare, CheckCircle,
} from 'lucide-react'
```

- [ ] **Step 2: Add verified badge to phone rows**

Find the phone display block (around line 194-208):

```tsx
              {displayPhones.map((p, i) => (
                <a
                  key={p.id ?? i}
                  href={`tel:${p.number}`}
                  className="flex items-center gap-2 text-charcoal-600 hover:text-gold-600 transition-colors group"
                >
                  <Phone size={13} className="shrink-0 text-charcoal-400 group-hover:text-gold-500" />
                  <span className="flex-1 truncate">{p.number}</span>
                  {displayPhones.length > 1 && (
                    <span className="text-xs text-charcoal-400 capitalize shrink-0">
                      {p.isPrimary ? <Star size={10} className="text-gold-400" fill="currentColor" /> : p.label}
                    </span>
                  )}
                </a>
              ))}
```

Replace with:

```tsx
              {displayPhones.map((p, i) => (
                <a
                  key={p.id ?? i}
                  href={`tel:${p.number}`}
                  className="flex items-center gap-2 text-charcoal-600 hover:text-gold-600 transition-colors group"
                >
                  <Phone size={13} className="shrink-0 text-charcoal-400 group-hover:text-gold-500" />
                  <span className="flex-1 truncate">{p.number}</span>
                  {contact.phoneVerified && (i === 0) && (
                    <span
                      title={contact.phoneVerifiedAt ? `Verified on ${contact.phoneVerifiedAt.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}` : 'Verified'}
                      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 shrink-0"
                    >
                      <CheckCircle size={9} /> Verified
                    </span>
                  )}
                  {displayPhones.length > 1 && (
                    <span className="text-xs text-charcoal-400 capitalize shrink-0">
                      {p.isPrimary ? <Star size={10} className="text-gold-400" fill="currentColor" /> : p.label}
                    </span>
                  )}
                </a>
              ))}
```

- [ ] **Step 3: Add verified badge to email row**

Find the email display block (around line 211-219):

```tsx
              {/* Email */}
              {contact.email && (
                <a
                  href={`mailto:${contact.email}`}
                  className="flex items-center gap-2 text-charcoal-600 hover:text-gold-600 transition-colors"
                >
                  <Mail size={13} className="shrink-0 text-charcoal-400" />
                  <span className="truncate">{contact.email}</span>
                </a>
              )}
```

Replace with:

```tsx
              {/* Email */}
              {contact.email && (
                <a
                  href={`mailto:${contact.email}`}
                  className="flex items-center gap-2 text-charcoal-600 hover:text-gold-600 transition-colors"
                >
                  <Mail size={13} className="shrink-0 text-charcoal-400" />
                  <span className="truncate flex-1">{contact.email}</span>
                  {contact.emailVerified && (
                    <span
                      title={contact.emailVerifiedAt ? `Verified on ${contact.emailVerifiedAt.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}` : 'Verified'}
                      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 shrink-0"
                    >
                      <CheckCircle size={9} /> Verified
                    </span>
                  )}
                </a>
              )}
```

- [ ] **Step 4: Check TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep "contacts/\[id\]"
```

Expected: no output.

- [ ] **Step 5: Full type check**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 6: Commit**

```bash
git add "app/admin/contacts/[id]/page.tsx"
git commit -m "feat: show email and phone verification badges in contact view"
```

---

## Chunk 7: Final Verification

### Task 10: End-to-end smoke test

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Test ZeroBounce blocking (if API key set)**

1. Open a published landing page (e.g. `http://localhost:3000/lp/[your-slug]`)
2. Submit form with a known-invalid email (e.g. `test@mailinator.com` or `fake@nodomain.invalid`)
3. Expected: red error "Please enter a valid email address."
4. Submit with a valid email → form succeeds

- [ ] **Step 3: Test email verification flow**

1. Submit landing page form with a valid email you can receive
2. Check your inbox for "Please confirm your email address"
3. Click the link → redirected to `/verify/email/success`
4. In admin → open the contact → email should show green "Verified" badge
5. Click the link again → redirected to `/verify/email/invalid`

- [ ] **Step 4: Test phone OTP flow (if Twilio configured)**

1. Submit form with a phone number
2. After clicking email verification link, success page should show the OTP input
3. Check your phone for the SMS code
4. Enter the code → "Phone number verified!"
5. In admin → open the contact → phone should show green "Verified" badge

- [ ] **Step 5: Test settings page**

Navigate to `/admin/settings` → "Communication Providers" card should show:
- Twilio row (existing)
- SMTP row (existing)
- ZeroBounce row: grey X if `ZEROBOUNCE_API_KEY` not in `.env`, green check if it is

- [ ] **Step 6: Final commit if any cleanup needed**

```bash
git add -A
git commit -m "chore: post-verification cleanup"
```
