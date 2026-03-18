# Password Change & Forgot Password Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add change-password to admin settings and a forgot-password email reset flow to the login page.

**Architecture:** Three new User schema fields (`resetTokenHash`, `resetTokenExpiry`, `passwordChangedAt`) power both features. `getSession()` gains a `passwordChangedAt` iat-check to invalidate old sessions. A lightweight `sendTransactionalEmail` helper (no contactId needed) sends the reset email. Six new API routes + three new pages + one settings card complete the feature.

**Tech Stack:** Next.js App Router, Prisma ORM, bcryptjs, nodemailer (existing), Node crypto built-in, Tailwind CSS + project design tokens.

**Spec:** `docs/superpowers/specs/2026-03-17-password-change-reset-design.md`

---

## Chunk 1: Data Layer

### Task 1: Add fields to Prisma schema

**Files:**
- Modify: `prisma/schema.prisma` (User model)

- [ ] **Step 1: Add three fields to the User model**

Open `prisma/schema.prisma`. Find the `model User` block. Add these three lines after the `avatarUrl` field:

```prisma
  resetTokenHash    String?
  resetTokenExpiry  DateTime?
  passwordChangedAt DateTime?
```

- [ ] **Step 2: Run migration**

```bash
npx prisma migrate dev --name add_password_reset_fields
```

Expected: Migration created and applied. Prisma client regenerated.

- [ ] **Step 3: Verify schema compiles**

```bash
npx prisma validate
```

Expected: `The schema at prisma/schema.prisma is valid`

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add password reset fields to User schema"
```

---

### Task 2: Update getSession() to invalidate tokens predating a password change

**Files:**
- Modify: `lib/auth.ts`

- [ ] **Step 1: Update getSession() to check passwordChangedAt**

In `lib/auth.ts`, update the `getSession()` function. The `prisma.user.findUnique` select block currently selects `{ id, name, email, role, avatarUrl }`. Add `passwordChangedAt` to it, then add the iat check after the user lookup:

```typescript
export async function getSession() {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth_token')?.value
  if (!token) return null

  try {
    const payload = await verifyJwt(token)
    if (!payload?.sub) return null

    const user = await prisma.user.findUnique({
      where: { id: payload.sub as string },
      select: { id: true, name: true, email: true, role: true, avatarUrl: true, passwordChangedAt: true },
    })
    if (!user) return null

    // Invalidate tokens issued before the last password change
    if (user.passwordChangedAt && typeof payload.iat === 'number') {
      if (payload.iat < user.passwordChangedAt.getTime() / 1000) {
        return null
      }
    }

    return user
  } catch {
    return null
  }
}
```

- [ ] **Step 2: Verify the app still starts**

```bash
npm run dev
```

Navigate to `http://localhost:3000/admin/login` — should load without error. Log in — should reach `/admin/dashboard`.

- [ ] **Step 3: Commit**

```bash
git add lib/auth.ts
git commit -m "feat: invalidate JWT sessions predating password changes"
```

---

### Task 3: Add sendTransactionalEmail helper to email service

**Files:**
- Modify: `lib/communications/email-service.ts`

The existing `sendEmail()` requires a `contactId` and records to the DB. Password reset emails don't belong to a contact, so add a lightweight helper that sends directly via SMTP.

- [ ] **Step 1: Add the helper at the bottom of email-service.ts**

```typescript
/**
 * Send a transactional system email (no contact record needed).
 * Used for password reset, 2FA codes, etc.
 * Throws on SMTP failure — callers that need silent failure (e.g. forgot-password)
 * must catch the error themselves. This keeps the helper generic.
 */
export async function sendTransactionalEmail(opts: {
  to: string
  subject: string
  html: string
}): Promise<void> {
  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER ?? 'noreply@example.com'
  await sendViaSmtp({ to: opts.to, from, subject: opts.subject, html: opts.html })
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add lib/communications/email-service.ts
git commit -m "feat: add sendTransactionalEmail helper for system emails"
```

---

## Chunk 2: API Routes

### Task 4: Change password API route

**Files:**
- Create: `app/api/auth/change-password/route.ts`

- [ ] **Step 1: Create the route file**

