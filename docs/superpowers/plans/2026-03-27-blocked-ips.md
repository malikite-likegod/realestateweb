# Blocked IP CSV Upload Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Blocked IPs" tab to the admin security page that lets admins upload a CSV of malicious IPv4 addresses which are then blocked site-wide for 4 months via Next.js middleware.

**Architecture:** A new `BlockedIp` Prisma model stores blocked IPs. The middleware maintains a 5-minute in-process cache refreshed by fetching from a secret-protected internal API route (`/api/internal/blocked-ips`) — necessary because Next.js middleware runs in Edge Runtime and cannot use Prisma directly. All block/unblock actions are logged to the existing security audit log.

**Tech Stack:** Next.js 14, Prisma 5, PostgreSQL, TypeScript, Tailwind CSS, Lucide icons

**Spec:** `docs/superpowers/specs/2026-03-27-blocked-ips-design.md`

---

## Chunk 1: Foundation — Schema, Audit Events, IP Utilities

**Files:**
- Modify: `prisma/schema.prisma` — add `BlockedIp` model and update `SecurityAuditLog` event comment
- Modify: `lib/audit.ts` — add `ip_blocklist_upload` and `ip_blocklist_remove` to `AUDIT_EVENTS`
- Create: `lib/ip-utils.ts` — normalize and validate IPv4 addresses
- Modify: `.env.example` — document `INTERNAL_SECRET`

---

- [ ] **Step 1: Add `BlockedIp` model to `prisma/schema.prisma`**

  Append this block at the very end of `prisma/schema.prisma` (after the `SecurityAuditLog` model):

  ```prisma
  // ─── Blocked IPs ──────────────────────────────────────────────────────────

  model BlockedIp {
    id        String   @id @default(cuid())
    ip        String   @unique  // stored normalized (no leading zeros per octet)
    blockedAt DateTime @default(now())
    expiresAt DateTime

    @@index([expiresAt])
    @@map("blocked_ips")
  }
  ```

  Also update the `event` comment on `SecurityAuditLog` (line ~1107) to append the two new events:

  ```prisma
  event     String   // login_success | login_failure | logout | 2fa_sent | 2fa_success | 2fa_failure | password_reset_request | password_reset_complete | password_change | portal_login_success | portal_login_failure | portal_logout | ip_blocklist_upload | ip_blocklist_remove
  ```

- [ ] **Step 2: Add new audit events to `lib/audit.ts`**

  In the `AUDIT_EVENTS` array (after `'portal_logout'`), add:

  ```ts
  'ip_blocklist_upload',
  'ip_blocklist_remove',
  ```

  The array should now end with:
  ```ts
  'portal_login_success',
  'portal_login_failure',
  'portal_logout',
  'ip_blocklist_upload',
  'ip_blocklist_remove',
  ] as const
  ```

- [ ] **Step 3: Create `lib/ip-utils.ts`**

  ```ts
  /**
   * Normalize an IPv4 address by stripping leading zeros from each octet.
   * e.g. "192.168.001.001" → "192.168.1.1"
   * Returns the input unchanged if it is not a valid IPv4 address.
   */
  export function normalizeIpv4(ip: string): string {
    const parts = ip.split('.')
    if (parts.length !== 4) return ip
    return parts.map(p => String(parseInt(p, 10))).join('.')
  }

  /**
   * Returns true if the string is a valid IPv4 address (after normalization).
   * Does not accept CIDR notation.
   */
  export function isValidIpv4(ip: string): boolean {
    if (ip.includes('/')) return false
    const parts = ip.split('.')
    if (parts.length !== 4) return false
    return parts.every(p => {
      if (!/^\d{1,3}$/.test(p)) return false
      const n = parseInt(p, 10)
      return n >= 0 && n <= 255
    })
  }
  ```

