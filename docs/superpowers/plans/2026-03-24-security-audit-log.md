# Security Audit Log Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add persistent logging of all authentication events with a filterable, paginated admin UI at `/admin/security`.

**Architecture:** A `SecurityAuditLog` Prisma table stores events written by a fire-and-forget `logAuditEvent()` helper called from each auth route. A paginated admin API serves filtered results with 90-day auto-pruning, and a React page renders them with filters, colour-coded badges, and an inline meta expander.

**Tech Stack:** Next.js 15, Prisma 5 (MySQL/SQLite), TypeScript, jose (JWT decode), Tailwind CSS, Lucide React icons

---

## File Map

### New files
| File | Responsibility |
|---|---|
| `lib/audit.ts` | `logAuditEvent()` helper, `AUDIT_EVENTS` constant, IP/UA extractors |
| `app/api/admin/security-audit/route.ts` | Admin-only GET — filters, pagination, 90-day prune |
| `app/admin/security/page.tsx` | Admin page — fetches data, composes filters + table |
| `components/admin/security/SecurityAuditFilters.tsx` | Filter bar (event checkboxes, date pickers, actor, IP) |
| `components/admin/security/SecurityAuditTable.tsx` | Paginated audit log table with inline meta expander |

### Modified files
| File | Change |
|---|---|
| `prisma/schema.prisma` | Add `SecurityAuditLog` model; add `securityAuditLogs` relation on `User` and `Contact` |
| `app/api/auth/login/route.ts` | Log `login_success`, `login_failure`, `2fa_sent` |
| `app/api/auth/logout/route.ts` | Add `request: Request` param; decode cookie; log `logout` |
| `app/api/auth/2fa/verify/route.ts` | Add `email` to user select; log `2fa_success`, `2fa_failure` |
| `app/api/auth/forgot-password/route.ts` | Log `password_reset_request` |
| `app/api/auth/reset-password/route.ts` | Log `password_reset_complete` |
| `app/api/auth/change-password/route.ts` | Log `password_change` |
| `app/api/portal/login/route.ts` | Split combined null-check; log `portal_login_success`, `portal_login_failure` |
| `app/api/portal/logout/route.ts` | Add `request: Request` param; decode cookie; log `portal_logout` |
| `components/navigation/Sidebar.tsx` | Add "Security" nav item with Shield icon |

---

## Chunk 1: Data Model + Helper

### Task 1: Prisma schema — add SecurityAuditLog model

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add reverse relation to User model**

In `prisma/schema.prisma`, inside the `User` model, add after the `savedSearches SavedSearch[]` line:

```prisma
securityAuditLogs SecurityAuditLog[]
```

- [ ] **Step 2: Add reverse relation to Contact model**

Inside the `Contact` model, add after the `savedListings ContactSavedListing[]` line:

```prisma
securityAuditLogs SecurityAuditLog[]
```

- [ ] **Step 3: Add SecurityAuditLog model at end of schema.prisma**

Append after the closing `}` of the `Community` model:

```prisma
// ─── Security Audit ────────────────────────────────────────────────────────

model SecurityAuditLog {
  id        String   @id @default(cuid())
  createdAt DateTime @default(now())

  event     String   // login_success | login_failure | logout | 2fa_sent | 2fa_success | 2fa_failure | password_reset_request | password_reset_complete | password_change | portal_login_success | portal_login_failure | portal_logout
  actor     String?  // email address attempted (may not resolve to a real user)
  userId    String?  // FK to User if resolved; null for unknown-email failures
  contactId String?  // FK to Contact for portal events
  ip        String?
  userAgent String?
  meta      String?  // JSON blob for extra context (e.g. failure reason)

  user      User?    @relation(fields: [userId], references: [id], onDelete: SetNull)
  contact   Contact? @relation(fields: [contactId], references: [id], onDelete: SetNull)

  @@index([createdAt])
  @@index([userId])
  @@index([contactId])
  @@index([ip])
  @@index([actor])
  @@map("security_audit_log")
}
```

- [ ] **Step 4: Generate and apply the migration**

```bash
npx prisma migrate dev --name add_security_audit_log
```

Expected: `Your database is now in sync with your schema.` and a new file in `prisma/migrations/`.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add SecurityAuditLog schema migration"
```

---

### Task 2: Create lib/audit.ts helper

**Files:**
- Create: `lib/audit.ts`

- [ ] **Step 1: Create the file**

```typescript
import { prisma } from '@/lib/prisma'