```typescript
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { currentPassword?: string; newPassword?: string; confirmPassword?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { currentPassword, newPassword, confirmPassword } = body

  if (!currentPassword || !newPassword || !confirmPassword) {
    return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
  }
  if (newPassword.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
  }
  if (newPassword !== confirmPassword) {
    return NextResponse.json({ error: 'Passwords do not match' }, { status: 400 })
  }

  const user = await prisma.user.findUnique({ where: { id: session.id } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const valid = await bcrypt.compare(currentPassword, user.passwordHash)
  if (!valid) return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 })

  // bcrypt cost 12 — standard for passwords (cost 10 is used only for reset tokens whose
  // security comes from 256-bit entropy, not bcrypt difficulty)
  const newHash = await bcrypt.hash(newPassword, 12)
  await prisma.user.update({
    where: { id: session.id },
    data: { passwordHash: newHash, passwordChangedAt: new Date() },
  })

  // Clear the auth_token cookie in the response — the server-side passwordChangedAt check
  // would reject it anyway, but clearing it here avoids a confusing error-redirect loop
  // and gives the client a clean redirect target.
  const response = NextResponse.json({ ok: true })
  response.cookies.set('auth_token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  })
  return response
}
```

- [ ] **Step 2: Verify with curl (start dev server first)**

```bash
# Should fail — not authenticated
curl -s -X POST http://localhost:3000/api/auth/change-password \
  -H "Content-Type: application/json" \
  -d '{"currentPassword":"old","newPassword":"newpass123","confirmPassword":"newpass123"}'
```

Expected: `{"error":"Unauthorized"}`

- [ ] **Step 3: Commit**

```bash
git add app/api/auth/change-password/route.ts
git commit -m "feat: add change-password API route"
```

---

### Task 5: Forgot password API route

**Files:**
- Create: `app/api/auth/forgot-password/route.ts`

- [ ] **Step 1: Create the route file**

```typescript
import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { sendTransactionalEmail } from '@/lib/communications/email-service'

export async function POST(request: Request) {
  let body: { email?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { email } = body
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Valid email is required' }, { status: 400 })
  }

  const user = await prisma.user.findUnique({ where: { email } })

  // Always return ok — never reveal whether the email is registered
  if (!user) return NextResponse.json({ ok: true })

  const rawToken = randomBytes(32).toString('hex')
  const tokenHash = await bcrypt.hash(rawToken, 10)
  const expiry = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

  await prisma.user.update({
    where: { id: user.id },
    data: { resetTokenHash: tokenHash, resetTokenExpiry: expiry },
  })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const resetUrl = `${appUrl}/admin/login/reset-password?token=${rawToken}&email=${encodeURIComponent(email)}`

  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
      <h2>Password Reset Request</h2>
      <p>You requested a password reset for your admin account.</p>
      <p style="margin:24px 0">
        <a href="${resetUrl}" style="background:#b8860b;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block">
          Reset Password
        </a>
      </p>
      <p style="color:#666;font-size:14px">This link expires in 1 hour.</p>
      <p style="color:#666;font-size:14px">If you didn't request this, you can safely ignore this email.</p>
    </div>
  `

  try {
    await sendTransactionalEmail({ to: email, subject: 'Reset your password', html })
  } catch (err) {
    // Log but do not surface — would confirm email existence to caller
    console.error('[forgot-password] SMTP error:', err)
  }

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Verify with curl**

```bash
# Unknown email — should return ok silently
curl -s -X POST http://localhost:3000/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"unknown@example.com"}'
```

Expected: `{"ok":true}`

```bash
# Invalid email format — should return 400
curl -s -X POST http://localhost:3000/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"notanemail"}'
```

Expected: `{"error":"Valid email is required"}`

- [ ] **Step 3: Commit**

```bash
git add app/api/auth/forgot-password/route.ts
git commit -m "feat: add forgot-password API route with secure email reset"
```

---

### Task 6: Reset password validate API route

**Files:**
- Create: `app/api/auth/reset-password/validate/route.ts`

- [ ] **Step 1: Create the route file**