- [ ] **Step 4: Add `INTERNAL_SECRET` to `.env.example`**

  Append at the end of `.env.example`:

  ```
  # ─── Internal API secret ─────────────────────────────────────────────────────
  # Used by middleware to authenticate the internal /api/internal/blocked-ips endpoint.
  # Generate with: openssl rand -hex 32
  INTERNAL_SECRET=change-me-in-production
  ```

- [ ] **Step 5: Run Prisma migration**

  ```bash
  npx prisma migrate dev --name add_blocked_ip
  ```

  Expected: Migration file created under `prisma/migrations/`, Prisma client regenerated.

- [ ] **Step 6: Verify TypeScript compiles**

  ```bash
  npm run build
  ```

  Expected: Build succeeds with no TypeScript errors. (Lint warnings about unused vars are OK; errors are not.)

- [ ] **Step 7: Commit**

  ```bash
  git add prisma/schema.prisma prisma/migrations lib/audit.ts lib/ip-utils.ts .env.example
  git commit -m "feat: add BlockedIp schema, audit events, ip-utils"
  ```

---

## Chunk 2: Internal Endpoint + Admin API Routes

**Files:**
- Create: `app/api/internal/blocked-ips/route.ts` — returns active blocked IPs for middleware cache
- Create: `app/api/admin/blocked-ips/route.ts` — GET paginated list + POST CSV upload
- Create: `app/api/admin/blocked-ips/[id]/route.ts` — DELETE single IP

---

- [ ] **Step 1: Create `app/api/internal/blocked-ips/route.ts`**

  ```ts
  import { NextResponse } from 'next/server'
  import { prisma } from '@/lib/prisma'

  export async function GET(request: Request) {
    const secret = request.headers.get('x-internal-secret')
    if (!secret || secret !== process.env.INTERNAL_SECRET) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const now = new Date()
    const rows = await prisma.blockedIp.findMany({
      where: { expiresAt: { gt: now } },
      select: { ip: true },
    })

    return NextResponse.json({ ips: rows.map(r => r.ip) })
  }
  ```