export const AUDIT_EVENTS = [
  'login_success',
  'login_failure',
  'logout',
  '2fa_sent',
  '2fa_success',
  '2fa_failure',
  'password_reset_request',
  'password_reset_complete',
  'password_change',
  'portal_login_success',
  'portal_login_failure',
  'portal_logout',
] as const

export type AuditEvent = (typeof AUDIT_EVENTS)[number]

interface AuditEventParams {
  event: AuditEvent
  actor?: string
  userId?: string
  contactId?: string
  ip?: string
  userAgent?: string
  meta?: Record<string, unknown>
}

export function extractIp(request: Request): string | undefined {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    const first = forwarded.split(',')[0].trim()
    if (first) return first
  }
  return request.headers.get('x-real-ip') ?? undefined
}

export function extractUserAgent(request: Request): string | undefined {
  return request.headers.get('user-agent') ?? undefined
}

export async function logAuditEvent(params: AuditEventParams): Promise<void> {
  try {
    await prisma.securityAuditLog.create({
      data: {
        event: params.event,
        actor: params.actor ?? null,
        userId: params.userId ?? null,
        contactId: params.contactId ?? null,
        ip: params.ip ?? null,
        userAgent: params.userAgent ?? null,
        meta: params.meta ? JSON.stringify(params.meta) : null,
      },
    })
  } catch (err) {
    // Fire-and-forget: logging must never interrupt auth flows
    console.error('[audit] Failed to write audit log:', err)
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/audit.ts
git commit -m "feat: add logAuditEvent helper"
```

---

## Chunk 2: Auth Route Instrumentation

### Task 3: Instrument /api/auth/login

**Files:**
- Modify: `app/api/auth/login/route.ts`

- [ ] **Step 1: Replace the file with instrumented version**

```typescript
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { verifyPassword, createSession } from '@/lib/auth'
import bcrypt from 'bcryptjs'
import { randomInt } from 'crypto'
import { signPendingJwt } from '@/lib/jwt'
import { sendTransactionalEmail } from '@/lib/communications/email-service'
import { logAuditEvent, extractIp, extractUserAgent } from '@/lib/audit'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export async function POST(request: Request) {
  const ip = extractIp(request)
  const userAgent = extractUserAgent(request)

  try {
    const body = await request.json()
    const { email, password } = loginSchema.parse(body)

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      void logAuditEvent({ event: 'login_failure', actor: email, ip, userAgent, meta: { reason: 'unknown_email' } })
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    const valid = await verifyPassword(password, user.passwordHash)
    if (!valid) {
      void logAuditEvent({ event: 'login_failure', actor: email, userId: user.id, ip, userAgent, meta: { reason: 'invalid_password' } })
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    // 2FA path: if the user has TOTP enabled, send OTP instead of issuing full session
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
        // SMTP failure: do NOT log 2fa_sent (OTP was never delivered)
        return NextResponse.json({ error: 'Could not send verification email' }, { status: 500 })
      }

      // Log only after successful SMTP delivery
      void logAuditEvent({ event: '2fa_sent', actor: user.email, userId: user.id, ip, userAgent })

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

    // Non-2FA success
    const token = await createSession(user.id)
    void logAuditEvent({ event: 'login_success', actor: user.email, userId: user.id, ip, userAgent })

    const response = NextResponse.json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    })
    response.cookies.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
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

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Smoke test**

With dev server running (`npm run dev`):

```bash
# Should log login_failure with reason: unknown_email
curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"notexist@test.com","password":"wrong"}'
```

Open Prisma Studio (`npx prisma studio`) → SecurityAuditLog table — should see one row with `event=login_failure`, `meta={"reason":"unknown_email"}`.

- [ ] **Step 4: Commit**

```bash
git add app/api/auth/login/route.ts
git commit -m "feat: instrument login route with audit logging"
```

---

### Task 4: Instrument /api/auth/logout

**Files:**
- Modify: `app/api/auth/logout/route.ts`

- [ ] **Step 1: Replace the file with instrumented version**

```typescript
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { decodeJwt } from 'jose'
import { prisma } from '@/lib/prisma'
import { logAuditEvent, extractIp, extractUserAgent } from '@/lib/audit'

export async function POST(request: Request) {
  const ip = extractIp(request)
  const userAgent = extractUserAgent(request)

  let userId: string | undefined
  let actor: string | undefined

  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('auth_token')?.value
    if (token) {
      const payload = decodeJwt(token)
      const sub = payload.sub
      if (typeof sub === 'string' && sub.length > 0) {
        userId = sub
        const user = await prisma.user.findUnique({ where: { id: sub }, select: { email: true } })
        actor = user?.email ?? undefined
      }
    }
  } catch {
    // Best-effort — decoding failure must never block logout
  }

  void logAuditEvent({ event: 'logout', actor, userId, ip, userAgent })

  const response = NextResponse.json({ message: 'Logged out' })
  response.cookies.set('auth_token', '', { maxAge: 0, path: '/' })
  return response
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add app/api/auth/logout/route.ts
git commit -m "feat: instrument logout route with audit logging"
```

---

### Task 5: Instrument /api/auth/2fa/verify

**Files:**
- Modify: `app/api/auth/2fa/verify/route.ts`

- [ ] **Step 1: Replace the file with instrumented version**

Key changes: add `email` to the user select; add `logAuditEvent` to every failure and success branch; skip audit for format-invalid 400 early return.

```typescript
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { verifyPendingJwt, signJwt } from '@/lib/jwt'
import { logAuditEvent, extractIp, extractUserAgent } from '@/lib/audit'

export async function POST(request: Request) {
  const ip = extractIp(request)
  const userAgent = extractUserAgent(request)

  const body = await request.json().catch(() => ({}))
  const { code } = body ?? {}

  // Format check — no audit event for bad-format requests (Zod-style 400)
  if (!code || !/^\d{6}$/.test(String(code))) {
    return NextResponse.json({ error: 'Invalid code format' }, { status: 400 })
  }

  const cookieStore = await cookies()
  const pendingToken = cookieStore.get('pending_token')?.value
  if (!pendingToken) {
    return NextResponse.json({ error: 'Session expired, please log in again' }, { status: 401 })
  }

  const payload = await verifyPendingJwt(pendingToken)
  if (!payload) {
    return NextResponse.json({ error: 'Session expired, please log in again' }, { status: 401 })
  }

  // Include email so all branches can populate actor
  const user = await prisma.user.findUnique({
    where: { id: payload.sub as string },
    select: { id: true, email: true, pendingOtpHash: true, pendingOtpExpiry: true, pendingOtpAttempts: true },
  })
  if (!user) {
    return NextResponse.json({ error: 'Session expired, please log in again' }, { status: 401 })
  }

  // OTP expired
  if (!user.pendingOtpExpiry || user.pendingOtpExpiry < new Date()) {
    await prisma.user.update({
      where: { id: user.id },
      data: { pendingOtpHash: null, pendingOtpExpiry: null, pendingOtpAttempts: 0 },
    })
    void logAuditEvent({ event: '2fa_failure', actor: user.email, userId: user.id, ip, userAgent, meta: { reason: 'otp_expired' } })
    const res = NextResponse.json({ error: 'Code expired, please log in again' }, { status: 401 })
    res.cookies.set('pending_token', '', { maxAge: 0, path: '/' })
    return res
  }

  // Pre-check lockout (already at ≥5 attempts from prior requests)
  if (user.pendingOtpAttempts >= 5) {
    await prisma.user.update({
      where: { id: user.id },
      data: { pendingOtpHash: null, pendingOtpExpiry: null, pendingOtpAttempts: 0 },
    })
    void logAuditEvent({ event: '2fa_failure', actor: user.email, userId: user.id, ip, userAgent, meta: { reason: 'too_many_attempts' } })
    const res = NextResponse.json({ error: 'Too many attempts, please log in again' }, { status: 401 })
    res.cookies.set('pending_token', '', { maxAge: 0, path: '/' })
    return res
  }

  const valid = user.pendingOtpHash ? await bcrypt.compare(String(code), user.pendingOtpHash) : false

  if (!valid) {
    const newAttempts = user.pendingOtpAttempts + 1
    if (newAttempts >= 5) {
      // 5th failure — lock out immediately
      await prisma.user.update({
        where: { id: user.id },
        data: { pendingOtpHash: null, pendingOtpExpiry: null, pendingOtpAttempts: 0 },
      })
      void logAuditEvent({ event: '2fa_failure', actor: user.email, userId: user.id, ip, userAgent, meta: { reason: 'too_many_attempts' } })
      const res = NextResponse.json({ error: 'Too many attempts, please log in again' }, { status: 401 })
      res.cookies.set('pending_token', '', { maxAge: 0, path: '/' })
      return res
    }
    await prisma.user.update({ where: { id: user.id }, data: { pendingOtpAttempts: newAttempts } })
    void logAuditEvent({ event: '2fa_failure', actor: user.email, userId: user.id, ip, userAgent, meta: { reason: 'invalid_code' } })
    return NextResponse.json({ error: 'Invalid code' }, { status: 401 })
  }

  // Success — 2fa_success serves as the login-success signal for 2FA users
  await prisma.user.update({
    where: { id: user.id },
    data: { pendingOtpHash: null, pendingOtpExpiry: null, pendingOtpAttempts: 0 },
  })
  void logAuditEvent({ event: '2fa_success', actor: user.email, userId: user.id, ip, userAgent })

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

- [ ] **Step 3: Commit**

```bash
git add app/api/auth/2fa/verify/route.ts
git commit -m "feat: instrument 2fa/verify route with audit logging"
```

---

### Task 6: Instrument remaining admin auth routes

**Files:**
- Modify: `app/api/auth/forgot-password/route.ts`
- Modify: `app/api/auth/reset-password/route.ts`
- Modify: `app/api/auth/change-password/route.ts`

- [ ] **Step 1: Instrument forgot-password**

Add to imports:
```typescript
import { logAuditEvent, extractIp, extractUserAgent } from '@/lib/audit'
```

The route already returns `{ ok: true }` for unknown emails (no audit — never reveal whether email is registered). After the SMTP try/catch and before the final `return NextResponse.json({ ok: true })`, insert:

```typescript
void logAuditEvent({
  event: 'password_reset_request',
  actor: email,
  userId: user.id,
  ip: extractIp(request),
  userAgent: extractUserAgent(request),
})
```

- [ ] **Step 2: Instrument reset-password**

Add to imports:
```typescript
import { logAuditEvent, extractIp, extractUserAgent } from '@/lib/audit'
```

After the `prisma.user.update` that resets the password, before `return NextResponse.json({ ok: true })`:

```typescript
void logAuditEvent({
  event: 'password_reset_complete',
  actor: email,
  userId: user.id,
  ip: extractIp(request),
  userAgent: extractUserAgent(request),
})
```

- [ ] **Step 3: Instrument change-password**

Add to imports:
```typescript
import { logAuditEvent, extractIp, extractUserAgent } from '@/lib/audit'
```

After the `prisma.user.update` that hashes the new password, before setting the cookie in the response:

```typescript
void logAuditEvent({
  event: 'password_change',
  actor: user.email,  // user is already fetched earlier in this route
  userId: user.id,
  ip: extractIp(request),
  userAgent: extractUserAgent(request),
})
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add app/api/auth/forgot-password/route.ts app/api/auth/reset-password/route.ts app/api/auth/change-password/route.ts
git commit -m "feat: instrument password reset and change routes with audit logging"
```

---

### Task 7: Instrument portal auth routes

**Files:**
- Modify: `app/api/portal/login/route.ts`
- Modify: `app/api/portal/logout/route.ts`

- [ ] **Step 1: Replace portal/login with instrumented version**

Key change: split the combined `!contact || !contact.passwordHash` check into separate branches so distinct `meta.reason` values can be recorded.

```typescript
import { NextResponse } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { signContactJwt } from '@/lib/jwt'
import { logAuditEvent, extractIp, extractUserAgent } from '@/lib/audit'

const schema = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
})