```typescript
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'

// Dummy hash used to equalise timing when no user is found (prevents timing oracle)
const DUMMY_HASH = '$2b$10$dummyhashfortimingequalisation00'

export async function POST(request: Request) {
  let body: { token?: string; email?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { token, email } = body
  if (!token || !email) {
    return NextResponse.json({ error: 'token and email are required' }, { status: 400 })
  }

  const user = await prisma.user.findUnique({ where: { email } })

  if (!user) {
    // Dummy compare to equalise response time — prevents user enumeration via timing
    await bcrypt.compare(token, DUMMY_HASH)
    return NextResponse.json({ valid: false })
  }

  if (!user.resetTokenExpiry || user.resetTokenExpiry < new Date()) {
    await prisma.user.update({
      where: { id: user.id },
      data: { resetTokenHash: null, resetTokenExpiry: null },
    })
    return NextResponse.json({ valid: false })
  }

  const match = await bcrypt.compare(token, user.resetTokenHash!)
  // Do NOT clear fields on mismatch — this endpoint is read-only
  return NextResponse.json({ valid: match })
}
```

- [ ] **Step 2: Verify with curl**

```bash
# Missing params — 400
curl -s -X POST http://localhost:3000/api/auth/reset-password/validate \
  -H "Content-Type: application/json" \
  -d '{}'
```

Expected: `{"error":"token and email are required"}`

```bash
# Unknown email — { valid: false }
curl -s -X POST http://localhost:3000/api/auth/reset-password/validate \
  -H "Content-Type: application/json" \
  -d '{"token":"abc","email":"nobody@example.com"}'
```

Expected: `{"valid":false}`

- [ ] **Step 3: Commit**

```bash
git add app/api/auth/reset-password/validate/route.ts
git commit -m "feat: add reset-password validate API route"
```

---

### Task 7: Reset password apply API route

**Files:**
- Create: `app/api/auth/reset-password/route.ts`

- [ ] **Step 1: Create the route file**

```typescript
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'

export async function POST(request: Request) {
  let body: { token?: string; email?: string; newPassword?: string; confirmPassword?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { token, email, newPassword, confirmPassword } = body

  if (!token || !email || !newPassword || !confirmPassword) {
    return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
  }
  if (newPassword.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
  }
  if (newPassword !== confirmPassword) {
    return NextResponse.json({ error: 'Passwords do not match' }, { status: 400 })
  }

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    return NextResponse.json({ error: 'Invalid or expired reset link' }, { status: 400 })
  }

  if (!user.resetTokenExpiry || user.resetTokenExpiry < new Date()) {
    await prisma.user.update({
      where: { id: user.id },
      data: { resetTokenHash: null, resetTokenExpiry: null },
    })
    return NextResponse.json({ error: 'Invalid or expired reset link' }, { status: 400 })
  }

  const match = await bcrypt.compare(token, user.resetTokenHash!)
  if (!match) {
    // Deliberately do NOT clear token on mismatch — prevents DoS of valid reset links
    return NextResponse.json({ error: 'Invalid or expired reset link' }, { status: 400 })
  }

  const newHash = await bcrypt.hash(newPassword, 12)
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: newHash,
      passwordChangedAt: new Date(),
      resetTokenHash: null,
      resetTokenExpiry: null,
    },
  })

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Verify with curl**

```bash
# Missing fields — 400
curl -s -X POST http://localhost:3000/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
```

Expected: `{"error":"All fields are required"}`

```bash
# Password too short — 400
curl -s -X POST http://localhost:3000/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{"token":"x","email":"test@example.com","newPassword":"short","confirmPassword":"short"}'
```

Expected: `{"error":"Password must be at least 8 characters"}`

- [ ] **Step 3: Commit**

```bash
git add app/api/auth/reset-password/route.ts
git commit -m "feat: add reset-password apply API route"
```

---

## Chunk 3: UI

### Task 8: Change Password settings card

**Files:**
- Create: `components/admin/ChangePasswordCard.tsx`
- Modify: `app/admin/settings/page.tsx`

- [ ] **Step 1: Create the ChangePasswordCard component**

```typescript
'use client'

import { useState } from 'react'
import { Card } from '@/components/layout'
import { Input, Button } from '@/components/ui'