- [ ] **Step 2: Create `app/api/admin/blocked-ips/route.ts`**

  ```ts
  import { NextResponse } from 'next/server'
  import { getSession } from '@/lib/auth'
  import { prisma } from '@/lib/prisma'
  import { logAuditEvent, extractIp } from '@/lib/audit'
  import { parseCsv } from '@/lib/csv'
  import { isValidIpv4, normalizeIpv4 } from '@/lib/ip-utils'

  function addMonths(date: Date, months: number): Date {
    const d = new Date(date)
    d.setMonth(d.getMonth() + months)
    return d
  }

  // GET /api/admin/blocked-ips
  export async function GET(request: Request) {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { searchParams } = new URL(request.url)
    const page    = Math.max(1, parseInt(searchParams.get('page')  ?? '1',  10) || 1)
    const limit   = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10) || 50))
    const includeExpired = searchParams.get('includeExpired') === 'true'

    const where = includeExpired ? {} : { expiresAt: { gt: new Date() } }

    const [total, data] = await Promise.all([
      prisma.blockedIp.count({ where }),
      prisma.blockedIp.findMany({
        where,
        orderBy: { blockedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ])

    return NextResponse.json({ data, total })
  }

  // POST /api/admin/blocked-ips/upload  (body: { csv: string })
  export async function POST(request: Request) {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    // Body size guard — read actual body text, not the content-length header (which can be absent)
    let bodyText: string
    try {
      bodyText = await request.text()
    } catch {
      return NextResponse.json({ error: 'Failed to read request body' }, { status: 400 })
    }
    if (Buffer.byteLength(bodyText, 'utf8') > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'Request body too large. Maximum is 5 MB.' }, { status: 413 })
    }

    let body: { csv?: string }
    try {
      body = JSON.parse(bodyText)
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    if (typeof body.csv !== 'string' || !body.csv.trim()) {
      return NextResponse.json({ error: 'csv field is required' }, { status: 400 })
    }

    // Parse CSV — use existing parseCsv utility which lowercases header keys
    let rawRows: Record<string, string>[]
    try {
      rawRows = parseCsv(body.csv)
    } catch {
      return NextResponse.json({ error: 'Could not parse CSV' }, { status: 400 })
    }

    if (rawRows.length > 10_000) {
      return NextResponse.json(
        { error: 'Too many IPs. Maximum is 10,000 per upload.' },
        { status: 422 }
      )
    }

    const now       = new Date()
    const expiresAt = addMonths(now, 4)

    let skipped = 0
    const invalid: string[] = []
    const validIps: string[] = []

    // Validate and normalize all rows first
    for (const row of rawRows) {
      const raw = (row['ip'] ?? '').trim()
      if (!raw) { skipped++; continue }

      if (!isValidIpv4(raw)) {
        if (invalid.length < 50) invalid.push(raw)
        skipped++
        continue
      }
      validIps.push(normalizeIpv4(raw))
    }

    // Deduplicate within the upload itself
    const uniqueIps = [...new Set(validIps)]

    // One query to find which IPs already exist
    const existing = await prisma.blockedIp.findMany({
      where: { ip: { in: uniqueIps } },
      select: { ip: true },
    })
    const existingSet = new Set(existing.map(r => r.ip))

    const toCreate = uniqueIps.filter(ip => !existingSet.has(ip))
    const toUpdate = uniqueIps.filter(ip =>  existingSet.has(ip))

    // Batch create new IPs
    await prisma.blockedIp.createMany({
      data: toCreate.map(ip => ({ ip, blockedAt: now, expiresAt })),
      skipDuplicates: true,
    })

    // Batch update existing IPs in parallel (max 100 concurrent)
    const BATCH = 100
    for (let i = 0; i < toUpdate.length; i += BATCH) {
      const batch = toUpdate.slice(i, i + BATCH)
      await Promise.all(batch.map(ip =>
        prisma.blockedIp.update({ where: { ip }, data: { expiresAt } })
      ))
    }

    const added   = toCreate.length
    const updated = toUpdate.length

    await logAuditEvent({
      event:     'ip_blocklist_upload',
      userId:    session.id,
      ip:        extractIp(request),
      meta:      { added, updated, skipped, invalidCount: invalid.length },
    })

    return NextResponse.json({ added, updated, skipped, invalid })
  }
  ```

- [ ] **Step 3: Create `app/api/admin/blocked-ips/[id]/route.ts`**

  ```ts
  import { NextResponse } from 'next/server'
  import { getSession } from '@/lib/auth'
  import { prisma } from '@/lib/prisma'
  import { logAuditEvent, extractIp } from '@/lib/audit'

  export async function DELETE(
    request: Request,
    { params }: { params: { id: string } }
  ) {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const record = await prisma.blockedIp.findUnique({ where: { id: params.id } })
    if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await prisma.blockedIp.delete({ where: { id: params.id } })

    await logAuditEvent({
      event:  'ip_blocklist_remove',
      userId: session.id,
      ip:     extractIp(request),
      meta:   { ip: record.ip },
    })

    return NextResponse.json({ success: true })
  }
  ```

- [ ] **Step 4: Verify TypeScript compiles**

  ```bash
  npm run build
  ```

  Expected: No new TypeScript errors.

- [ ] **Step 5: Manually test the internal endpoint**

  Start the dev server (`npm run dev`) and run:

  ```bash
  # Should return 403 (no secret)
  curl -s http://localhost:3000/api/internal/blocked-ips

  # Should return { ips: [] } (empty DB)
  curl -s -H "x-internal-secret: change-me-in-production" http://localhost:3000/api/internal/blocked-ips
  ```

- [ ] **Step 6: Commit**

  ```bash
  git add app/api/internal/blocked-ips app/api/admin/blocked-ips
  git commit -m "feat: add internal blocked-ips endpoint and admin CRUD routes"
  ```

---

## Chunk 3: Middleware — Cache + Block Check

