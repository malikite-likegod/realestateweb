# Two-Factor Authentication (Email OTP) Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add optional per-user 2FA via email OTP — a toggle in Admin Settings enables it; on login, a 6-digit code is emailed and must be entered before the full session is granted.

**Architecture:** Two-phase JWT approach: after password verification, if 2FA is on, issue a short-lived `pending_token` cookie (`mfaPending: true`), send OTP email, and redirect to a verify page. On OTP success, clear the pending token and issue the real `auth_token`. The Settings page hosts a `TwoFactorCard` client component that drives the enable/disable flow using the same OTP mechanism without a pending JWT (full session already exists). All OTP hashes are stored server-side in the DB; the raw code only travels in the email.

**Tech Stack:** Next.js 15 App Router, Prisma (SQLite/MySQL), bcryptjs (cost 10 for OTP hashing), Node.js `crypto.randomInt`, nodemailer via existing `sendTransactionalEmail` helper, `jose` for JWTs, Tailwind CSS, Framer Motion, Lucide icons.

---

## File Structure

**New files:**
- `app/api/auth/2fa/verify/route.ts` — Verify OTP during login; issue full `auth_token`
- `app/api/auth/2fa/clear/route.ts` — Clear `pending_token`, redirect to login
- `app/api/auth/2fa/enable/route.ts` — Generate + email OTP for settings flow
- `app/api/auth/2fa/confirm/route.ts` — Verify OTP in settings; set `totpEnabled`
- `app/admin/login/verify/page.tsx` — OTP entry page (standalone, matches login style)
- `components/admin/TwoFactorCard.tsx` — Client component: enable/disable 2FA from settings

**Modified files:**
- `prisma/schema.prisma` — Add 4 OTP fields to User
- `lib/jwt.ts` — Add `signPendingJwt` / `verifyPendingJwt`
- `middleware.ts` — Allow all `/admin/login/*` paths; redirect to dashboard if `auth_token` valid on those paths
- `app/api/auth/login/route.ts` — Detect `totpEnabled`, generate OTP, set `pending_token`, return `{ requires2fa: true }`
- `app/admin/settings/page.tsx` — Add `TwoFactorCard` with `initialEnabled` and `userEmail` props

---

## Chunk 1: Foundation — Schema, JWT Helpers, Middleware

### Task 1: Schema migration — add OTP fields to User

**Files:**
- Modify: `prisma/schema.prisma` (User model, after `passwordChangedAt`)
- Creates: `prisma/migrations/…/migration.sql` (auto-generated)

- [ ] **Step 1: Add 4 fields to User model**

Open `prisma/schema.prisma`. After `passwordChangedAt DateTime?` (line 24), add:

```prisma
  totpEnabled        Boolean   @default(false)
  pendingOtpHash     String?
  pendingOtpExpiry   DateTime?
  pendingOtpAttempts Int       @default(0)
```

- [ ] **Step 2: Run migration**

```bash
npx prisma migrate dev --name add_2fa_otp_fields
```

Expected: migration file created, `prisma generate` runs automatically, no errors.

- [ ] **Step 3: Verify schema compiles**

```bash
npx prisma validate
```

