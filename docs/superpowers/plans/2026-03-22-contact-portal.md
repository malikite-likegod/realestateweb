# Contact Portal Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow admins to invite contacts to create a portal account where they can browse all listings (active + historical) and save favourites.

**Architecture:** Extend the Contact model with 4 account fields + one new join table. Add a parallel contact auth system (separate `contact_token` cookie, `getContactSession()` in lib/auth.ts). New `app/portal/` route tree for public auth pages and protected portal pages. New `app/api/portal/` and `app/api/contacts/[id]/invite/` API routes.

**Tech Stack:** Next.js 14 App Router, Prisma ORM, jose JWT, bcryptjs, SHA-256 (crypto module), Nodemailer SMTP, Twilio SMS, Zod, Tailwind CSS

**Spec:** `docs/superpowers/specs/2026-03-22-contact-portal-design.md`

---

## Chunk 1: Schema + Auth Infrastructure

### Task 1: Prisma schema — Contact fields + ContactSavedListing model

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260322100000_add_contact_portal/migration.sql`

- [ ] **Step 1: Add 4 fields to Contact model**

  In `prisma/schema.prisma`, inside the `Contact` model (after the `emailVerificationSentAt` field or near the verification fields), add:

  ```prisma
  passwordHash          String?
  accountStatus         String?   // null | 'invited' | 'active'
  invitationTokenHash   String?
  invitationExpiresAt   DateTime?
  ```

  Also add the relation (at the bottom of the Contact model relations block):
  ```prisma
  savedListings ContactSavedListing[]
  ```

- [ ] **Step 2: Add ContactSavedListing model**

  After the existing models (near the end of the file), add:

  ```prisma
  // ─── Contact Portal ────────────────────────────────────────────────────────

  model ContactSavedListing {
    id        String   @id @default(cuid())
    contactId String
    listingId String
    savedAt   DateTime @default(now())

    contact   Contact  @relation(fields: [contactId], references: [id], onDelete: Cascade)
    listing   Listing  @relation(fields: [listingId], references: [id], onDelete: Cascade)

    @@unique([contactId, listingId])
    @@map("contact_saved_listings")
  }
  ```

- [ ] **Step 3: Add savedListings relation to Listing model**

  In the `Listing` model, add:
  ```prisma
  savedByContacts ContactSavedListing[]
  ```

- [ ] **Step 4: Create migration SQL manually**

  Create file `prisma/migrations/20260322100000_add_contact_portal/migration.sql`:

  ```sql
  ALTER TABLE "contacts" ADD COLUMN "passwordHash" TEXT;
  ALTER TABLE "contacts" ADD COLUMN "accountStatus" TEXT;
  ALTER TABLE "contacts" ADD COLUMN "invitationTokenHash" TEXT;
  ALTER TABLE "contacts" ADD COLUMN "invitationExpiresAt" TIMESTAMP(3);

  CREATE TABLE "contact_saved_listings" (
      "id" TEXT NOT NULL,
      "contactId" TEXT NOT NULL,
      "listingId" TEXT NOT NULL,
      "savedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "contact_saved_listings_pkey" PRIMARY KEY ("id")
  );

  CREATE UNIQUE INDEX "contact_saved_listings_contactId_listingId_key"
      ON "contact_saved_listings"("contactId", "listingId");

  ALTER TABLE "contact_saved_listings"
      ADD CONSTRAINT "contact_saved_listings_contactId_fkey"
      FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

  ALTER TABLE "contact_saved_listings"
      ADD CONSTRAINT "contact_saved_listings_listingId_fkey"
      FOREIGN KEY ("listingId") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  ```

- [ ] **Step 5: Apply migration and regenerate client**

  ```bash
  npx prisma migrate deploy
  npx prisma generate
  ```

  Expected: no errors, Prisma client regenerated with new fields.

- [ ] **Step 6: TypeScript check**

  ```bash
  npx tsc --noEmit
  ```

  Expected: no errors.

- [ ] **Step 7: Commit**

  ```bash
  git add prisma/schema.prisma prisma/migrations/
  git commit -m "feat: add Contact portal fields and ContactSavedListing schema"
  ```

---

### Task 2: Auth infrastructure — contact JWT functions + getContactSession

**Files:**
- Modify: `lib/jwt.ts`
- Modify: `lib/auth.ts`

- [ ] **Step 1: Add contact JWT functions to lib/jwt.ts**

  Append to `lib/jwt.ts`:

  ```ts
  const CONTACT_EXPIRES_IN = process.env.CONTACT_JWT_EXPIRES_IN ?? '7d'

  export async function signContactJwt(contactId: string, email: string): Promise<string> {
    return new SignJWT({ sub: contactId, email, type: 'contact' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(CONTACT_EXPIRES_IN)
      .sign(secret)
  }

  export async function signPendingContactJwt(contactId: string): Promise<string> {
    return new SignJWT({ sub: contactId, type: 'contact_pending' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('15m')
      .sign(secret)
  }

  export async function verifyContactJwt(token: string): Promise<{ contactId: string; email: string } | null> {
    try {
      const { payload } = await jwtVerify(token, secret)
      if (payload.type !== 'contact' || !payload.sub || !payload.email) return null
      return { contactId: payload.sub as string, email: payload.email as string }
    } catch {
      return null
    }
  }

  export async function verifyPendingContactJwt(token: string): Promise<{ contactId: string } | null> {
    try {
      const { payload } = await jwtVerify(token, secret)
      if (payload.type !== 'contact_pending' || !payload.sub) return null
      return { contactId: payload.sub as string }
    } catch {
      return null
    }
  }
  ```

- [ ] **Step 2: Add getContactSession and getPendingContactSession to lib/auth.ts**

  Append to `lib/auth.ts` (add the import at top: `import { verifyContactJwt, verifyPendingContactJwt } from './jwt'`):

  ```ts
  export async function getContactSession() {
    const cookieStore = await cookies()
    const token = cookieStore.get('contact_token')?.value
    if (!token) return null

    try {
      const payload = await verifyContactJwt(token)
      if (!payload) return null

      const contact = await prisma.contact.findUnique({
        where:  { id: payload.contactId },
        select: {
          id:            true,
          firstName:     true,
          lastName:      true,
          email:         true,
          accountStatus: true,
        },
      })
      if (!contact || contact.accountStatus !== 'active') return null
      return contact
    } catch {
      return null
    }
  }

  export async function getPendingContactId(): Promise<string | null> {
    const cookieStore = await cookies()
    const token = cookieStore.get('contact_pending_token')?.value
    if (!token) return null

    try {
      const payload = await verifyPendingContactJwt(token)
      return payload?.contactId ?? null
    } catch {
      return null
    }
  }
  ```

- [ ] **Step 3: TypeScript check**

  ```bash
  npx tsc --noEmit
  ```

  Expected: no errors.

- [ ] **Step 4: Commit**

  ```bash
  git add lib/jwt.ts lib/auth.ts
  git commit -m "feat: add contact JWT signing/verification and getContactSession"
  ```

---

## Chunk 2: Admin Invitation

### Task 3: POST /api/contacts/[id]/invite — send portal invitation

**Files:**
- Create: `app/api/contacts/[id]/invite/route.ts`

- [ ] **Step 1: Create the invite route**

  Create `app/api/contacts/[id]/invite/route.ts`:

  ```ts
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
  ```

- [ ] **Step 2: TypeScript check**

  ```bash
  npx tsc --noEmit
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add app/api/contacts/[id]/invite/route.ts
  git commit -m "feat: add POST /api/contacts/[id]/invite — send portal invitation email"
  ```

---

### Task 4: Add "Send Portal Invitation" button to contact detail page

**Files:**
- Create: `components/admin/contacts/PortalInviteButton.tsx`
- Modify: `app/admin/contacts/[id]/page.tsx`

The contact detail page is a server component. We need a client component for the button (it makes a fetch call).

- [ ] **Step 1: Create PortalInviteButton client component**

  Create `components/admin/contacts/PortalInviteButton.tsx`:

  ```tsx
  'use client'

  import { useState } from 'react'
  import { Mail, CheckCircle } from 'lucide-react'
  import { Button } from '@/components/ui'

  interface Props {
    contactId:     string
    accountStatus: string | null
  }

  export function PortalInviteButton({ contactId, accountStatus }: Props) {
    const [loading, setSending] = useState(false)
    const [sent,    setSent]    = useState(false)
    const [error,   setError]   = useState<string | null>(null)

    if (accountStatus === 'active') {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
          <CheckCircle size={13} /> Portal Active
        </span>
      )
    }

    const label = accountStatus === 'invited' ? 'Resend Invitation' : 'Send Portal Invitation'

    async function handleClick() {
      setSending(true)
      setError(null)
      try {
        const res = await fetch(`/api/contacts/${contactId}/invite`, { method: 'POST' })
        const json = await res.json()
        if (!res.ok) { setError(json.error ?? 'Failed to send'); return }
        setSent(true)
      } finally {
        setSending(false)
      }
    }

    if (sent) {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
          <CheckCircle size={13} /> Invitation sent!
        </span>
      )
    }

    return (
      <div className="flex flex-col items-end gap-1">
        <Button
          variant="outline"
          size="sm"
          leftIcon={<Mail size={13} />}
          onClick={handleClick}
          disabled={loading}
        >
          {loading ? 'Sending…' : label}
        </Button>
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    )
  }
  ```

- [ ] **Step 2: Add the button to the contact detail page**

  In `app/admin/contacts/[id]/page.tsx`:

  1. Add import at the top:
     ```ts
     import { PortalInviteButton } from '@/components/admin/contacts/PortalInviteButton'
     ```

  2. Update the `actions` prop of `<PageHeader>` (currently line 130) to include the button alongside the existing edit modal. The contact must have an email for the button to show:

     ```tsx
     actions={
       <div className="flex items-center gap-3">
         {contact.email && (
           <PortalInviteButton
             contactId={contact.id}
             accountStatus={contact.accountStatus ?? null}
           />
         )}
         <ContactEditModal contact={contact} />
       </div>
     }
     ```

  3. The `contact.accountStatus` field is now available because Task 1 added it to the schema (Prisma will include it automatically in `findUnique`).

- [ ] **Step 3: TypeScript check**

  ```bash
  npx tsc --noEmit
  ```

- [ ] **Step 4: Commit**

  ```bash
  git add components/admin/contacts/PortalInviteButton.tsx app/admin/contacts/[id]/page.tsx
  git commit -m "feat: add Send Portal Invitation button to contact detail page"
  ```

---

## Chunk 3: Account Setup + Phone Verification APIs

### Task 5: GET /api/portal/invite/validate — validate invite token

**Files:**
- Create: `app/api/portal/invite/validate/route.ts`

- [ ] **Step 1: Create the route**

  ```ts
  import { NextResponse } from 'next/server'
  import crypto from 'crypto'
  import { prisma } from '@/lib/prisma'

  function sha256(value: string): string {
    return crypto.createHash('sha256').update(value).digest('hex')
  }

  export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)
    const contactId = searchParams.get('contactId')
    const token     = searchParams.get('token')

    if (!contactId || !token) {
      return NextResponse.json({ valid: false })
    }

    const contact = await prisma.contact.findUnique({
      where:  { id: contactId },
      select: {
        firstName:           true,
        invitationTokenHash: true,
        invitationExpiresAt: true,
        accountStatus:       true,
        phone:               true,
        address:             true,
        city:                true,
        province:            true,
        postalCode:          true,
        phones:              { select: { number: true }, orderBy: { createdAt: 'asc' }, take: 1 },
        addresses:           { select: { street: true, city: true, province: true, postalCode: true }, orderBy: { createdAt: 'asc' }, take: 1 },
      },
    })

    if (!contact || !contact.invitationTokenHash || !contact.invitationExpiresAt) {
      return NextResponse.json({ valid: false })
    }

    if (contact.invitationExpiresAt < new Date()) {
      return NextResponse.json({ valid: false, reason: 'expired' })
    }

    const tokenHash = sha256(token)
    if (tokenHash !== contact.invitationTokenHash) {
      return NextResponse.json({ valid: false })
    }

    // Prefill data for the setup form
    const prefillPhone = contact.phones[0]?.number ?? contact.phone ?? ''
    const prefillAddress = contact.addresses[0]
      ? {
          street:     contact.addresses[0].street   ?? '',
          city:       contact.addresses[0].city     ?? '',
          province:   contact.addresses[0].province ?? '',
          postalCode: contact.addresses[0].postalCode ?? '',
        }
      : {
          street:     contact.address   ?? '',
          city:       contact.city      ?? '',
          province:   contact.province  ?? '',
          postalCode: contact.postalCode ?? '',
        }

    return NextResponse.json({
      valid:    true,
      firstName: contact.firstName,
      prefill:  { phone: prefillPhone, address: prefillAddress },
    })
  }
  ```

- [ ] **Step 2: TypeScript check + commit**

  ```bash
  npx tsc --noEmit
  git add app/api/portal/invite/validate/route.ts
  git commit -m "feat: add GET /api/portal/invite/validate"
  ```

---

### Task 6: POST /api/portal/setup — complete account setup

**Files:**
- Create: `app/api/portal/setup/route.ts`

- [ ] **Step 1: Create the route**

  ```ts
  import { NextResponse } from 'next/server'
  import crypto from 'crypto'
  import { z } from 'zod'
  import bcrypt from 'bcryptjs'
  import { prisma } from '@/lib/prisma'
  import { signPendingContactJwt } from '@/lib/jwt'
  import { sendPhoneOtp } from '@/lib/communications/verification-service'

  function sha256(value: string): string {
    return crypto.createHash('sha256').update(value).digest('hex')
  }

  const setupSchema = z.object({
    contactId: z.string().min(1),
    token:     z.string().min(1),
    password:  z.string().min(8),
    phone:     z.string().min(7),
    street:    z.string().min(1),
    city:      z.string().min(1),
    province:  z.string().min(1),
    postalCode:z.string().min(1),
  })

  export async function POST(request: Request) {
    try {
      const body = await request.json()
      const data = setupSchema.parse(body)

      const contact = await prisma.contact.findUnique({
        where:  { id: data.contactId },
        select: {
          id:                  true,
          invitationTokenHash: true,
          invitationExpiresAt: true,
          accountStatus:       true,
        },
      })

      if (!contact || !contact.invitationTokenHash || !contact.invitationExpiresAt) {
        return NextResponse.json({ error: 'Invalid invitation' }, { status: 400 })
      }

      if (contact.invitationExpiresAt < new Date()) {
        return NextResponse.json({ error: 'Invitation has expired' }, { status: 400 })
      }

      const tokenHash = sha256(data.token)
      if (tokenHash !== contact.invitationTokenHash) {
        return NextResponse.json({ error: 'Invalid invitation' }, { status: 400 })
      }

      const passwordHash = await bcrypt.hash(data.password, 12)

      await prisma.contact.update({
        where: { id: contact.id },
        data: {
          passwordHash,
          phone:               data.phone,
          address:             data.street,
          city:                data.city,
          province:            data.province,
          postalCode:          data.postalCode,
          accountStatus:       'invited',        // stays 'invited' until phone verified
          invitationTokenHash: null,             // single-use token cleared
          invitationExpiresAt: null,
        },
      })

      // Send SMS OTP
      await sendPhoneOtp(contact.id)

      // Issue short-lived pending cookie
      const pendingToken = await signPendingContactJwt(contact.id)
      const response = NextResponse.json({ message: 'Setup complete — OTP sent' })
      response.cookies.set('contact_pending_token', pendingToken, {
        httpOnly: true,
        secure:   process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge:   60 * 15, // 15 minutes
        path:     '/',
      })
      return response
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: error.errors }, { status: 400 })
      }
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
  }
  ```

- [ ] **Step 2: TypeScript check + commit**

  ```bash
  npx tsc --noEmit
  git add app/api/portal/setup/route.ts
  git commit -m "feat: add POST /api/portal/setup — account setup with password and address"
  ```

---

### Task 7: POST /api/portal/verify-phone — OTP validation + activate account

**Files:**
- Create: `app/api/portal/verify-phone/route.ts`

- [ ] **Step 1: Create the route**

  ```ts
  import { NextResponse } from 'next/server'
  import { z } from 'zod'
  import { getPendingContactId } from '@/lib/auth'
  import { signContactJwt } from '@/lib/jwt'
  import { verifyPhoneOtp } from '@/lib/communications/verification-service'
  import { prisma } from '@/lib/prisma'

  const schema = z.object({ code: z.string().length(6) })

  export async function POST(request: Request) {
    // Identify contact via short-lived pending cookie (not URL param — avoids IDOR)
    const contactId = await getPendingContactId()
    if (!contactId) {
      return NextResponse.json({ error: 'Session expired — please restart account setup' }, { status: 401 })
    }

    try {
      const body = await request.json()
      const { code } = schema.parse(body)

      // verifyPhoneOtp uses the phoneSessionTokenHash set by sendPhoneOtp.
      // We need to look up the contact's phoneSessionTokenHash and pass it.
      // Since we have contactId from the pending cookie, load the session token hash.
      const contact = await prisma.contact.findUnique({
        where:  { id: contactId },
        select: { phoneSessionTokenHash: true, phoneOtpCode: true, phoneOtpExpiresAt: true, phoneOtpAttempts: true },
      })
      if (!contact) return NextResponse.json({ error: 'Contact not found' }, { status: 404 })

      // Manual OTP check (same logic as verifyPhoneOtp but using contactId directly)
      const sha256 = (v: string) => require('crypto').createHash('sha256').update(v).digest('hex')

      if ((contact.phoneOtpAttempts ?? 0) >= 5) {
        return NextResponse.json({ error: 'Too many attempts — please contact your agent' }, { status: 429 })
      }

      if (!contact.phoneOtpExpiresAt || contact.phoneOtpExpiresAt < new Date()) {
        return NextResponse.json({ error: 'OTP expired — please resend' }, { status: 400 })
      }

      const codeHash = sha256(code)
      if (codeHash !== (contact.phoneOtpCode ?? '')) {
        await prisma.contact.update({
          where: { id: contactId },
          data:  { phoneOtpAttempts: { increment: 1 } },
        })
        return NextResponse.json({ error: 'Invalid code' }, { status: 400 })
      }

      // Correct code — activate account
      await prisma.contact.update({
        where: { id: contactId },
        data: {
          phoneVerified:         true,
          accountStatus:         'active',
          phoneOtpCode:          null,
          phoneOtpExpiresAt:     null,
          phoneOtpAttempts:      0,
          phoneSessionTokenHash: null,
        },
      })

      // Load contact email for JWT
      const { email, firstName } = await prisma.contact.findUniqueOrThrow({
        where:  { id: contactId },
        select: { email: true, firstName: true },
      })

      const token = await signContactJwt(contactId, email ?? '')
      const response = NextResponse.json({ message: 'Account activated', firstName })

      // Clear pending cookie, issue full session cookie
      response.cookies.set('contact_pending_token', '', { maxAge: 0, path: '/' })
      response.cookies.set('contact_token', token, {
        httpOnly: true,
        secure:   process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge:   60 * 60 * 24 * 7,
        path:     '/',
      })
      return response
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: error.errors }, { status: 400 })
      }
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
  }

  export async function DELETE() {
    // Resend OTP
    const contactId = await getPendingContactId()
    if (!contactId) return NextResponse.json({ error: 'Session expired' }, { status: 401 })

    const { sendPhoneOtp } = await import('@/lib/communications/verification-service')
    const result = await sendPhoneOtp(contactId)
    if (!result.sent) return NextResponse.json({ error: 'Could not resend OTP' }, { status: 500 })
    return NextResponse.json({ message: 'OTP resent' })
  }
  ```

- [ ] **Step 2: TypeScript check + commit**

  ```bash
  npx tsc --noEmit
  git add app/api/portal/verify-phone/route.ts
  git commit -m "feat: add POST /api/portal/verify-phone — OTP validation and account activation"
  ```

---

## Chunk 4: Portal Auth Pages

### Task 8: POST /api/portal/login + POST /api/portal/logout

**Files:**
- Create: `app/api/portal/login/route.ts`
- Create: `app/api/portal/logout/route.ts`

- [ ] **Step 1: Create login route**

  Create `app/api/portal/login/route.ts`:

  ```ts
  import { NextResponse } from 'next/server'
  import { z } from 'zod'
  import bcrypt from 'bcryptjs'
  import { prisma } from '@/lib/prisma'
  import { signContactJwt } from '@/lib/jwt'

  const schema = z.object({
    email:    z.string().email(),
    password: z.string().min(1),
  })

  export async function POST(request: Request) {
    try {
      const body = await request.json()
      const { email, password } = schema.parse(body)

      const contact = await prisma.contact.findUnique({
        where:  { email },
        select: { id: true, firstName: true, passwordHash: true, accountStatus: true, email: true },
      })

      // Generic error prevents account enumeration
      const INVALID = NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })

      if (!contact || !contact.passwordHash) return INVALID
      if (contact.accountStatus !== 'active') return INVALID

      const valid = await bcrypt.compare(password, contact.passwordHash)
      if (!valid) return INVALID

      const token = await signContactJwt(contact.id, contact.email ?? '')
      const response = NextResponse.json({ firstName: contact.firstName })
      response.cookies.set('contact_token', token, {
        httpOnly: true,
        secure:   process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge:   60 * 60 * 24 * 7,
        path:     '/',
      })
      return response
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: error.errors }, { status: 400 })
      }
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
  }
  ```

- [ ] **Step 2: Create logout route**

  Create `app/api/portal/logout/route.ts`:

  ```ts
  import { NextResponse } from 'next/server'

  export async function POST() {
    const response = NextResponse.json({ message: 'Logged out' })
    response.cookies.set('contact_token', '', { maxAge: 0, path: '/' })
    return response
  }
  ```

- [ ] **Step 3: TypeScript check + commit**

  ```bash
  npx tsc --noEmit
  git add app/api/portal/login/route.ts app/api/portal/logout/route.ts
  git commit -m "feat: add POST /api/portal/login and /api/portal/logout"
  ```

---

### Task 9: Portal layout + login page + invite setup page + verify-phone page

**Files:**
- Create: `app/portal/layout.tsx`
- Create: `app/portal/login/page.tsx`
- Create: `app/portal/invite/[token]/page.tsx`
- Create: `app/portal/verify-phone/page.tsx`

- [ ] **Step 1: Create portal layout**

  Create `app/portal/layout.tsx`:

  ```tsx
  import type { Metadata } from 'next'

  export const metadata: Metadata = { title: 'Client Portal' }

  export default function PortalLayout({ children }: { children: React.ReactNode }) {
    return (
      <div className="min-h-screen bg-gray-50">
        {children}
      </div>
    )
  }
  ```

- [ ] **Step 2: Create portal login page**

  Create `app/portal/login/page.tsx`:

  ```tsx
  'use client'

  import { useState } from 'react'
  import { useRouter } from 'next/navigation'

  export default function PortalLoginPage() {
    const router = useRouter()
    const [email,    setEmail]    = useState('')
    const [password, setPassword] = useState('')
    const [error,    setError]    = useState<string | null>(null)
    const [loading,  setLoading]  = useState(false)

    async function handleSubmit(e: React.FormEvent) {
      e.preventDefault()
      setLoading(true)
      setError(null)
      try {
        const res  = await fetch('/api/portal/login', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ email, password }),
        })
        const json = await res.json()
        if (!res.ok) { setError(json.error ?? 'Login failed'); return }
        router.push('/portal')
      } finally {
        setLoading(false)
      }
    }

    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <h1 className="text-2xl font-semibold text-gray-900 mb-1">Client Portal</h1>
          <p className="text-sm text-gray-500 mb-6">Sign in to your account</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-amber-600 hover:bg-amber-700 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors disabled:opacity-50"
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    )
  }
  ```

- [ ] **Step 3: Create invite setup page**

  Create `app/portal/invite/[token]/page.tsx`:

  ```tsx
  'use client'

  import { useState, useEffect } from 'react'
  import { useRouter, useSearchParams, useParams } from 'next/navigation'

  interface Prefill {
    phone:   string
    address: { street: string; city: string; province: string; postalCode: string }
  }

  export default function InviteSetupPage() {
    const router      = useRouter()
    const params      = useParams()
    const searchParams= useSearchParams()
    const token       = params.token as string
    const contactId   = searchParams.get('contactId') ?? ''

    const [valid,      setValid]      = useState<boolean | null>(null)
    const [firstName,  setFirstName]  = useState('')
    const [prefill,    setPrefill]    = useState<Prefill | null>(null)

    const [password,   setPassword]   = useState('')
    const [confirm,    setConfirm]    = useState('')
    const [phone,      setPhone]      = useState('')
    const [street,     setStreet]     = useState('')
    const [city,       setCity]       = useState('')
    const [province,   setProvince]   = useState('')
    const [postalCode, setPostalCode] = useState('')

    const [error,      setError]      = useState<string | null>(null)
    const [loading,    setLoading]    = useState(false)

    useEffect(() => {
      if (!contactId || !token) { setValid(false); return }
      fetch(`/api/portal/invite/validate?contactId=${contactId}&token=${token}`)
        .then(r => r.json())
        .then(j => {
          setValid(j.valid)
          if (j.valid) {
            setFirstName(j.firstName ?? '')
            setPrefill(j.prefill)
            setPhone(j.prefill?.phone ?? '')
            setStreet(j.prefill?.address?.street ?? '')
            setCity(j.prefill?.address?.city ?? '')
            setProvince(j.prefill?.address?.province ?? '')
            setPostalCode(j.prefill?.address?.postalCode ?? '')
          }
        })
        .catch(() => setValid(false))
    }, [contactId, token])

    async function handleSubmit(e: React.FormEvent) {
      e.preventDefault()
      if (password !== confirm) { setError('Passwords do not match'); return }
      setLoading(true)
      setError(null)
      try {
        const res  = await fetch('/api/portal/setup', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ contactId, token, password, phone, street, city, province, postalCode }),
        })
        const json = await res.json()
        if (!res.ok) { setError(json.error ?? 'Setup failed'); return }
        router.push('/portal/verify-phone')
      } finally {
        setLoading(false)
      }
    }

    if (valid === null) {
      return <div className="min-h-screen flex items-center justify-center text-sm text-gray-500">Validating invitation…</div>
    }

    if (!valid) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="text-center">
            <h1 className="text-xl font-semibold text-gray-900 mb-2">Invalid or Expired Invitation</h1>
            <p className="text-sm text-gray-500">Please contact your agent for a new invitation link.</p>
          </div>
        </div>
      )
    }

    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <h1 className="text-2xl font-semibold text-gray-900 mb-1">Set Up Your Account</h1>
          <p className="text-sm text-gray-500 mb-6">Welcome{firstName ? `, ${firstName}` : ''}! Create your password and confirm your details.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
              <p className="text-xs text-gray-400 mt-1">Minimum 8 characters</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
              <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Street Address</label>
              <input type="text" value={street} onChange={e => setStreet(e.target.value)} required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                <input type="text" value={city} onChange={e => setCity(e.target.value)} required
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Province</label>
                <input type="text" value={province} onChange={e => setProvince(e.target.value)} required
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Postal Code</label>
              <input type="text" value={postalCode} onChange={e => setPostalCode(e.target.value)} required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button type="submit" disabled={loading}
              className="w-full bg-amber-600 hover:bg-amber-700 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors disabled:opacity-50">
              {loading ? 'Setting up…' : 'Continue'}
            </button>
          </form>
        </div>
      </div>
    )
  }
  ```

- [ ] **Step 4: Create verify-phone page**

  Create `app/portal/verify-phone/page.tsx`:

  ```tsx
  'use client'

  import { useState } from 'react'
  import { useRouter } from 'next/navigation'

  export default function VerifyPhonePage() {
    const router = useRouter()
    const [code,    setCode]    = useState('')
    const [error,   setError]   = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const [resent,  setResent]  = useState(false)

    async function handleSubmit(e: React.FormEvent) {
      e.preventDefault()
      setLoading(true)
      setError(null)
      try {
        const res  = await fetch('/api/portal/verify-phone', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ code }),
        })
        const json = await res.json()
        if (!res.ok) { setError(json.error ?? 'Verification failed'); return }
        router.push('/portal')
      } finally {
        setLoading(false)
      }
    }

    async function handleResend() {
      setResent(false)
      const res = await fetch('/api/portal/verify-phone', { method: 'DELETE' })
      if (res.ok) setResent(true)
      else setError('Could not resend code')
    }

    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <h1 className="text-2xl font-semibold text-gray-900 mb-1">Verify Your Phone</h1>
          <p className="text-sm text-gray-500 mb-6">Enter the 6-digit code sent to your phone number.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-3 text-center text-2xl tracking-widest focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            {error  && <p className="text-sm text-red-600">{error}</p>}
            {resent && <p className="text-sm text-emerald-600">Code resent!</p>}
            <button type="submit" disabled={loading}
              className="w-full bg-amber-600 hover:bg-amber-700 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors disabled:opacity-50">
              {loading ? 'Verifying…' : 'Verify'}
            </button>
            <button type="button" onClick={handleResend}
              className="w-full text-sm text-gray-500 hover:text-gray-700">
              Resend code
            </button>
          </form>
        </div>
      </div>
    )
  }
  ```

- [ ] **Step 5: TypeScript check + commit**

  ```bash
  npx tsc --noEmit
  git add app/portal/layout.tsx app/portal/login/page.tsx app/portal/invite/ app/portal/verify-phone/page.tsx
  git commit -m "feat: add portal auth pages — login, invite setup, verify phone"
  ```

---

## Chunk 5: Portal Listings API + UI

### Task 10: Portal listings and saved API routes

**Files:**
- Create: `app/api/portal/listings/route.ts`
- Create: `app/api/portal/listings/[id]/route.ts`
- Create: `app/api/portal/saved/route.ts`
- Create: `app/api/portal/saved/[listingId]/route.ts`

- [ ] **Step 1: Create GET /api/portal/listings**

  Create `app/api/portal/listings/route.ts`:

  ```ts
  import { NextResponse } from 'next/server'
  import { getContactSession } from '@/lib/auth'
  import { prisma } from '@/lib/prisma'

  export async function GET(request: Request) {
    const contact = await getContactSession()
    if (!contact) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const status    = searchParams.get('status')    // 'active'|'sold'|'expired'|null
    const minPrice  = searchParams.get('minPrice')
    const maxPrice  = searchParams.get('maxPrice')
    const minBeds   = searchParams.get('minBeds')

    // Build property filter
    const propertyWhere: Record<string, unknown> = {}
    if (status && ['active','sold','expired','draft'].includes(status)) {
      propertyWhere.status = status
    }
    if (minPrice) propertyWhere.price = { ...(propertyWhere.price as object ?? {}), gte: Number(minPrice) }
    if (maxPrice) propertyWhere.price = { ...(propertyWhere.price as object ?? {}), lte: Number(maxPrice) }
    if (minBeds)  propertyWhere.bedrooms = { gte: Number(minBeds) }

    const listings = await prisma.listing.findMany({
      where:   { property: propertyWhere },
      include: {
        property: {
          select: {
            id: true, title: true, status: true, price: true,
            bedrooms: true, bathrooms: true, sqft: true,
            address: true, city: true, province: true, postalCode: true,
            images: true, listedAt: true, soldAt: true,
          },
        },
        savedByContacts: {
          where:  { contactId: contact.id },
          select: { id: true },
        },
      },
      orderBy: [{ property: { status: 'asc' } }, { property: { listedAt: 'desc' } }],
    })

    const data = listings.map(l => ({
      id:        l.id,
      slug:      l.slug,
      property:  l.property,
      isSaved:   l.savedByContacts.length > 0,
    }))

    return NextResponse.json({ data })
  }
  ```

- [ ] **Step 2: Create GET /api/portal/listings/[id]**

  Create `app/api/portal/listings/[id]/route.ts`:

  ```ts
  import { NextResponse } from 'next/server'
  import { getContactSession } from '@/lib/auth'
  import { prisma } from '@/lib/prisma'

  export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
    const contact = await getContactSession()
    if (!contact) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const listing = await prisma.listing.findUnique({
      where:   { id },
      include: {
        property: true,
        savedByContacts: {
          where:  { contactId: contact.id },
          select: { id: true },
        },
      },
    })

    if (!listing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    return NextResponse.json({
      data: {
        ...listing,
        isSaved: listing.savedByContacts.length > 0,
        savedByContacts: undefined,
      },
    })
  }
  ```

- [ ] **Step 3: Create GET + POST /api/portal/saved**

  Create `app/api/portal/saved/route.ts`:

  ```ts
  import { NextResponse } from 'next/server'
  import { z } from 'zod'
  import { getContactSession } from '@/lib/auth'
  import { prisma } from '@/lib/prisma'

  export async function GET() {
    const contact = await getContactSession()
    if (!contact) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const saved = await prisma.contactSavedListing.findMany({
      where:   { contactId: contact.id },
      include: {
        listing: {
          include: {
            property: {
              select: {
                id: true, title: true, status: true, price: true,
                bedrooms: true, bathrooms: true, sqft: true,
                address: true, city: true, province: true, postalCode: true,
                images: true,
              },
            },
          },
        },
      },
      orderBy: { savedAt: 'desc' },
    })

    return NextResponse.json({ data: saved.map(s => ({ ...s.listing, isSaved: true })) })
  }

  export async function POST(request: Request) {
    const contact = await getContactSession()
    if (!contact) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body      = await request.json()
    const { listingId } = z.object({ listingId: z.string() }).parse(body)

    await prisma.contactSavedListing.upsert({
      where:  { contactId_listingId: { contactId: contact.id, listingId } },
      create: { contactId: contact.id, listingId },
      update: {},
    })

    return NextResponse.json({ message: 'Saved' })
  }
  ```

- [ ] **Step 4: Create DELETE /api/portal/saved/[listingId]**

  Create `app/api/portal/saved/[listingId]/route.ts`:

  ```ts
  import { NextResponse } from 'next/server'
  import { getContactSession } from '@/lib/auth'
  import { prisma } from '@/lib/prisma'

  export async function DELETE(_: Request, { params }: { params: Promise<{ listingId: string }> }) {
    const contact = await getContactSession()
    if (!contact) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { listingId } = await params
    await prisma.contactSavedListing.deleteMany({
      where: { contactId: contact.id, listingId },
    })

    return NextResponse.json({ message: 'Unsaved' })
  }
  ```

- [ ] **Step 5: TypeScript check + commit**

  ```bash
  npx tsc --noEmit
  git add app/api/portal/
  git commit -m "feat: add portal listings and saved listings API routes"
  ```

---

### Task 11: Portal UI pages — listings browse, listing detail, saved

**Files:**
- Create: `app/portal/page.tsx`
- Create: `app/portal/listings/[id]/page.tsx`
- Create: `app/portal/saved/page.tsx`
- Create: `components/portal/PortalHeader.tsx`
- Create: `components/portal/ListingCard.tsx`
- Create: `components/portal/SaveButton.tsx`

> **Note on route protection:** The spec mentions a `(protected)` route group, but this plan uses flat routes under `app/portal/` with each server component calling `getContactSession()` and redirecting. Both approaches are valid Next.js patterns; this is simpler and avoids an extra layout file. The protection behaviour is identical.

- [ ] **Step 1: Create PortalHeader**

  Create `components/portal/PortalHeader.tsx`:

  ```tsx
  'use client'

  import { useRouter } from 'next/navigation'

  interface Props { firstName: string | null }

  export function PortalHeader({ firstName }: Props) {
    const router = useRouter()

    async function handleLogout() {
      await fetch('/api/portal/logout', { method: 'POST' })
      router.push('/portal/login')
    }

    return (
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <span className="font-semibold text-gray-900">Client Portal</span>
          <nav className="flex gap-4 text-sm">
            <a href="/portal" className="text-gray-600 hover:text-gray-900">Listings</a>
            <a href="/portal/saved" className="text-gray-600 hover:text-gray-900">Saved</a>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">{firstName ? `Hi, ${firstName}` : 'Hi'}</span>
          <button onClick={handleLogout} className="text-sm text-gray-500 hover:text-gray-900">Log out</button>
        </div>
      </header>
    )
  }
  ```

- [ ] **Step 2: Create SaveButton**

  Create `components/portal/SaveButton.tsx`:

  ```tsx
  'use client'

  import { useState } from 'react'
  import { Heart } from 'lucide-react'

  interface Props { listingId: string; initialSaved: boolean }

  export function SaveButton({ listingId, initialSaved }: Props) {
    const [saved,   setSaved]   = useState(initialSaved)
    const [loading, setLoading] = useState(false)
    const [error,   setError]   = useState<string | null>(null)

    async function toggle() {
      setLoading(true)
      setError(null)
      try {
        let res: Response
        if (saved) {
          res = await fetch(`/api/portal/saved/${listingId}`, { method: 'DELETE' })
        } else {
          res = await fetch('/api/portal/saved', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ listingId }),
          })
        }
        if (!res.ok) { setError('Failed'); return }
        setSaved(!saved)
      } catch {
        setError('Failed')
      } finally {
        setLoading(false)
      }
    }

    return (
      <div className="flex flex-col items-center">
        <button
          onClick={toggle}
          disabled={loading}
          className={`p-2 rounded-full transition-colors ${saved ? 'text-red-500 bg-red-50' : 'text-gray-400 hover:text-red-400 bg-gray-50'}`}
          title={saved ? 'Unsave' : 'Save'}
        >
          <Heart size={16} fill={saved ? 'currentColor' : 'none'} />
        </button>
        {error && <span className="text-xs text-red-500">!</span>}
      </div>
    )
  }
  ```

- [ ] **Step 3: Create ListingCard**

  Create `components/portal/ListingCard.tsx`:

  ```tsx
  import Link from 'next/link'
  import { SaveButton } from './SaveButton'

  interface Property {
    id:        string
    title:     string
    status:    string
    price:     number | null
    bedrooms:  number | null
    bathrooms: number | null
    sqft:      number | null
    address:   string | null
    city:      string | null
    province:  string | null
    images:    unknown
  }

  interface Props {
    listing:  { id: string; property: Property }
    isSaved:  boolean
  }

  const statusColors: Record<string, string> = {
    active:  'bg-emerald-100 text-emerald-700',
    sold:    'bg-red-100 text-red-700',
    expired: 'bg-gray-100 text-gray-600',
    draft:   'bg-yellow-100 text-yellow-700',
  }

  export function ListingCard({ listing, isSaved }: Props) {
    const p = listing.property
    const images = Array.isArray(p.images) ? p.images as string[] : []
    const photo  = images[0] ?? null

    return (
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
        <Link href={`/portal/listings/${listing.id}`}>
          <div className="h-48 bg-gray-100">
            {photo
              ? <img src={photo} alt={p.title} className="w-full h-full object-cover" />
              : <div className="w-full h-full flex items-center justify-center text-gray-300 text-sm">No photo</div>
            }
          </div>
        </Link>
        <div className="p-4">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{p.title || [p.address, p.city].filter(Boolean).join(', ')}</p>
              <p className="text-xs text-gray-500 truncate">{[p.address, p.city, p.province].filter(Boolean).join(', ')}</p>
            </div>
            <SaveButton listingId={listing.id} initialSaved={isSaved} />
          </div>
          <div className="flex items-center justify-between">
            <p className="text-base font-bold text-gray-900">
              {p.price ? `$${p.price.toLocaleString()}` : 'Price N/A'}
            </p>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${statusColors[p.status] ?? 'bg-gray-100 text-gray-600'}`}>
              {p.status}
            </span>
          </div>
          {(p.bedrooms || p.bathrooms || p.sqft) && (
            <p className="text-xs text-gray-400 mt-1">
              {[
                p.bedrooms  ? `${p.bedrooms} bed`  : null,
                p.bathrooms ? `${p.bathrooms} bath` : null,
                p.sqft      ? `${p.sqft.toLocaleString()} sqft` : null,
              ].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
      </div>
    )
  }
  ```

- [ ] **Step 4: Create /portal/page.tsx — listings browse**

  Create `app/portal/page.tsx`:

  ```tsx
  import { redirect } from 'next/navigation'
  import { getContactSession } from '@/lib/auth'
  import { PortalHeader } from '@/components/portal/PortalHeader'
  import { ListingCard } from '@/components/portal/ListingCard'
  import { prisma } from '@/lib/prisma'

  export default async function PortalPage({
    searchParams,
  }: {
    searchParams: Promise<{ status?: string; minPrice?: string; maxPrice?: string; minBeds?: string }>
  }) {
    const contact = await getContactSession()
    if (!contact) redirect('/portal/login')

    const sp = await searchParams
    const statusFilter = sp.status && ['active','sold','expired'].includes(sp.status) ? sp.status : undefined

    const propertyWhere: Record<string, unknown> = {}
    if (statusFilter) propertyWhere.status = statusFilter
    if (sp.minPrice)  propertyWhere.price = { ...(propertyWhere.price as object ?? {}), gte: Number(sp.minPrice) }
    if (sp.maxPrice)  propertyWhere.price = { ...(propertyWhere.price as object ?? {}), lte: Number(sp.maxPrice) }
    if (sp.minBeds)   propertyWhere.bedrooms = { gte: Number(sp.minBeds) }

    const listings = await prisma.listing.findMany({
      where:   { property: propertyWhere },
      include: {
        property:        { select: { id: true, title: true, status: true, price: true, bedrooms: true, bathrooms: true, sqft: true, address: true, city: true, province: true, postalCode: true, images: true, listedAt: true } },
        savedByContacts: { where: { contactId: contact.id }, select: { id: true } },
      },
      orderBy: [{ property: { status: 'asc' } }, { property: { listedAt: 'desc' } }],
    })

    return (
      <>
        <PortalHeader firstName={contact.firstName} />
        <main className="max-w-6xl mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-xl font-semibold text-gray-900">Properties</h1>
            <p className="text-sm text-gray-500">{listings.length} listing{listings.length !== 1 ? 's' : ''}</p>
          </div>

          {/* Filters */}
          <form className="flex flex-wrap gap-3 mb-6">
            <select name="status" defaultValue={sp.status ?? ''} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="sold">Sold</option>
              <option value="expired">Expired</option>
            </select>
            <input name="minBeds" type="number" min="0" placeholder="Min beds" defaultValue={sp.minBeds ?? ''} className="w-28 rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            <input name="minPrice" type="number" placeholder="Min price" defaultValue={sp.minPrice ?? ''} className="w-32 rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            <input name="maxPrice" type="number" placeholder="Max price" defaultValue={sp.maxPrice ?? ''} className="w-32 rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            <button type="submit" className="bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-700">Filter</button>
            <a href="/portal" className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">Clear</a>
          </form>

          {listings.length === 0 ? (
            <p className="text-center text-gray-400 py-16">No listings found.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {listings.map(l => (
                <ListingCard key={l.id} listing={l} isSaved={l.savedByContacts.length > 0} />
              ))}
            </div>
          )}
        </main>
      </>
    )
  }
  ```

- [ ] **Step 5: Create /portal/listings/[id]/page.tsx**

  Create `app/portal/listings/[id]/page.tsx`:

  ```tsx
  import { notFound, redirect } from 'next/navigation'
  import Link from 'next/link'
  import { getContactSession } from '@/lib/auth'
  import { prisma } from '@/lib/prisma'
  import { PortalHeader } from '@/components/portal/PortalHeader'
  import { SaveButton } from '@/components/portal/SaveButton'

  const statusColors: Record<string, string> = {
    active:  'bg-emerald-100 text-emerald-700',
    sold:    'bg-red-100 text-red-700',
    expired: 'bg-gray-100 text-gray-600',
  }

  export default async function PortalListingDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const contact = await getContactSession()
    if (!contact) redirect('/portal/login')

    const { id } = await params
    const listing = await prisma.listing.findUnique({
      where:   { id },
      include: {
        property:        true,
        savedByContacts: { where: { contactId: contact.id }, select: { id: true } },
      },
    })
    if (!listing) notFound()

    const p       = listing.property
    const isSaved = listing.savedByContacts.length > 0
    const images  = Array.isArray(p.images) ? p.images as string[] : []

    return (
      <>
        <PortalHeader firstName={contact.firstName} />
        <main className="max-w-4xl mx-auto px-4 py-8">
          <Link href="/portal" className="text-sm text-amber-600 hover:underline mb-4 inline-block">← Back to listings</Link>

          {images.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
              {images.slice(0, 4).map((src, i) => (
                <img key={i} src={src} alt={`Photo ${i + 1}`} className="w-full h-56 object-cover rounded-xl" />
              ))}
            </div>
          )}

          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">{p.title || p.address}</h1>
              <p className="text-gray-500 mt-1">{[p.address, p.city, p.province, p.postalCode].filter(Boolean).join(', ')}</p>
            </div>
            <SaveButton listingId={listing.id} initialSaved={isSaved} />
          </div>

          <div className="flex flex-wrap items-center gap-4 mb-6">
            <span className="text-3xl font-bold text-gray-900">
              {p.price ? `$${p.price.toLocaleString()}` : 'Price N/A'}
            </span>
            <span className={`text-sm font-medium px-3 py-1 rounded-full capitalize ${statusColors[p.status] ?? 'bg-gray-100 text-gray-600'}`}>
              {p.status}
            </span>
          </div>

          <div className="flex flex-wrap gap-6 text-sm text-gray-600 mb-6">
            {p.bedrooms  && <span><strong>{p.bedrooms}</strong> Bedrooms</span>}
            {p.bathrooms && <span><strong>{p.bathrooms}</strong> Bathrooms</span>}
            {p.sqft      && <span><strong>{p.sqft.toLocaleString()}</strong> sqft</span>}
            {p.yearBuilt && <span>Built <strong>{p.yearBuilt}</strong></span>}
          </div>

          {p.description && (
            <div className="prose prose-sm max-w-none text-gray-700">
              <p>{p.description}</p>
            </div>
          )}
        </main>
      </>
    )
  }
  ```

- [ ] **Step 6: Create /portal/saved/page.tsx**

  Create `app/portal/saved/page.tsx`:

  ```tsx
  import { redirect } from 'next/navigation'
  import { getContactSession } from '@/lib/auth'
  import { prisma } from '@/lib/prisma'
  import { PortalHeader } from '@/components/portal/PortalHeader'
  import { ListingCard } from '@/components/portal/ListingCard'

  export default async function PortalSavedPage() {
    const contact = await getContactSession()
    if (!contact) redirect('/portal/login')

    const saved = await prisma.contactSavedListing.findMany({
      where:   { contactId: contact.id },
      include: {
        listing: {
          include: {
            property: { select: { id: true, title: true, status: true, price: true, bedrooms: true, bathrooms: true, sqft: true, address: true, city: true, province: true, postalCode: true, images: true, listedAt: true } },
          },
        },
      },
      orderBy: { savedAt: 'desc' },
    })

    return (
      <>
        <PortalHeader firstName={contact.firstName} />
        <main className="max-w-6xl mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-xl font-semibold text-gray-900">Saved Listings</h1>
            <p className="text-sm text-gray-500">{saved.length} saved</p>
          </div>

          {saved.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-gray-400 mb-2">No saved listings yet.</p>
              <a href="/portal" className="text-sm text-amber-600 hover:underline">Browse listings</a>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {saved.map(s => (
                <ListingCard key={s.listing.id} listing={s.listing} isSaved={true} />
              ))}
            </div>
          )}
        </main>
      </>
    )
  }
  ```

- [ ] **Step 7: TypeScript check + commit**

  ```bash
  npx tsc --noEmit
  git add components/portal/ app/portal/page.tsx app/portal/listings/ app/portal/saved/
  git commit -m "feat: add portal UI — listings browse, listing detail, saved listings"
  ```

---

## Chunk 6: Final Verification

### Task 12: End-to-end smoke test

- [ ] **Step 1: Start dev server**

  ```bash
  npm run dev
  ```

- [ ] **Step 2: Admin sends invitation**

  1. Go to `/admin/contacts`
  2. Open any contact that has an email address
  3. "Send Portal Invitation" button should appear in the page header
  4. Click it — button shows "Sending…" then "Invitation sent!"
  5. Check the invitation email was sent (or check console in dev/demo mode)

- [ ] **Step 3: Contact sets up account**

  1. Open the invite URL from the email: `/portal/invite/{token}?contactId={id}`
  2. Page should show the setup form with pre-filled phone/address
  3. Fill in password, confirm, phone, address — click Continue
  4. Should redirect to `/portal/verify-phone`

- [ ] **Step 4: Contact verifies phone**

  1. If Twilio is configured, enter the real OTP from SMS
  2. If not configured (dev mode), check DB: `phoneOtpCode` field (it's SHA-256 hashed — you'll need to trigger the OTP manually or temporarily log it)
  3. On success → redirects to `/portal`

- [ ] **Step 5: Contact browses listings**

  1. Portal loads with listings grid
  2. Filter by status/beds/price works
  3. Heart button saves/unsaves a listing
  4. Click a listing card → detail page loads
  5. Navigate to /portal/saved → saved listing appears

- [ ] **Step 6: Contact logs out and back in**

  1. Click "Log out" → redirects to `/portal/login`
  2. Enter email + password → redirects to `/portal`

- [ ] **Step 7: Resend invitation**

  1. Go back to the same contact in admin
  2. Button now shows "Resend Invitation"
  3. After activation, button shows "Portal Active" (read-only)