export async function POST(request: Request) {
  const ip = extractIp(request)
  const userAgent = extractUserAgent(request)

  try {
    const body = await request.json()
    const { email, password } = schema.parse(body)

    const contact = await prisma.contact.findUnique({
      where:  { email },
      select: { id: true, firstName: true, passwordHash: true, accountStatus: true, email: true },
    })

    // Generic client error prevents account enumeration — audit log records specifics
    const INVALID = NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })

    if (!contact) {
      void logAuditEvent({ event: 'portal_login_failure', actor: email, ip, userAgent, meta: { reason: 'unknown_email' } })
      return INVALID
    }

    if (!contact.passwordHash) {
      void logAuditEvent({ event: 'portal_login_failure', actor: email, contactId: contact.id, ip, userAgent, meta: { reason: 'no_password_set' } })
      return INVALID
    }

    if (contact.accountStatus !== 'active') {
      void logAuditEvent({ event: 'portal_login_failure', actor: email, contactId: contact.id, ip, userAgent, meta: { reason: 'account_inactive' } })
      return INVALID
    }

    const valid = await bcrypt.compare(password, contact.passwordHash)
    if (!valid) {
      void logAuditEvent({ event: 'portal_login_failure', actor: email, contactId: contact.id, ip, userAgent, meta: { reason: 'invalid_password' } })
      return INVALID
    }

    void logAuditEvent({ event: 'portal_login_success', actor: email, contactId: contact.id, ip, userAgent })

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