Expected: `The schema at prisma/schema.prisma is valid!`

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add 2FA OTP fields to User schema"
```

---

### Task 2: JWT helpers — pending token sign/verify

**Files:**
- Modify: `lib/jwt.ts`

The current `signJwt` always issues a 7-day `auth_token`. We need a separate helper that issues a 10-minute pending token with `mfaPending: true`.

- [ ] **Step 1: Add `signPendingJwt` and `verifyPendingJwt` to `lib/jwt.ts`**

Read `lib/jwt.ts` first. Then append after the existing `verifyJwt` function:

```typescript
export async function signPendingJwt(userId: string): Promise<string> {
  return new SignJWT({ mfaPending: true, sub: userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('10m')
    .sign(secret)
}

export async function verifyPendingJwt(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret)
    if (!payload.mfaPending || !payload.sub) return null
    return payload
  } catch {
    return null
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors in `lib/jwt.ts`.

- [ ] **Step 3: Commit**

```bash
git add lib/jwt.ts
git commit -m "feat: add signPendingJwt / verifyPendingJwt for 2FA flow"
```

---

### Task 3: Update middleware — allow login flow paths; redirect if already authed

**Files:**
- Modify: `middleware.ts`

Current code allows `/admin/login` exactly but blocks `/admin/login/forgot-password`, `/admin/login/reset-password`, and the new `/admin/login/verify`. Fix this by allowing all `/admin/login/*` paths, and redirect to `/admin/dashboard` when a fully-authed user visits any of them.

- [ ] **Step 1: Read current `middleware.ts`**

Read it so you know the exact lines to change.

- [ ] **Step 2: Replace the early-return guard**

Find this line:
```typescript
if (!isProtected || pathname === '/admin/login') return NextResponse.next()
```

Replace with:
```typescript
const isLoginFlow = pathname === '/admin/login' || pathname.startsWith('/admin/login/')

if (!isProtected || isLoginFlow) {
  // Redirect already-authenticated users away from login pages
  if (isLoginFlow) {
    const authToken = request.cookies.get('auth_token')?.value
    if (authToken) {
      const payload = await verifyJwt(authToken)
      if (payload) {
        const url = request.nextUrl.clone()
        url.pathname = '/admin/dashboard'
        return NextResponse.redirect(url)
      }
    }
  }
  return NextResponse.next()
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add middleware.ts
git commit -m "feat: allow all login-flow paths in middleware; redirect to dashboard if authed"
```

---

## Chunk 2: Login Flow — Two-Phase JWT + Verify Page

### Task 4: Modify login route — two-phase path for 2FA users

**Files:**
- Modify: `app/api/auth/login/route.ts`

When `user.totpEnabled` is true: generate OTP, hash it, write to DB, email it, set `pending_token` cookie, return `{ requires2fa: true }`. Normal path (2FA off) is unchanged.

- [ ] **Step 1: Read `app/api/auth/login/route.ts`**

Read the file.

- [ ] **Step 2: Add imports**

At the top of the file, add these imports (after the existing ones):

```typescript
import bcrypt from 'bcryptjs'
import { randomInt } from 'crypto'
import { signPendingJwt } from '@/lib/jwt'
import { sendTransactionalEmail } from '@/lib/communications/email-service'
```

- [ ] **Step 3: Modify the POST handler**

After `const valid = await verifyPassword(password, user.passwordHash)` and the invalid-check, and before `const token = await createSession(user.id)`, insert the 2FA branch:

```typescript
// 2FA path
if (user.totpEnabled) {
  const otp = String(randomInt(100000, 1000000))
  const otpHash = await bcrypt.hash(otp, 10)
  const expiry = new Date(Date.now() + 10 * 60 * 1000)

  await prisma.user.update({
    where: { id: user.id },
    data: { pendingOtpHash: otpHash, pendingOtpExpiry: expiry, pendingOtpAttempts: 0 },
  })

  try {
    await sendTransactionalEmail({
      to: user.email,
      subject: 'Your login verification code',
      html: `<p>Your verification code is: <strong style="font-size:1.5em;letter-spacing:0.15em">${otp}</strong></p><p>This code expires in 10 minutes.</p><p>If you did not attempt to log in, you can safely ignore this email.</p>`,
    })
  } catch (err) {
    console.error('[login/2fa] SMTP error:', err)
    return NextResponse.json({ error: 'Could not send verification email' }, { status: 500 })
  }

  const pendingToken = await signPendingJwt(user.id)
  const res = NextResponse.json({ requires2fa: true })
  res.cookies.set('pending_token', pendingToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 10,
    path: '/',
  })
  return res
}
```

The login route already queries the user with `prisma.user.findUnique`. You need to also select the new `totpEnabled` field. Change the findUnique call to:

```typescript
const user = await prisma.user.findUnique({
  where: { email },
  select: { id: true, name: true, email: true, role: true, passwordHash: true, totpEnabled: true },
})
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add app/api/auth/login/route.ts
git commit -m "feat: add two-phase 2FA branch to login route"
```

---

### Task 5: `POST /api/auth/2fa/verify` — verify OTP during login

**Files:**
- Create: `app/api/auth/2fa/verify/route.ts`

This route is called by the verify page. It reads `pending_token`, validates the OTP, and on success issues the full `auth_token`.

- [ ] **Step 1: Create `app/api/auth/2fa/verify/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { verifyPendingJwt, signJwt } from '@/lib/jwt'

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const { code } = body ?? {}

  // Validate format: must be exactly 6 numeric digits
  if (!code || !/^\d{6}$/.test(String(code))) {
    return NextResponse.json({ error: 'Invalid code format' }, { status: 400 })
  }

  // Read pending_token cookie
  const cookieStore = await cookies()
  const pendingToken = cookieStore.get('pending_token')?.value
  if (!pendingToken) {
    return NextResponse.json({ error: 'Session expired, please log in again' }, { status: 401 })
  }

  // Verify pending JWT — verifyPendingJwt uses a try/catch that returns null for ALL
  // jose errors including JWTExpired, JWSSignatureVerificationFailed, and JWTMalformed.
  // This means expired tokens, bad signatures, and malformed tokens all return null here,
  // covering spec steps 2 and 3 (lines 54-55) with the same 401 response.
  const payload = await verifyPendingJwt(pendingToken)
  if (!payload) {
    return NextResponse.json({ error: 'Session expired, please log in again' }, { status: 401 })
  }

  // Load user
  const user = await prisma.user.findUnique({
    where: { id: payload.sub as string },
    select: { id: true, pendingOtpHash: true, pendingOtpExpiry: true, pendingOtpAttempts: true },
  })
  if (!user) {
    return NextResponse.json({ error: 'Session expired, please log in again' }, { status: 401 })
  }

  // Check OTP expiry
  if (!user.pendingOtpExpiry || user.pendingOtpExpiry < new Date()) {
    await prisma.user.update({
      where: { id: user.id },
      data: { pendingOtpHash: null, pendingOtpExpiry: null, pendingOtpAttempts: 0 },
    })
    return NextResponse.json({ error: 'Code expired, please log in again' }, { status: 401 })
  }

  // Check attempt limit (pre-check: already locked out from prior attempts)
  if (user.pendingOtpAttempts >= 5) {
    await prisma.user.update({
      where: { id: user.id },
      data: { pendingOtpHash: null, pendingOtpExpiry: null, pendingOtpAttempts: 0 },
    })
    const res = NextResponse.json({ error: 'Too many attempts, please log in again' }, { status: 401 })
    res.cookies.set('pending_token', '', { maxAge: 0, path: '/' })
    return res
  }

  // Verify OTP
  const valid = user.pendingOtpHash ? await bcrypt.compare(String(code), user.pendingOtpHash) : false

  if (!valid) {
    const newAttempts = user.pendingOtpAttempts + 1
    if (newAttempts >= 5) {
      // 5th failure: lock out immediately
      await prisma.user.update({
        where: { id: user.id },
        data: { pendingOtpHash: null, pendingOtpExpiry: null, pendingOtpAttempts: 0 },
      })
      const res = NextResponse.json({ error: 'Too many attempts, please log in again' }, { status: 401 })
      res.cookies.set('pending_token', '', { maxAge: 0, path: '/' })
      return res
    }
    await prisma.user.update({ where: { id: user.id }, data: { pendingOtpAttempts: newAttempts } })
    return NextResponse.json({ error: 'Invalid code' }, { status: 401 })
  }

  // Success: clear pending fields, issue full session
  await prisma.user.update({
    where: { id: user.id },
    data: { pendingOtpHash: null, pendingOtpExpiry: null, pendingOtpAttempts: 0 },
  })

  const token = await signJwt({ sub: user.id })
  const response = NextResponse.json({ ok: true })
  response.cookies.set('auth_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  })
  response.cookies.set('pending_token', '', { maxAge: 0, path: '/' })
  return response
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/auth/2fa/verify/route.ts
git commit -m "feat: add POST /api/auth/2fa/verify — OTP verification for login"
```

---

### Task 6: `GET /api/auth/2fa/clear` — clear pending token

**Files:**
- Create: `app/api/auth/2fa/clear/route.ts`

The "Back to login" link on the verify page hits this route. It clears the `pending_token` cookie server-side (httpOnly cookies can't be cleared from JS) and redirects to login.

- [ ] **Step 1: Create `app/api/auth/2fa/clear/route.ts`**

```typescript
import { type NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const url = new URL('/admin/login', request.url)
  const response = NextResponse.redirect(url)
  response.cookies.set('pending_token', '', { maxAge: 0, path: '/', httpOnly: true, sameSite: 'lax' })
  return response
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add app/api/auth/2fa/clear/route.ts
git commit -m "feat: add GET /api/auth/2fa/clear — clear pending_token and redirect to login"
```

---

### Task 7: Verify page — `/admin/login/verify`

**Files:**
- Create: `app/admin/login/verify/page.tsx`

Standalone page (no DashboardLayout), matching the visual style of `/admin/login`. Shows a 6-digit OTP input. On expired/too-many-attempts errors, shows message then auto-redirects to login after 3 seconds.

- [ ] **Step 1: Create `app/admin/login/verify/page.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Input, Button } from '@/components/ui'
import { ShieldCheck } from 'lucide-react'

export default function VerifyPage() {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/2fa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      const data = await res.json()
      if (res.ok) {
        router.push('/admin/dashboard')
      } else {
        const msg = data.error ?? 'Verification failed'
        setError(msg)
        // Auto-redirect for fatal errors
        if (msg.includes('expired') || msg.includes('Too many')) {
          setTimeout(() => router.push('/admin/login'), 3000)
        }
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-charcoal-950 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        <div className="text-center mb-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-charcoal-800 mx-auto mb-4">
            <ShieldCheck size={20} className="text-gold-400" />
          </div>
          <h1 className="font-serif text-2xl font-bold text-white">Verify your identity</h1>
          <p className="text-charcoal-400 text-sm mt-1">Enter the 6-digit code sent to your email</p>
        </div>

        <div className="rounded-2xl bg-charcoal-900 border border-charcoal-700 p-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              label="Verification code"
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="bg-charcoal-800 border-charcoal-600 text-white text-center text-xl tracking-widest"
            />
            {error && <p className="text-sm text-red-400">{error}</p>}
            <Button type="submit" variant="gold" size="lg" loading={loading} fullWidth>
              Verify
            </Button>
          </form>
        </div>

        <p className="text-center mt-4 text-sm">
          <a
            href="/api/auth/2fa/clear"
            className="text-charcoal-500 hover:text-charcoal-300 transition-colors"
          >
            ← Back to login
          </a>
        </p>
      </motion.div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add app/admin/login/verify/page.tsx
git commit -m "feat: add /admin/login/verify OTP entry page"
```

---

## Chunk 3: Settings Flow — Enable/Disable 2FA

### Task 8: `POST /api/auth/2fa/enable` — generate OTP for settings flow

**Files:**
- Create: `app/api/auth/2fa/enable/route.ts`

Requires full `auth_token` session. Accepts `{ action: 'enable' | 'disable' }`. Generates OTP, writes to DB, sends email. Returns `{ sent: true }`. No `pending_token` cookie — the full session is already present.

- [ ] **Step 1: Create `app/api/auth/2fa/enable/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { randomInt } from 'crypto'
import { sendTransactionalEmail } from '@/lib/communications/email-service'

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const { action } = body ?? {}

  if (action !== 'enable' && action !== 'disable') {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { totpEnabled: true, email: true },
  })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  if (action === 'enable' && user.totpEnabled) {
    return NextResponse.json({ error: '2FA is already enabled' }, { status: 400 })
  }
  if (action === 'disable' && !user.totpEnabled) {
    return NextResponse.json({ error: '2FA is already disabled' }, { status: 400 })
  }

  const otp = String(randomInt(100000, 1000000))
  const otpHash = await bcrypt.hash(otp, 10)
  const expiry = new Date(Date.now() + 10 * 60 * 1000)

  // Send email BEFORE writing to DB — spec says "returns 500 without updating DB" on SMTP failure
  try {
    await sendTransactionalEmail({
      to: user.email,
      subject: `Confirm ${action === 'enable' ? 'enabling' : 'disabling'} two-factor authentication`,
      html: `<p>Your verification code is: <strong style="font-size:1.5em;letter-spacing:0.15em">${otp}</strong></p><p>This code expires in 10 minutes.</p><p>If you did not request this, you can safely ignore this email.</p>`,
    })
  } catch (err) {
    console.error('[2fa/enable] SMTP error:', err)
    return NextResponse.json({ error: 'Could not send verification email' }, { status: 500 })
  }

  // Email succeeded — now persist the OTP
  await prisma.user.update({
    where: { id: session.id },
    data: { pendingOtpHash: otpHash, pendingOtpExpiry: expiry, pendingOtpAttempts: 0 },
  })

  return NextResponse.json({ sent: true })
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add app/api/auth/2fa/enable/route.ts
git commit -m "feat: add POST /api/auth/2fa/enable — send OTP for 2FA settings flow"
```

---

### Task 9: `POST /api/auth/2fa/confirm` — verify OTP, update totpEnabled

**Files:**
- Create: `app/api/auth/2fa/confirm/route.ts`

Requires full session. Accepts `{ code, action }`. Uses same attempt-tracking logic as the login verify route (minus the `pending_token` JWT handling). On success, sets `totpEnabled` and clears pending OTP fields.

- [ ] **Step 1: Create `app/api/auth/2fa/confirm/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const { code, action } = body ?? {}

  if (!code || !/^\d{6}$/.test(String(code))) {
    return NextResponse.json({ error: 'Invalid code format' }, { status: 400 })
  }
  if (action !== 'enable' && action !== 'disable') {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { totpEnabled: true, pendingOtpHash: true, pendingOtpExpiry: true, pendingOtpAttempts: true },
  })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  // Re-validate action against current state
  if (action === 'enable' && user.totpEnabled) {
    return NextResponse.json({ error: '2FA is already enabled' }, { status: 400 })
  }
  if (action === 'disable' && !user.totpEnabled) {
    return NextResponse.json({ error: '2FA is already disabled' }, { status: 400 })
  }

  // Check OTP expiry
  if (!user.pendingOtpExpiry || user.pendingOtpExpiry < new Date()) {
    await prisma.user.update({
      where: { id: session.id },
      data: { pendingOtpHash: null, pendingOtpExpiry: null, pendingOtpAttempts: 0 },
    })
    return NextResponse.json({ error: 'Code expired, please try again' }, { status: 401 })
  }

  // Pre-check: already locked out
  if (user.pendingOtpAttempts >= 5) {
    await prisma.user.update({
      where: { id: session.id },
      data: { pendingOtpHash: null, pendingOtpExpiry: null, pendingOtpAttempts: 0 },
    })
    return NextResponse.json({ error: 'Too many attempts, please try again' }, { status: 401 })
  }

  const valid = user.pendingOtpHash ? await bcrypt.compare(String(code), user.pendingOtpHash) : false

  if (!valid) {
    const newAttempts = user.pendingOtpAttempts + 1
    if (newAttempts >= 5) {
      await prisma.user.update({
        where: { id: session.id },
        data: { pendingOtpHash: null, pendingOtpExpiry: null, pendingOtpAttempts: 0 },
      })
      return NextResponse.json({ error: 'Too many attempts, please try again' }, { status: 401 })
    }
    await prisma.user.update({ where: { id: session.id }, data: { pendingOtpAttempts: newAttempts } })
    return NextResponse.json({ error: 'Invalid code' }, { status: 401 })
  }

  // Success: toggle totpEnabled and clear pending fields
  const newTotpEnabled = action === 'enable'
  await prisma.user.update({
    where: { id: session.id },
    data: {
      totpEnabled: newTotpEnabled,
      pendingOtpHash: null,
      pendingOtpExpiry: null,
      pendingOtpAttempts: 0,
    },
  })

  return NextResponse.json({ ok: true, totpEnabled: newTotpEnabled })
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add app/api/auth/2fa/confirm/route.ts
git commit -m "feat: add POST /api/auth/2fa/confirm — verify OTP and toggle totpEnabled"
```

---

### Task 10: TwoFactorCard settings component

**Files:**
- Create: `components/admin/TwoFactorCard.tsx`

Client component with two internal stages: `idle` (shows main action button) and `verifying` (shows OTP input). Drives the enable/disable flow entirely in-component.

- [ ] **Step 1: Create `components/admin/TwoFactorCard.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { Card } from '@/components/layout'
import { Button, Input } from '@/components/ui'
import { ShieldCheck } from 'lucide-react'

interface TwoFactorCardProps {
  initialEnabled: boolean
  userEmail: string
}

export function TwoFactorCard({ initialEnabled, userEmail }: TwoFactorCardProps) {
  const [enabled, setEnabled] = useState(initialEnabled)
  const [stage, setStage] = useState<'idle' | 'verifying'>('idle')
  const [pendingAction, setPendingAction] = useState<'enable' | 'disable' | null>(null)
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const startFlow = async (action: 'enable' | 'disable') => {
    setError('')
    setSuccess('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/2fa/enable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed to send verification code')
        return
      }
      setPendingAction(action)
      setStage('verifying')
      setCode('')
    } finally {
      setLoading(false)
    }
  }

  const confirmCode = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pendingAction) return
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/2fa/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, action: pendingAction }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Verification failed')
        return
      }
      setEnabled(data.totpEnabled)
      setStage('idle')
      setPendingAction(null)
      setCode('')
      setSuccess(
        data.totpEnabled
          ? 'Two-factor authentication enabled.'
          : 'Two-factor authentication disabled.'
      )
    } finally {
      setLoading(false)
    }
  }

  const cancel = () => {
    setStage('idle')
    setPendingAction(null)
    setCode('')
    setError('')
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-charcoal-900">Two-Factor Authentication</h3>
        {enabled && (
          <span className="flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-2 py-1 rounded-full">
            <ShieldCheck size={12} /> Active
          </span>
        )}
      </div>

      {stage === 'idle' && (
        <>
          {enabled ? (
            <p className="text-sm text-charcoal-500 mb-4">
              Verification codes are sent to <strong>{userEmail}</strong>.
            </p>
          ) : (
            <p className="text-sm text-charcoal-500 mb-4">
              Require an email verification code on each login for extra security. Codes are sent to{' '}
              <strong>{userEmail}</strong>.
            </p>
          )}
          {success && <p className="text-sm text-green-600 mb-3">{success}</p>}
          {error && <p className="text-sm text-red-500 mb-3">{error}</p>}
          {enabled ? (
            <Button variant="outline" onClick={() => startFlow('disable')} loading={loading}>
              Disable Two-Factor Authentication
            </Button>
          ) : (
            <Button variant="primary" onClick={() => startFlow('enable')} loading={loading}>
              Enable Two-Factor Authentication
            </Button>
          )}
        </>
      )}

      {stage === 'verifying' && (
        <form onSubmit={confirmCode} className="flex flex-col gap-4">
          <p className="text-sm text-charcoal-500">
            Enter the 6-digit code sent to <strong>{userEmail}</strong>.
          </p>
          <Input
            label="Verification code"
            type="text"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            required
            value={code}
            onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          />
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex gap-3">
            <Button type="submit" variant="primary" loading={loading}>
              Verify
            </Button>
            <Button type="button" variant="ghost" onClick={cancel} disabled={loading}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </Card>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add components/admin/TwoFactorCard.tsx
git commit -m "feat: add TwoFactorCard settings component for 2FA enable/disable"
```

---

### Task 11: Wire TwoFactorCard into settings page

**Files:**
- Modify: `app/admin/settings/page.tsx`

Add `totpEnabled` query and render `TwoFactorCard` below `ChangePasswordCard`.

- [ ] **Step 1: Read `app/admin/settings/page.tsx`**

Read the current file.

- [ ] **Step 2: Add import**

Add to imports at the top:
```typescript
import { TwoFactorCard } from '@/components/admin/TwoFactorCard'
```

- [ ] **Step 3: Add totpEnabled query to Promise.all**

The settings page already has a `Promise.all`. Add a 5th query to fetch the user's `totpEnabled`:

```typescript
const [lastSync, apiKeyCount, commandLogCount, queueStats, tfaUser] = await Promise.all([
  prisma.idxUpdate.findFirst({ orderBy: { syncedAt: 'desc' } }),
  prisma.apiKey.count({ where: { userId: session.id } }),
  prisma.aiCommandLog.count(),
  prisma.jobQueue.groupBy({ by: ['status'], _count: { id: true } }),
  prisma.user.findUnique({ where: { id: session.id }, select: { totpEnabled: true } }),
])

const totpEnabled = tfaUser?.totpEnabled ?? false
```

- [ ] **Step 4: Add TwoFactorCard below ChangePasswordCard**

In the JSX, after `<ChangePasswordCard />`, add:
```tsx
<TwoFactorCard initialEnabled={totpEnabled} userEmail={session.email} />
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Run a production build to confirm no errors**

```bash
npm run build
```

Expected: exit code 0, all pages generated, no TypeScript errors.

- [ ] **Step 7: Commit**

```bash
git add app/admin/settings/page.tsx
git commit -m "feat: add TwoFactorCard to settings page"
```

---

## Implementation Complete

After Task 11, all 2FA features are implemented. Run the full build one final time:

```bash
npm run build
```

Then use superpowers:finishing-a-development-branch to push.