**Files:**
- Modify: `middleware.ts` — add module-level cache, block check, updated matcher

---

- [ ] **Step 1: Add cache declarations at the top of `middleware.ts`**

  After the existing imports, before the `PROTECTED_PATHS` declaration, insert:

  ```ts
  // ── Blocked IP cache ────────────────────────────────────────────────────────
  let blockedIpCache: { ips: Set<string>; refreshedAt: number } = {
    ips: new Set(),
    refreshedAt: 0,
  }
  const BLOCKED_IP_CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

  async function getBlockedIps(): Promise<Set<string>> {
    if (Date.now() - blockedIpCache.refreshedAt < BLOCKED_IP_CACHE_TTL_MS) {
      return blockedIpCache.ips
    }
    try {
      const base   = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
      const secret = process.env.INTERNAL_SECRET ?? ''
      const res    = await fetch(`${base}/api/internal/blocked-ips`, {
        headers: { 'x-internal-secret': secret },
        cache:   'no-store',
      })
      if (res.ok) {
        const json: { ips: string[] } = await res.json()
        blockedIpCache = { ips: new Set(json.ips), refreshedAt: Date.now() }
      }
    } catch {
      // On fetch failure keep stale cache — never crash middleware
    }
    return blockedIpCache.ips
  }
  ```

- [ ] **Step 2: Add the block check at the top of the `middleware` function**

  At the very top of `export async function middleware(request: NextRequest)`, before the rate limiting section, add:

  ```ts
  // ── Blocked IP check ────────────────────────────────────────────────────────
  const skipPaths = ['/admin/login', '/api/auth/login', '/api/auth/2fa/verify', '/api/portal/login', '/api/internal/']
  const isSkipped = skipPaths.some(p => pathname.startsWith(p))

  if (!isSkipped) {
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0].trim()
                  ?? request.headers.get('x-real-ip')
                  ?? 'unknown'
    // Normalize: strip leading zeros per octet
    const normalizedIp = clientIp.split('.').map(p => String(parseInt(p, 10) || 0)).join('.')
    const blocked = await getBlockedIps()
    if (blocked.has(normalizedIp)) {
      return NextResponse.json({ error: 'Your IP has been blocked.' }, { status: 403 })
    }
  }
  ```

- [ ] **Step 3: Update the middleware `matcher` config**

  Replace the existing `export const config` at the bottom of `middleware.ts` with:

  ```ts
  export const config = {
    matcher: ['/admin/:path*', '/api/((?!internal/).*)', '/listings/:path*'],
  }
  ```

  This excludes `/api/internal/*` from the middleware so the cache refresh fetch never triggers the block check on itself.

- [ ] **Step 4: Verify TypeScript compiles**

  ```bash
  npm run build
  ```

  Expected: No TypeScript errors. If `NEXT_PUBLIC_APP_URL` is not in `.env.example`, add it:

  ```
  NEXT_PUBLIC_APP_URL=http://localhost:3000
  ```

- [ ] **Step 5: Manually test blocking**

  Start dev server. Insert a test IP into the DB via Prisma Studio (`npm run db:studio`) or a direct SQL insert:

  ```sql
  INSERT INTO blocked_ips (id, ip, "blockedAt", "expiresAt")
  VALUES ('test-id-1', '127.0.0.1', NOW(), NOW() + INTERVAL '4 months');
  ```

  Then visit `http://localhost:3000` from localhost. Expected: `{"error":"Your IP has been blocked."}` with status 403.

  Clean up after testing:
  ```sql
  DELETE FROM blocked_ips WHERE id = 'test-id-1';
  ```

- [ ] **Step 6: Commit**

  ```bash
  git add middleware.ts .env.example
  git commit -m "feat: add blocked IP middleware cache and block check"
  ```

---

## Chunk 4: Admin UI — Tabbed Security Page + Blocked IPs Tab