export function ChangePasswordCard() {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess(false)

    if (form.newPassword !== form.confirmPassword) {
      setError('Passwords do not match')
      return
    }
    if (form.newPassword.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Something went wrong')
      } else {
        setSuccess(true)
        setForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
        // The API clears the auth_token cookie in the response, so the redirect
        // to login will be clean — no error loop from the stale session.
        setTimeout(() => { window.location.href = '/admin/login' }, 1500)
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <h3 className="font-semibold text-charcoal-900 mb-4">Change Password</h3>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Current password"
          type="password"
          required
          value={form.currentPassword}
          onChange={e => setForm(f => ({ ...f, currentPassword: e.target.value }))}
        />
        <Input
          label="New password"
          type="password"
          required
          value={form.newPassword}
          onChange={e => setForm(f => ({ ...f, newPassword: e.target.value }))}
        />
        <Input
          label="Confirm new password"
          type="password"
          required
          value={form.confirmPassword}
          onChange={e => setForm(f => ({ ...f, confirmPassword: e.target.value }))}
        />
        {error && <p className="text-sm text-red-500">{error}</p>}
        {success && <p className="text-sm text-green-600">Password changed. Redirecting to login…</p>}
        <Button type="submit" variant="primary" className="self-start" loading={loading}>
          Save Password
        </Button>
      </form>
    </Card>
  )
}
```

- [ ] **Step 2: Add ChangePasswordCard to settings page**

In `app/admin/settings/page.tsx`, add the import at the top:

```typescript
import { ChangePasswordCard } from '@/components/admin/ChangePasswordCard'
```

Then add the card after the Profile card's closing `</Card>` tag and `<Divider />`:

```tsx
<ChangePasswordCard />

<Divider />
```

(Place it between the Profile section and the IDX section.)

- [ ] **Step 3: Verify in browser**

Navigate to `http://localhost:3000/admin/settings`. You should see a "Change Password" card with three password fields. Try submitting with a wrong current password — should show "Current password is incorrect". Try with mismatched passwords — should show "Passwords do not match".

- [ ] **Step 4: Commit**

```bash
git add components/admin/ChangePasswordCard.tsx app/admin/settings/page.tsx
git commit -m "feat: add Change Password card to admin settings"
```

---

### Task 9: Forgot password page

**Files:**
- Create: `app/admin/login/forgot-password/page.tsx`

- [ ] **Step 1: Create the page**

```typescript
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Input, Button } from '@/components/ui'
import { Mail } from 'lucide-react'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
    } catch {
      // Silently swallow — we always show the same message
    } finally {
      setSubmitted(true)
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
            <Mail size={20} className="text-gold-400" />
          </div>
          <h1 className="font-serif text-2xl font-bold text-white">Reset Password</h1>
          <p className="text-charcoal-400 text-sm mt-1">
            {submitted ? '' : "Enter your email and we'll send you a reset link."}
          </p>
        </div>

        <div className="rounded-2xl bg-charcoal-900 border border-charcoal-700 p-6">
          {submitted ? (
            <div className="text-center">
              <p className="text-charcoal-300 text-sm leading-relaxed">
                If that email is registered, you&apos;ll receive a reset link shortly.
              </p>
              <p className="text-charcoal-500 text-xs mt-3">Check your spam folder if it doesn&apos;t arrive.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <Input
                label="Email"
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="bg-charcoal-800 border-charcoal-600 text-white placeholder:text-charcoal-500"
              />
              <Button type="submit" variant="gold" size="lg" loading={loading} fullWidth>
                Send Reset Link
              </Button>
            </form>
          )}
        </div>

        <p className="text-center mt-4 text-sm text-charcoal-500">
          <Link href="/admin/login" className="text-charcoal-400 hover:text-white transition-colors">
            ← Back to login
          </Link>
        </p>
      </motion.div>
    </div>
  )
}
```

- [ ] **Step 2: Verify in browser**

Navigate to `http://localhost:3000/admin/login/forgot-password`. Should render the form. Submit any email — should show the "If that email is registered…" message regardless. Back link should work.

- [ ] **Step 3: Commit**

```bash
git add app/admin/login/forgot-password/page.tsx
git commit -m "feat: add forgot-password page"
```

---

### Task 10: Reset password page

**Files:**
- Create: `app/admin/login/reset-password/page.tsx`

- [ ] **Step 1: Create the page**