- [ ] **Step 2: Replace portal/logout with instrumented version**

```typescript
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { decodeJwt } from 'jose'
import { prisma } from '@/lib/prisma'
import { logAuditEvent, extractIp, extractUserAgent } from '@/lib/audit'

export async function POST(request: Request) {
  const ip = extractIp(request)
  const userAgent = extractUserAgent(request)

  let contactId: string | undefined
  let actor: string | undefined

  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('contact_token')?.value
    if (token) {
      const payload = decodeJwt(token)
      const sub = payload.sub
      if (typeof sub === 'string' && sub.length > 0) {
        contactId = sub
        const contact = await prisma.contact.findUnique({ where: { id: sub }, select: { email: true } })
        actor = contact?.email ?? undefined
      }
    }
  } catch {
    // Best-effort — decoding failure must never block logout
  }

  void logAuditEvent({ event: 'portal_logout', actor, contactId, ip, userAgent })

  const response = NextResponse.json({ message: 'Logged out' })
  response.cookies.set('contact_token', '', { httpOnly: true, maxAge: 0, path: '/' })
  return response
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add app/api/portal/login/route.ts app/api/portal/logout/route.ts
git commit -m "feat: instrument portal auth routes with audit logging"
```

---

## Chunk 3: Admin API + UI