**Files:**
- Create: `components/admin/security/BlockedIpsUpload.tsx` — CSV upload + preview
- Create: `components/admin/security/BlockedIpsTable.tsx` — current blocked IPs list
- Create: `components/admin/security/BlockedIpsTab.tsx` — composes upload + table
- Modify: `app/admin/security/page.tsx` — refactor to tab layout

---

- [ ] **Step 1: Create `components/admin/security/BlockedIpsUpload.tsx`**

  ```tsx
  'use client'

  import { useState, useRef } from 'react'
  import { Upload, Download } from 'lucide-react'
  import { Button } from '@/components/ui'
  import { useToast } from '@/components/ui/Toast'
  import { parseCsv } from '@/lib/csv'
  import { isValidIpv4, normalizeIpv4 } from '@/lib/ip-utils'

  const TEMPLATE = 'ip\n192.168.1.1\n10.0.0.5\n'
  const MAX_PREVIEW_ROWS = 500
  const MAX_FILE_BYTES   = 5 * 1024 * 1024

  interface ParsedIpRow {
    raw: string
    normalized: string | null
    valid: boolean
    error?: string
  }

  interface UploadResult {
    added:   number
    updated: number
    skipped: number
    invalid: string[]
  }

  interface Props {
    onUploaded: () => void // called after a successful upload so the table can refresh
  }

  function downloadTemplate() {
    const blob = new Blob([TEMPLATE], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = 'blocked-ips-template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  function parseRows(csvText: string): { rows: ParsedIpRow[]; total: number } {
    const raw  = parseCsv(csvText)
    const total = raw.length
    const slice = raw.slice(0, MAX_PREVIEW_ROWS)
    const rows: ParsedIpRow[] = slice.map(r => {
      const value = (r['ip'] ?? '').trim()
      if (!value)              return { raw: value, normalized: null, valid: false, error: 'Empty' }
      if (!isValidIpv4(value)) return { raw: value, normalized: null, valid: false, error: 'Invalid IPv4' }
      return { raw: value, normalized: normalizeIpv4(value), valid: true }
    })
    return { rows, total }
  }

  export function BlockedIpsUpload({ onUploaded }: Props) {
    const { toast }                   = useToast()
    const [rows, setRows]             = useState<ParsedIpRow[]>([])
    const [totalRows, setTotalRows]   = useState(0)
    const [rawCsv, setRawCsv]         = useState('')
    const [fileError, setFileError]   = useState<string | null>(null)
    const [result, setResult]         = useState<UploadResult | null>(null)
    const [loading, setLoading]       = useState(false)
    const [isDragging, setIsDragging] = useState(false)
    const fileInputRef                = useRef<HTMLInputElement>(null)

    const validCount = rows.filter(r => r.valid).length

    function handleFile(file: File) {
      setFileError(null)
      setResult(null)
      if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
        setFileError('Please upload a .csv file.')
        return
      }
      if (file.size > MAX_FILE_BYTES) {
        setFileError('File is too large. Maximum size is 5 MB.')
        return
      }
      const reader = new FileReader()
      reader.onload = e => {
        try {
          const text         = e.target?.result as string
          const { rows: r, total } = parseRows(text)
          setRows(r)
          setTotalRows(total)
          setRawCsv(text)
        } catch {
          setFileError('Could not parse this file. Make sure it is a valid CSV.')
        }
      }
      reader.readAsText(file)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }

    function handleDrop(e: React.DragEvent) {
      e.preventDefault()
      setIsDragging(false)
      const file = e.dataTransfer.files[0]
      if (file) handleFile(file)
    }

    async function handleUpload() {
      setLoading(true)
      try {
        const res = await fetch('/api/admin/blocked-ips', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ csv: rawCsv }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          toast('error', 'Upload failed', (err as { error?: string }).error ?? 'Please try again.')
          return
        }
        const data: UploadResult = await res.json()
        setResult(data)
        setRows([])
        setRawCsv('')
        setTotalRows(0)
        onUploaded()
      } catch {
        toast('error', 'Upload failed', 'Please try again.')
      } finally {
        setLoading(false)
      }
    }

    function reset() {
      setRows([])
      setRawCsv('')
      setTotalRows(0)
      setResult(null)
      setFileError(null)
    }

    return (
      <div className="space-y-4">
        <h2 className="text-base font-semibold text-gray-900">Upload Blocked IPs</h2>

        {/* Drop zone — only show when no rows parsed yet */}
        {rows.length === 0 && !result && (
          <>
            <div
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                isDragging ? 'border-charcoal-500 bg-charcoal-50' : 'border-charcoal-300 hover:border-charcoal-400'
              }`}
              onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="mx-auto mb-2 text-charcoal-400" size={28} />
              <p className="font-medium text-charcoal-800">Drop your CSV here or click to browse</p>
              <p className="text-sm text-charcoal-500 mt-1">Accepts .csv files up to 5 MB</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={e => { e.stopPropagation(); fileInputRef.current?.click() }}>
                Choose File
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
              />
            </div>

            <div className="flex items-center gap-2 text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2">
              <span>Single column CSV with header <code className="font-mono bg-blue-100 px-1 rounded">ip</code>. IPv4 addresses only.</span>
              <button className="ml-auto flex items-center gap-1 underline whitespace-nowrap" onClick={downloadTemplate}>
                <Download size={14} /> Template
              </button>
            </div>
          </>
        )}

        {fileError && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">{fileError}</p>
        )}

        {/* Preview table */}
        {rows.length > 0 && (
          <div className="space-y-3">
            {totalRows > MAX_PREVIEW_ROWS && (
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2">
                Showing first {MAX_PREVIEW_ROWS} of {totalRows} rows — all valid IPs will be uploaded.
              </p>
            )}
            <div className="overflow-x-auto rounded-lg border border-charcoal-200 max-h-64 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-charcoal-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-charcoal-700 border-b border-charcoal-200">IP Address</th>
                    <th className="px-3 py-2 text-left font-medium text-charcoal-700 border-b border-charcoal-200">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={i} className={row.valid ? 'bg-green-50' : 'bg-red-50'}>
                      <td className="px-3 py-1.5 font-mono text-charcoal-900">{row.raw || '(empty)'}</td>
                      <td className="px-3 py-1.5">
                        {row.valid ? (
                          <span className="text-xs font-medium text-green-700 bg-green-100 rounded-full px-2 py-0.5">Valid</span>
                        ) : (
                          <span className="text-xs font-medium text-red-700 bg-red-100 rounded-full px-2 py-0.5">{row.error ?? 'Invalid'}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={reset}>Cancel</Button>
              <Button
                variant="primary"
                size="sm"
                disabled={validCount === 0}
                loading={loading}
                onClick={handleUpload}
              >
                Block {validCount} IP{validCount !== 1 ? 's' : ''}
              </Button>
            </div>
          </div>
        )}

        {/* Result banner */}
        {result && (
          <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-800 space-y-1">
            <p className="font-medium">Upload complete</p>
            <p>{result.added} added · {result.updated} updated (expiry reset) · {result.skipped} invalid (skipped)</p>
            {result.invalid.length > 0 && (
              <p className="text-xs text-red-700 mt-1">Invalid entries: {result.invalid.slice(0, 10).join(', ')}{result.invalid.length > 10 ? ` + ${result.invalid.length - 10} more` : ''}</p>
            )}
            <button className="underline text-green-700 text-xs mt-1" onClick={reset}>Upload another</button>
          </div>
        )}
      </div>
    )
  }
  ```

- [ ] **Step 2: Create `components/admin/security/BlockedIpsTable.tsx`**

  ```tsx
  'use client'

  import { useState, useEffect, useCallback } from 'react'
  import { Trash2 } from 'lucide-react'
  import { useToast } from '@/components/ui/Toast'

  interface BlockedIpRow {
    id:        string
    ip:        string
    blockedAt: string
    expiresAt: string
  }

  interface Props {
    refreshKey: number // increment to force a reload
  }

  export function BlockedIpsTable({ refreshKey }: Props) {
    const { toast }                 = useToast()
    const [rows, setRows]           = useState<BlockedIpRow[]>([])
    const [total, setTotal]         = useState(0)
    const [page, setPage]           = useState(1)
    const [loading, setLoading]     = useState(true)
    const [removing, setRemoving]   = useState<string | null>(null)
    const limit = 50

    const fetchRows = useCallback(async (p: number) => {
      setLoading(true)
      try {
        const res  = await fetch(`/api/admin/blocked-ips?page=${p}&limit=${limit}`)
        const json = await res.json()
        setRows(json.data ?? [])
        setTotal(json.total ?? 0)
      } catch {
        toast('error', 'Failed to load blocked IPs', '')
      } finally {
        setLoading(false)
      }
    }, [toast])

    useEffect(() => {
      void fetchRows(page)
    }, [page, fetchRows, refreshKey])

    async function handleRemove(id: string) {
      setRemoving(id)
      try {
        const res = await fetch(`/api/admin/blocked-ips/${id}`, { method: 'DELETE' })
        if (!res.ok) throw new Error()
        toast('success', 'IP removed', '')
        void fetchRows(page)
      } catch {
        toast('error', 'Failed to remove IP', '')
      } finally {
        setRemoving(null)
      }
    }

    const totalPages = Math.ceil(total / limit)

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">Currently Blocked IPs</h2>
          {total > 0 && <span className="text-sm text-charcoal-500">{total} active</span>}
        </div>

        {loading ? (
          <p className="text-sm text-charcoal-500 py-6 text-center">Loading...</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-charcoal-500 py-6 text-center">No IPs are currently blocked.</p>
        ) : (
          <>
            <div className="overflow-x-auto rounded-lg border border-charcoal-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-charcoal-50 text-left">
                    {['IP Address', 'Blocked', 'Expires', ''].map(h => (
                      <th key={h} className="px-3 py-2 font-medium text-charcoal-700 border-b border-charcoal-200 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(row => (
                    <tr key={row.id} className="border-b border-charcoal-100 last:border-0 hover:bg-charcoal-50">
                      <td className="px-3 py-2 font-mono text-charcoal-900">{row.ip}</td>
                      <td className="px-3 py-2 text-charcoal-600 whitespace-nowrap">
                        {new Date(row.blockedAt).toLocaleDateString()}
                      </td>
                      <td className="px-3 py-2 text-charcoal-600 whitespace-nowrap">
                        {new Date(row.expiresAt).toLocaleDateString()}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          className="text-charcoal-400 hover:text-red-600 transition-colors disabled:opacity-40"
                          disabled={removing === row.id}
                          onClick={() => handleRemove(row.id)}
                          title="Remove block"
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between text-sm text-charcoal-600">
                <button
                  className="px-3 py-1 rounded border border-charcoal-200 hover:bg-charcoal-50 disabled:opacity-40"
                  disabled={page <= 1}
                  onClick={() => setPage(p => p - 1)}
                >
                  Previous
                </button>
                <span>Page {page} of {totalPages}</span>
                <button
                  className="px-3 py-1 rounded border border-charcoal-200 hover:bg-charcoal-50 disabled:opacity-40"
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => p + 1)}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    )
  }
  ```

- [ ] **Step 3: Create `components/admin/security/BlockedIpsTab.tsx`**

  ```tsx
  'use client'

  import { useState } from 'react'
  import { BlockedIpsUpload } from './BlockedIpsUpload'
  import { BlockedIpsTable }  from './BlockedIpsTable'

  export function BlockedIpsTab() {
    // Incrementing this triggers a table reload after an upload or remove
    const [refreshKey, setRefreshKey] = useState(0)

    return (
      <div className="space-y-8">
        <BlockedIpsUpload onUploaded={() => setRefreshKey(k => k + 1)} />
        <hr className="border-charcoal-200" />
        <BlockedIpsTable refreshKey={refreshKey} />
      </div>
    )
  }
  ```

- [ ] **Step 4: Refactor `app/admin/security/page.tsx` to a tabbed layout**

  Replace the entire file with:

  ```tsx
  'use client'

  import { useState, useEffect, useCallback } from 'react'
  import { SecurityAuditFilters, type AuditFilters } from '@/components/admin/security/SecurityAuditFilters'
  import { SecurityAuditTable, type AuditRow }        from '@/components/admin/security/SecurityAuditTable'
  import { BlockedIpsTab }                            from '@/components/admin/security/BlockedIpsTab'

  const TABS = [
    { id: 'audit',   label: 'Audit Log' },
    { id: 'blocked', label: 'Blocked IPs' },
  ] as const

  type TabId = (typeof TABS)[number]['id']

  export default function SecurityPage() {
    const [tab, setTab]       = useState<TabId>('audit')
    const [filters, setFilters] = useState<AuditFilters>({ events: [], actor: '', ip: '', from: '', to: '' })
    const [page, setPage]       = useState(1)
    const [data, setData]       = useState<{ rows: AuditRow[]; total: number }>({ rows: [], total: 0 })
    const [loading, setLoading] = useState(true)
    const [error, setError]     = useState<string | null>(null)

    const fetchAudit = useCallback(async (f: AuditFilters, p: number) => {
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
      if (tab === 'audit') void fetchAudit(filters, page)
    }, [tab, filters, page, fetchAudit])

    function handleFiltersChange(next: AuditFilters) {
      setFilters(next)
      setPage(1)
    }

    return (
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Security</h1>
          <p className="mt-1 text-sm text-gray-500">Audit log and blocked IP management</p>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 border-b border-charcoal-200 mb-6">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === t.id
                  ? 'border-charcoal-900 text-charcoal-900'
                  : 'border-transparent text-charcoal-500 hover:text-charcoal-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Audit Log tab */}
        {tab === 'audit' && (
          <>
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
          </>
        )}

        {/* Blocked IPs tab */}
        {tab === 'blocked' && <BlockedIpsTab />}
      </div>
    )
  }
  ```

- [ ] **Step 5: Verify TypeScript compiles and lint passes**

  ```bash
  npm run build && npm run lint
  ```

  Expected: No TypeScript errors. Lint may warn about unused vars from the old single-page structure — fix any that appear.

- [ ] **Step 6: Manual browser test — full flow**

  1. Start dev server: `npm run dev`
  2. Log in to `/admin` and navigate to `/admin/security`
  3. Confirm two tabs: "Audit Log" (existing content) and "Blocked IPs" (new)
  4. Switch to "Blocked IPs" tab
  5. Download the template, fill in a couple of test IPs, upload the CSV
  6. Confirm the preview table shows each IP as Valid/Invalid
  7. Click "Block X IPs" — confirm result banner shows correct counts
  8. Confirm the blocked IPs appear in the table below with correct Blocked/Expires dates
  9. Click the trash icon on one row — confirm it disappears from the table
  10. Check `/admin/security` → "Audit Log" tab — confirm `ip_blocklist_upload` and `ip_blocklist_remove` events appear

- [ ] **Step 7: Commit**

  ```bash
  git add components/admin/security/BlockedIpsUpload.tsx \
          components/admin/security/BlockedIpsTable.tsx \
          components/admin/security/BlockedIpsTab.tsx \
          app/admin/security/page.tsx
  git commit -m "feat: add Blocked IPs tab to admin security page"
  ```

---

## Final Verification

- [ ] Run a production build to confirm no errors: `npm run build`
- [ ] Confirm `INTERNAL_SECRET` is set in your `.env` (not just `.env.example`)
- [ ] Confirm `NEXT_PUBLIC_APP_URL` is set in `.env` (e.g., `http://localhost:3000` for dev, your domain in prod)