```typescript
'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Input, Button } from '@/components/ui'
import { KeyRound } from 'lucide-react'

function ResetPasswordForm() {
  const router = useRouter()
  const params = useSearchParams()
  const token = params.get('token') ?? ''
  const email = params.get('email') ?? ''

  const [status, setStatus] = useState<'checking' | 'invalid' | 'ready' | 'success'>('checking')
  const [form, setForm] = useState({ newPassword: '', confirmPassword: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token || !email) { setStatus('invalid'); return }

    fetch('/api/auth/reset-password/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, email }),
    })
      .then(r => r.json())
      .then(data => setStatus(data.valid ? 'ready' : 'invalid'))
      .catch(() => setStatus('invalid'))
  }, [token, email])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (form.newPassword.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    if (form.newPassword !== form.confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, email, ...form }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Something went wrong')
      } else {
        setStatus('success')
        setTimeout(() => router.push('/admin/login?reset=1'), 1000)
      }
    } catch {
      setError('Network error. Please try again.')
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
            <KeyRound size={20} className="text-gold-400" />
          </div>
          <h1 className="font-serif text-2xl font-bold text-white">New Password</h1>
        </div>

        <div className="rounded-2xl bg-charcoal-900 border border-charcoal-700 p-6">
          {status === 'checking' && (
            <p className="text-charcoal-400 text-sm text-center">Verifying link…</p>
          )}
          {status === 'invalid' && (
            <div className="text-center">
              <p className="text-red-400 text-sm mb-4">This link is invalid or has expired.</p>
              <Link href="/admin/login/forgot-password" className="text-gold-400 hover:text-gold-300 text-sm">
                Request a new reset link
              </Link>
            </div>
          )}
          {(status === 'ready' || status === 'success') && (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <Input
                label="New password"
                type="password"
                required
                value={form.newPassword}
                onChange={e => setForm(f => ({ ...f, newPassword: e.target.value }))}
                className="bg-charcoal-800 border-charcoal-600 text-white"
              />
              <Input
                label="Confirm new password"
                type="password"
                required
                value={form.confirmPassword}
                onChange={e => setForm(f => ({ ...f, confirmPassword: e.target.value }))}
                className="bg-charcoal-800 border-charcoal-600 text-white"
              />
              {error && <p className="text-sm text-red-400">{error}</p>}
              {status === 'success' && <p className="text-sm text-green-400">Password reset! Redirecting…</p>}
              <Button type="submit" variant="gold" size="lg" loading={loading} fullWidth>
                Reset Password
              </Button>
            </form>
          )}
        </div>

        <p className="text-center mt-4 text-sm">
          <Link href="/admin/login" className="text-charcoal-400 hover:text-white transition-colors">
            ← Back to login
          </Link>
        </p>
      </motion.div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-charcoal-950" />}>
      <ResetPasswordForm />
    </Suspense>
  )
}
```

> **Why Suspense?** `useSearchParams()` in Next.js App Router requires the component to be wrapped in `<Suspense>` to avoid a build-time error. The outer `ResetPasswordPage` provides the boundary; `ResetPasswordForm` does the work.

- [ ] **Step 2: Verify in browser**

Navigate to `http://localhost:3000/admin/login/reset-password` (no params). Should show "This link is invalid or has expired." Navigate with `?token=fake&email=x@y.com` — should also show invalid after checking.

- [ ] **Step 3: Commit**

```bash
git add app/admin/login/reset-password/page.tsx
git commit -m "feat: add reset-password page"
```

---

### Task 11: Update login page — forgot link and reset banner

**Files:**
- Modify: `app/admin/login/page.tsx`

- [ ] **Step 1: Add useSearchParams and the reset banner + forgot link**

The login page needs three additions:
1. Import `useSearchParams` and `useEffect` (already has `useState`)
2. A `resetSuccess` state that reads `?reset=1` and immediately removes the param
3. A "Forgot your password?" link below the Sign In button

Update `app/admin/login/page.tsx`:

```typescript
'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { Input, Button } from '@/components/ui'
import { APP_NAME } from '@/lib/constants'
import { Lock } from 'lucide-react'
import Link from 'next/link'

function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const [form, setForm] = useState({ email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [resetSuccess, setResetSuccess] = useState(false)

  useEffect(() => {
    if (params.get('reset') === '1') {
      setResetSuccess(true)
      router.replace('/admin/login')
    }
  }, [params, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })

    if (res.ok) {
      const data = await res.json()
      if (data.requires2fa) {
        router.push('/admin/login/verify')
      } else {
        router.push('/admin/dashboard')
      }
    } else {
      const data = await res.json()
      setError(data.error ?? 'Login failed')
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
            <Lock size={20} className="text-gold-400" />
          </div>
          <h1 className="font-serif text-2xl font-bold text-white">{APP_NAME} CRM</h1>
          <p className="text-charcoal-400 text-sm mt-1">Sign in to your account</p>
        </div>

        {resetSuccess && (
          <div className="mb-4 rounded-xl bg-green-900/40 border border-green-700 px-4 py-3 text-sm text-green-300">
            Your password has been reset. Please sign in.
          </div>
        )}

        <div className="rounded-2xl bg-charcoal-900 border border-charcoal-700 p-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              label="Email"
              type="email"
              required
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              className="bg-charcoal-800 border-charcoal-600 text-white placeholder:text-charcoal-500"
            />
            <Input
              label="Password"
              type="password"
              required
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              className="bg-charcoal-800 border-charcoal-600 text-white"
            />
            {error && <p className="text-sm text-red-400">{error}</p>}
            <Button type="submit" variant="gold" size="lg" loading={loading} fullWidth>
              Sign In
            </Button>
          </form>
        </div>

        <p className="text-center mt-4 text-sm">
          <Link href="/admin/login/forgot-password" className="text-charcoal-500 hover:text-charcoal-300 transition-colors">
            Forgot your password?
          </Link>
        </p>
      </motion.div>
    </div>
  )
}

// Note: add `Suspense` to the existing react import at the top of the file
// i.e. change: import { useState, useEffect } from 'react'
//          to: import { useState, useEffect, Suspense } from 'react'

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-charcoal-950" />}>
      <LoginForm />
    </Suspense>
  )
}
```

> **Note:** The login page is refactored to wrap `LoginForm` in `<Suspense>` because `useSearchParams()` requires it. The outer `LoginPage` is the entry point.

- [ ] **Step 2: Verify in browser**

1. Navigate to `http://localhost:3000/admin/login` — should show the "Forgot your password?" link below the Sign In button
2. Navigate to `http://localhost:3000/admin/login?reset=1` — should show the green "Your password has been reset. Please sign in." banner, and the URL should change to `/admin/login` immediately

- [ ] **Step 3: Commit**

```bash
git add app/admin/login/page.tsx
git commit -m "feat: add forgot-password link and reset success banner to login page"
```

---

### Task 12: End-to-end smoke test

- [ ] **Step 1: Test the full forgot-password flow**

1. Make sure SMTP is configured in `.env` (or use a test email service like Mailtrap)
2. Navigate to `/admin/login` → click "Forgot your password?"
3. Enter your admin email → click "Send Reset Link"
4. Check inbox for the reset email — it should contain a "Reset Password" button linking to `/admin/login/reset-password?token=...&email=...`
5. Click the link → should show the password reset form
6. Enter a new password (8+ chars) → click "Reset Password"
7. Should redirect to `/admin/login?reset=1` with the success banner
8. Sign in with the new password — should work
9. Attempting to sign in with the old password — should fail

- [ ] **Step 2: Test session invalidation**

1. Log into admin, note you're on the dashboard
2. In a second tab, go to settings → Change Password → change the password
3. On success you're redirected to login
4. Go back to the first tab and try to navigate to any admin route
5. Should be redirected to login (session is invalid — `passwordChangedAt` check fails)

- [ ] **Step 3: Final commit and push**

```bash
git push origin main
```

---

## File Map Summary

| File | Status | Purpose |
|------|--------|---------|
| `prisma/schema.prisma` | Modified | Add 3 User fields |
| `lib/auth.ts` | Modified | Add passwordChangedAt iat check |
| `lib/communications/email-service.ts` | Modified | Add sendTransactionalEmail |
| `app/api/auth/change-password/route.ts` | Created | Change password API |
| `app/api/auth/forgot-password/route.ts` | Created | Send reset email |
| `app/api/auth/reset-password/validate/route.ts` | Created | Validate token (read-only) |
| `app/api/auth/reset-password/route.ts` | Created | Apply password reset |
| `components/admin/ChangePasswordCard.tsx` | Created | Settings UI card |
| `app/admin/settings/page.tsx` | Modified | Add ChangePasswordCard |
| `app/admin/login/page.tsx` | Modified | Add forgot link + reset banner |
| `app/admin/login/forgot-password/page.tsx` | Created | Forgot password page |
| `app/admin/login/reset-password/page.tsx` | Created | Reset password page |