### Task 8: Create admin API route GET /api/admin/security-audit

**Files:**
- Create: `app/api/admin/security-audit/route.ts`

- [ ] **Step 1: Create the route**

```typescript
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { AUDIT_EVENTS } from '@/lib/audit'

const PRUNE_KEY = 'security_audit_last_pruned'
const PRUNE_DAYS = 90
const PRUNE_THROTTLE_MS = 60 * 60 * 1000 // 1 hour

async function maybePrune(): Promise<void> {
  try {
    const setting = await prisma.siteSettings.findUnique({ where: { key: PRUNE_KEY } })
    if (setting) {
      const lastPruned = new Date(setting.value)
      if (!isNaN(lastPruned.getTime()) && Date.now() - lastPruned.getTime() < PRUNE_THROTTLE_MS) {
        return // Pruned recently — skip
      }
    }
    // Row absent or stale — run prune
    const cutoff = new Date(Date.now() - PRUNE_DAYS * 24 * 60 * 60 * 1000)
    await prisma.securityAuditLog.deleteMany({ where: { createdAt: { lt: cutoff } } })
    await prisma.siteSettings.upsert({
      where:  { key: PRUNE_KEY },
      update: { value: new Date().toISOString() },
      create: { key: PRUNE_KEY, value: new Date().toISOString() },
    })
  } catch (err) {
    console.error('[security-audit] Prune failed:', err)
    // Do not rethrow — query proceeds regardless; timestamp not upserted so next request retries
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function parseDate(value: string, endOfDay = false): Date | null {
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value)
  const d = new Date(dateOnly ? (endOfDay ? `${value}T23:59:59.999Z` : `${value}T00:00:00.000Z`) : value)
  return isNaN(d.getTime()) ? null : d
}

export async function GET(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)

  const page  = clamp(parseInt(searchParams.get('page')  ?? '1',  10) || 1,  1, Infinity)
  const limit = clamp(parseInt(searchParams.get('limit') ?? '50', 10) || 50, 1, 100)

  const fromParam = searchParams.get('from')
  const toParam   = searchParams.get('to')

  if (fromParam) {
    const d = parseDate(fromParam, false)
    if (!d) return NextResponse.json({ error: 'Invalid "from" date' }, { status: 400 })
  }
  if (toParam) {
    const d = parseDate(toParam, true)
    if (!d) return NextResponse.json({ error: 'Invalid "to" date' }, { status: 400 })
  }

  const from = fromParam ? parseDate(fromParam, false) : null
  const to   = toParam   ? parseDate(toParam,   true)  : null

  // Event filter — whitelist only, trim whitespace
  const eventParam  = searchParams.get('event')
  const validEvents = eventParam
    ? eventParam
        .split(',')
        .map(e => e.trim())
        .filter((e): e is typeof AUDIT_EVENTS[number] =>
          (AUDIT_EVENTS as readonly string[]).includes(e)
        )
    : []

  const actorParam = searchParams.get('actor') ?? undefined
  const ipParam    = searchParams.get('ip')    ?? undefined

  await maybePrune()

  const where = {
    ...(validEvents.length > 0 ? { event: { in: validEvents } } : {}),
    ...(actorParam ? { actor: { contains: actorParam } } : {}),
    ...(ipParam    ? { ip: ipParam } : {}),
    ...((from || to) ? {
      createdAt: {
        ...(from ? { gte: from } : {}),
        ...(to   ? { lte: to   } : {}),
      },
    } : {}),
  }

  const [total, rows] = await Promise.all([
    prisma.securityAuditLog.count({ where }),
    prisma.securityAuditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        user:    { select: { name: true } },
        contact: { select: { firstName: true, lastName: true } },
      },
    }),
  ])

  const data = rows.map(row => ({
    id:          row.id,
    createdAt:   row.createdAt,
    event:       row.event,
    actor:       row.actor,
    userId:      row.userId,
    userName:    row.user?.name ?? null,
    contactId:   row.contactId,
    contactName: row.contact ? `${row.contact.firstName} ${row.contact.lastName}` : null,
    ip:          row.ip,
    userAgent:   row.userAgent,
    meta: (() => {
      try { return row.meta ? JSON.parse(row.meta) : null }
      catch { return null }
    })(),
  }))

  return NextResponse.json({ total, page, limit, data })
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Smoke test**

With dev server running and an admin auth_token cookie in hand:

```bash
# Unauthenticated — should return 401
curl -s http://localhost:3000/api/admin/security-audit
# Expected: {"error":"Unauthorized"}

# Authenticated — should return paginated results
curl -s -b "auth_token=<your-token>" http://localhost:3000/api/admin/security-audit
# Expected: {"total":N,"page":1,"limit":50,"data":[...]}

# Invalid date — should return 400
curl -s -b "auth_token=<your-token>" "http://localhost:3000/api/admin/security-audit?from=garbage"
# Expected: {"error":"Invalid \"from\" date"}
```

- [ ] **Step 4: Commit**

```bash
git add app/api/admin/security-audit/route.ts
git commit -m "feat: add admin security-audit API route"
```

---

### Task 9: Create admin UI components

**Files:**
- Create: `components/admin/security/SecurityAuditFilters.tsx`
- Create: `components/admin/security/SecurityAuditTable.tsx`

- [ ] **Step 1: Create SecurityAuditFilters component**

Create `components/admin/security/SecurityAuditFilters.tsx`:

```tsx
'use client'

import { AUDIT_EVENTS } from '@/lib/audit'

export interface AuditFilters {
  events: string[]
  actor: string
  ip: string
  from: string
  to: string
}

interface Props {
  filters: AuditFilters
  onChange: (filters: AuditFilters) => void
}

const EVENT_LABELS: Record<string, string> = {
  login_success:            'Login Success',
  login_failure:            'Login Failure',
  logout:                   'Logout',
  '2fa_sent':               '2FA Sent',
  '2fa_success':            '2FA Success',
  '2fa_failure':            '2FA Failure',
  password_reset_request:   'Password Reset Request',
  password_reset_complete:  'Password Reset Complete',
  password_change:          'Password Change',
  portal_login_success:     'Portal Login Success',
  portal_login_failure:     'Portal Login Failure',
  portal_logout:            'Portal Logout',
}

export function SecurityAuditFilters({ filters, onChange }: Props) {
  function toggleEvent(event: string) {
    const next = filters.events.includes(event)
      ? filters.events.filter(e => e !== event)
      : [...filters.events, event]
    onChange({ ...filters, events: next })
  }

  const isDirty = filters.events.length > 0 || filters.actor.length > 0 || filters.ip.length > 0 || filters.from.length > 0 || filters.to.length > 0

  return (
    <div className="flex flex-wrap gap-3 mb-4">
      {/* Event type dropdown */}
      <div className="relative">
        <details className="group">
          <summary className="cursor-pointer px-3 py-2 border border-gray-300 rounded-md text-sm bg-white select-none">
            Events {filters.events.length > 0 ? `(${filters.events.length})` : '(All)'}
          </summary>
          <div className="absolute z-10 mt-1 bg-white border border-gray-200 rounded-md shadow-lg p-2 min-w-52">
            {AUDIT_EVENTS.map(event => (
              <label key={event} className="flex items-center gap-2 px-2 py-1 text-sm hover:bg-gray-50 cursor-pointer rounded">
                <input
                  type="checkbox"
                  checked={filters.events.includes(event)}
                  onChange={() => toggleEvent(event)}
                  className="rounded"
                />
                {EVENT_LABELS[event] ?? event}
              </label>
            ))}
          </div>
        </details>
      </div>

      {/* Date range */}
      <input
        type="date"
        value={filters.from}
        onChange={e => onChange({ ...filters, from: e.target.value })}
        className="px-3 py-2 border border-gray-300 rounded-md text-sm bg-white"
        aria-label="From date"
      />
      <input
        type="date"
        value={filters.to}
        onChange={e => onChange({ ...filters, to: e.target.value })}
        className="px-3 py-2 border border-gray-300 rounded-md text-sm bg-white"
        aria-label="To date"
      />

      {/* Actor */}
      <input
        type="text"
        value={filters.actor}
        onChange={e => onChange({ ...filters, actor: e.target.value })}
        placeholder="Actor email..."
        className="px-3 py-2 border border-gray-300 rounded-md text-sm bg-white w-48"
      />

      {/* IP */}
      <input
        type="text"
        value={filters.ip}
        onChange={e => onChange({ ...filters, ip: e.target.value })}
        placeholder="IP address..."
        className="px-3 py-2 border border-gray-300 rounded-md text-sm bg-white w-36"
      />

      {isDirty && (
        <button
          onClick={() => onChange({ events: [], actor: '', ip: '', from: '', to: '' })}
          className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700"
        >
          Clear filters
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create SecurityAuditTable component**

Create `components/admin/security/SecurityAuditTable.tsx`:

```tsx
'use client'

import { useState, Fragment } from 'react'
import Link from 'next/link'

export interface AuditRow {
  id: string
  createdAt: string
  event: string
  actor: string | null
  userId: string | null
  userName: string | null
  contactId: string | null
  contactName: string | null
  ip: string | null
  userAgent: string | null
  meta: Record<string, unknown> | null
}

interface Props {
  rows: AuditRow[]
  total: number
  page: number
  limit: number
  onPageChange: (page: number) => void
}

const EVENT_BADGE: Record<string, string> = {
  login_success:           'bg-green-100 text-green-800',
  '2fa_success':           'bg-green-100 text-green-800',
  portal_login_success:    'bg-green-100 text-green-800',
  '2fa_sent':              'bg-blue-100 text-blue-800',
  logout:                  'bg-gray-100 text-gray-700',
  portal_logout:           'bg-gray-100 text-gray-700',
  password_reset_request:  'bg-yellow-100 text-yellow-800',
  password_reset_complete: 'bg-yellow-100 text-yellow-800',
  password_change:         'bg-yellow-100 text-yellow-800',
}

function badgeClass(event: string): string {
  if (event.includes('failure')) return 'bg-red-100 text-red-800'
  return EVENT_BADGE[event] ?? 'bg-gray-100 text-gray-700'
}

function formatEvent(event: string): string {
  return event.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

export function SecurityAuditTable({ rows, total, page, limit, onPageChange }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const totalPages = Math.ceil(total / limit)

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  return (
    <div>
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Timestamp</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Event</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Actor</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Subject</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">IP Address</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">User-Agent</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  No audit events found
                </td>
              </tr>
            )}
            {rows.map(row => (
              <Fragment key={row.id}>
                <tr className="hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap text-gray-500 text-xs">
                    {new Date(row.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${badgeClass(row.event)}`}>
                      {formatEvent(row.event)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700 text-xs">{row.actor ?? '—'}</td>
                  <td className="px-4 py-3 text-xs">
                    {row.contactId && row.contactName ? (
                      <Link href={`/admin/contacts/${row.contactId}`} className="text-blue-600 hover:underline">
                        {row.contactName}
                      </Link>
                    ) : row.userName ? (
                      <span className="text-gray-700">{row.userName}</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{row.ip ?? '—'}</td>
                  <td className="px-4 py-3 text-xs text-gray-400 max-w-xs truncate" title={row.userAgent ?? ''}>
                    {row.userAgent ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    {row.meta && (
                      <button
                        onClick={() => toggleExpand(row.id)}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        {expanded.has(row.id) ? 'Hide' : 'Show'}
                      </button>
                    )}
                  </td>
                </tr>
                {expanded.has(row.id) && row.meta && (
                  <tr className="bg-gray-50">
                    <td colSpan={7} className="px-4 py-2">
                      <pre className="text-xs text-gray-600 bg-white border border-gray-200 rounded p-2 overflow-x-auto">
                        {JSON.stringify(row.meta, null, 2)}
                      </pre>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-gray-500">
          <span>Page {page} of {totalPages} ({total.toLocaleString()} total)</span>
          <div className="flex gap-2">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              className="px-3 py-1 border border-gray-300 rounded disabled:opacity-40 hover:bg-gray-50"
            >
              Previous
            </button>
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              className="px-3 py-1 border border-gray-300 rounded disabled:opacity-40 hover:bg-gray-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add components/admin/security/
git commit -m "feat: add SecurityAuditFilters and SecurityAuditTable components"
```

---

### Task 10: Create admin security page

**Files:**
- Create: `app/admin/security/page.tsx`

- [ ] **Step 1: Create the page**

```tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { SecurityAuditFilters, type AuditFilters } from '@/components/admin/security/SecurityAuditFilters'
import { SecurityAuditTable, type AuditRow } from '@/components/admin/security/SecurityAuditTable'

export default function SecurityAuditPage() {
  const [filters, setFilters] = useState<AuditFilters>({ events: [], actor: '', ip: '', from: '', to: '' })
  const [page, setPage] = useState(1)
  const [data, setData] = useState<{ rows: AuditRow[]; total: number }>({ rows: [], total: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async (f: AuditFilters, p: number) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ page: String(p), limit: '50' })
      if (f.events.length > 0) params.set('event', f.events.join(','))
      if (f.actor) params.set('actor', f.actor)
      if (f.ip)    params.set('ip', f.ip)
      if (f.from)  params.set('from', f.from)
      if (f.to)    params.set('to', f.to)

      const res = await fetch(`/api/admin/security-audit?${params}`)
      if (!res.ok) throw new Error('Failed to load audit log')
      const json = await res.json()
      setData({ rows: json.data, total: json.total })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchData(filters, page)
  }, [filters, page, fetchData])

  function handleFiltersChange(next: AuditFilters) {
    setFilters(next)
    setPage(1)
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Security Audit Log</h1>
        <p className="mt-1 text-sm text-gray-500">Authentication events from the last 90 days</p>
      </div>

      <SecurityAuditFilters filters={filters} onChange={handleFiltersChange} />

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="text-sm text-gray-500 py-8 text-center">Loading...</div>
      ) : (
        <SecurityAuditTable
          rows={data.rows}
          total={data.total}
          page={page}
          limit={50}
          onPageChange={setPage}
        />
      )}
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
git add app/admin/security/page.tsx
git commit -m "feat: add /admin/security page"
```

---

### Task 11: Add Security link to admin sidebar

**Files:**
- Modify: `components/navigation/Sidebar.tsx`

- [ ] **Step 1: Add Shield to the lucide-react import**

In `components/navigation/Sidebar.tsx`, find the lucide-react import line and add `Shield`:

```typescript
import { ..., Shield } from 'lucide-react'
```

- [ ] **Step 2: Add Security nav item**

In the `navItems` array, add after the Settings entry:

```typescript
{ label: 'Security', href: '/admin/security', icon: Shield },
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add components/navigation/Sidebar.tsx
git commit -m "feat: add Security link to admin sidebar"
```

---

## Final Verification

- [ ] **End-to-end smoke test**

1. Start dev server: `npm run dev`
2. Navigate to `/admin/login`, log in as admin
3. Check Prisma Studio (`npx prisma studio`) → SecurityAuditLog → should have `login_success` row
4. Log out → should have `logout` row with actor = your email
5. Attempt login with wrong password → `login_failure` with `reason: invalid_password`
6. Attempt login with unknown email → `login_failure` with `reason: unknown_email`
7. Navigate to `/admin/security` → table shows all events, Security link in sidebar
8. Filter by "Login Failure" → table narrows
9. Filter by actor email (partial) → narrows further
10. Set a date range → filters by date
11. Click "Show" on a failure row → meta expands inline with `{"reason":"..."}
12. Click "Hide" → collapses

- [ ] **Build check**

```bash
npm run build
```

Expected: successful production build with no errors.
