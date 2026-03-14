# CSV Bulk Contact Import Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 3-step dedicated page at `/admin/contacts/import` that lets admins upload a CSV file, preview/validate rows, and bulk-create contacts.

**Architecture:** Pure-JS CSV parser in `lib/csv.ts` handles client-side parsing; a new `/api/contacts/bulk` route handles server-side validation and Prisma writes. The import page is a client component managing step state (Upload → Preview → Results). No new npm dependencies.

**Tech Stack:** Next.js 15 App Router, TypeScript, Prisma 5, Zod 3, Tailwind CSS, Lucide React icons, `tsx` (for test scripts).

---

## Chunk 1: Foundation — CSV Parser + Shared Types

---

### Task 1: CSV Parser (`lib/csv.ts`)

**Files:**
- Create: `lib/csv.ts`
- Create: `scripts/test-csv.ts` (throwaway test script, delete after verifying)

- [ ] **Step 1: Write the test script**

Create `scripts/test-csv.ts`:

```typescript
import { parseCsv } from '../lib/csv'

function assert(condition: boolean, msg: string) {
  if (!condition) { console.error('FAIL:', msg); process.exit(1) }
  console.log('PASS:', msg)
}

// Basic parse
const basic = parseCsv('firstName,lastName,email\nJane,Smith,jane@example.com')
assert(basic.length === 1, 'basic: one data row')
assert(basic[0].firstname === 'Jane', 'basic: header lowercased, value preserved')
assert(basic[0].lastname === 'Smith', 'basic: lastName header lowercased to lastname')
assert(basic[0].email === 'jane@example.com', 'basic: email value')

// Quoted field with comma (tags use case)
const quoted = parseCsv('email,tags\njane@example.com,"buyer,downtown"')
assert(quoted[0].tags === 'buyer,downtown', 'quoted: comma inside quotes')

// Extra columns ignored (no error thrown)
const extra = parseCsv('email,unknowncol\nfoo@x.com,whatever')
assert(extra[0].email === 'foo@x.com', 'extra: known column present')
assert(extra[0].unknowncol === 'whatever', 'extra: extra column accessible')

// Header only (no data rows)
const empty = parseCsv('firstName,email')
assert(empty.length === 0, 'empty: zero data rows returns empty array')

// Missing field returns empty string
const missing = parseCsv('firstName,email\n,foo@x.com')
assert(missing[0].firstname === '', 'missing: empty field is empty string')

// Windows line endings
const crlf = parseCsv('firstName,email\r\nJane,jane@x.com\r\n')
assert(crlf.length === 1, 'crlf: windows line endings handled')
assert(crlf[0].email === 'jane@x.com', 'crlf: value correct')

console.log('\nAll tests passed.')
```

- [ ] **Step 2: Run test to confirm it fails (lib/csv.ts does not exist)**

```bash
cd /c/Users/miket/Documents/realestateweb && npx tsx scripts/test-csv.ts
```

Expected: error — `Cannot find module '../lib/csv'`

- [ ] **Step 3: Implement `lib/csv.ts`**

Create `lib/csv.ts`:

```typescript
/**
 * Parse a CSV string into an array of row objects keyed by lowercased header name.
 * Handles quoted fields (including fields containing commas or newlines).
 *
 * @param csvText  Raw CSV file contents as a string
 * @returns        Array of objects, one per data row. Keys are trimmed, lowercased header names.
 */
export function parseCsv(csvText: string): Record<string, string>[] {
  const lines = splitCsvLines(csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n'))
  if (lines.length === 0) return []

  const headers = parseRow(lines[0]).map(h => h.trim().toLowerCase())
  const rows: Record<string, string>[] = []

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    const values = parseRow(line)
    const row: Record<string, string> = {}
    headers.forEach((h, idx) => { row[h] = values[idx] ?? '' })
    rows.push(row)
  }

  return rows
}

/** Split CSV text into logical lines, respecting quoted fields that span lines. */
function splitCsvLines(text: string): string[] {
  const lines: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === '"') {
      // Handle escaped quote ("")
      if (inQuotes && text[i + 1] === '"') { current += '"'; i++; continue }
      inQuotes = !inQuotes
      current += ch
    } else if (ch === '\n' && !inQuotes) {
      lines.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  if (current) lines.push(current)
  return lines
}

/** Parse a single CSV row into an array of field values. */
function parseRow(line: string): string[] {
  const fields: string[] = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { field += '"'; i++; continue }
      inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      fields.push(field)
      field = ''
    } else {
      field += ch
    }
  }
  fields.push(field)
  return fields
}
```

- [ ] **Step 4: Run test to verify all pass**

```bash
cd /c/Users/miket/Documents/realestateweb && npx tsx scripts/test-csv.ts
```

Expected output:
```
PASS: basic: one data row
PASS: basic: header lowercased, value preserved
PASS: basic: lastName header lowercased to lastname
PASS: basic: email value
PASS: quoted: comma inside quotes
PASS: extra: known column present
PASS: extra: extra column accessible
PASS: empty: zero data rows returns empty array
PASS: missing: empty field is empty string
PASS: crlf: windows line endings handled
PASS: crlf: value correct

All tests passed.
```

- [ ] **Step 5: Delete test script**

```bash
rm /c/Users/miket/Documents/realestateweb/scripts/test-csv.ts
```

- [ ] **Step 6: Commit**

```bash
cd /c/Users/miket/Documents/realestateweb
git add lib/csv.ts
git commit -m "feat: add pure-JS CSV parser utility"
```

---

### Task 2: Shared Types (`types/csv.ts`)

**Files:**
- Create: `types/csv.ts`

- [ ] **Step 1: Create the shared type file**

Create `types/csv.ts`:

```typescript
export type ParsedContactRow = {
  // Raw CSV values
  firstName: string
  lastName: string
  email: string
  phone: string
  company: string
  jobTitle: string
  source: string
  status: string
  tags: string          // raw comma-separated string, e.g. "buyer,downtown"

  // Client-side validation result
  rowStatus: 'ready' | 'error'
  errorMessage?: string // e.g. "Missing email", "Invalid email format"
  rowIndex: number      // 1-based data row number (row 1 = first data row after header)
}

export type BulkImportResult = {
  imported: number
  skipped: number
  failed: number
  errors: Array<{ row: number; email: string; reason: string }>
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /c/Users/miket/Documents/realestateweb && npx tsc --noEmit
```

Expected: no errors. If errors appear in files you did not touch, they are pre-existing — ignore them and move on.

- [ ] **Step 3: Commit**

```bash
cd /c/Users/miket/Documents/realestateweb
git add types/csv.ts
git commit -m "feat: add ParsedContactRow and BulkImportResult types"
```

---

## Chunk 2: API Endpoint (`app/api/contacts/bulk/route.ts`)

---

### Task 3: Bulk Import API Route

**Files:**
- Create: `app/api/contacts/bulk/route.ts`

The route is automatically protected by `middleware.ts` because it matches `/api/contacts/*`. No auth code needed in the handler.

- [ ] **Step 1: Create the route**

Create `app/api/contacts/bulk/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'

const VALID_STATUSES = ['lead', 'prospect', 'client', 'past_client'] as const

const contactRowSchema = z.object({
  firstName: z.string().optional(),
  lastName:  z.string().optional(),
  email:     z.string(),
  phone:     z.string().optional(),
  company:   z.string().optional(),
  jobTitle:  z.string().optional(),
  source:    z.string().optional(),
  status:    z.string().optional(),
  tags:      z.array(z.string()).optional(),
  rowIndex:  z.number(),
})

const bulkImportSchema = z.object({
  contacts: z.array(contactRowSchema),
})

export async function POST(request: Request) {
  try {
    const body = await request.json()

    // Row count guard — check raw body before full Zod parse to reject oversized payloads fast
    if (Array.isArray(body?.contacts) && body.contacts.length > 2000) {
      return NextResponse.json(
        { error: 'Too many rows. Maximum is 2000.' },
        { status: 400 }
      )
    }

    // Outer shape validation
    const parsed = bulkImportSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const { contacts } = parsed.data

    let imported = 0
    let skipped  = 0
    let failed   = 0
    const errors: Array<{ row: number; email: string; reason: string }> = []

    for (const row of contacts) {
      const emailValidator = z.string().email()
      const emailResult = emailValidator.safeParse(row.email)
      if (!emailResult.success) {
        failed++
        errors.push({ row: row.rowIndex, email: row.email, reason: 'Invalid email format' })
        continue
      }

      // Check for duplicate
      const existing = await prisma.contact.findUnique({ where: { email: row.email } })
      if (existing) {
        skipped++
        continue
      }

      // Defaults
      const firstName = row.firstName ?? ''
      const lastName  = row.lastName  ?? ''
      const status    = VALID_STATUSES.includes(row.status as typeof VALID_STATUSES[number])
        ? (row.status as string)
        : 'lead'
      const tagNames = row.tags ?? []

      try {
        // Note: Contact.email is `String?` (nullable) in the Prisma schema.
        // Prisma accepts `string` where `string | null | undefined` is expected,
        // so row.email (already validated as a non-empty string) is passed directly.
        await prisma.contact.create({
          data: {
            firstName,
            lastName,
            email:    row.email,
            phone:    row.phone    || null,
            company:  row.company  || null,
            jobTitle: row.jobTitle || null,
            source:   row.source   || null,
            status,
            tags: {
              create: tagNames.map(name => ({
                tag: {
                  connectOrCreate: {
                    where:  { name },
                    create: { name, color: '#6366f1' },
                  },
                },
              })),
            },
          },
        })
        imported++
      } catch (err) {
        failed++
        errors.push({ row: row.rowIndex, email: row.email, reason: 'Database error' })
        console.error('[bulk import row error]', err)
      }
    }

    return NextResponse.json({ imported, skipped, failed, errors })
  } catch (err) {
    console.error('[POST /api/contacts/bulk]', err)
    return NextResponse.json({ error: 'Import failed' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /c/Users/miket/Documents/realestateweb && npx tsc --noEmit
```

Expected: no errors. If errors appear in files you did not touch, they are pre-existing — ignore them and move on.

- [ ] **Step 3: Start dev server and smoke-test the endpoint**

```bash
cd /c/Users/miket/Documents/realestateweb && npm run dev
```

First log in via the browser at `http://localhost:3000/admin/login` to get an `auth_token` cookie. Then copy the cookie value from DevTools → Application → Cookies.

Run this in PowerShell (replace `<your-auth-token>` with the copied value):

```powershell
$body = '{"contacts":[{"email":"bulktest@example.com","firstName":"Bulk","lastName":"Test","rowIndex":1}]}'
$headers = @{ "Content-Type" = "application/json"; "Cookie" = "auth_token=<your-auth-token>" }
Invoke-WebRequest -Method POST -Uri "http://localhost:3000/api/contacts/bulk" -Headers $headers -Body $body | Select-Object -ExpandProperty Content
```

Expected response:
```json
{"imported":1,"skipped":0,"failed":0,"errors":[]}
```

Re-run — expected (duplicate skipped):
```json
{"imported":0,"skipped":1,"failed":0,"errors":[]}
```

- [ ] **Step 4: Verify the contact appears in the admin UI**

Navigate to `http://localhost:3000/admin/contacts` and confirm `bulktest@example.com` appears in the contacts list.

- [ ] **Step 5: Commit**

```bash
cd /c/Users/miket/Documents/realestateweb
git add app/api/contacts/bulk/route.ts
git commit -m "feat: add POST /api/contacts/bulk endpoint"
```

---

## Chunk 3: Preview Table Component (`components/admin/CsvImportTable.tsx`)

---

### Task 4: CsvImportTable Component

**Files:**
- Create: `components/admin/CsvImportTable.tsx`

- [ ] **Step 1: Create the component**

Create `components/admin/CsvImportTable.tsx`:

```typescript
'use client'

import { cn } from '@/lib/utils'
import type { ParsedContactRow } from '@/types/csv'

interface CsvImportTableProps {
  rows: ParsedContactRow[]
}

export function CsvImportTable({ rows }: CsvImportTableProps) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-charcoal-500 py-4 text-center">
        No data rows found in this CSV.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-charcoal-200">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-charcoal-50 text-left">
            {['#', 'Name', 'Email', 'Phone', 'Company', 'Status', 'Tags', 'Result'].map(h => (
              <th key={h} className="px-3 py-2 font-medium text-charcoal-700 border-b border-charcoal-200 whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr
              key={row.rowIndex}
              className={cn(
                row.rowStatus === 'ready' ? 'bg-green-50' : 'bg-red-50'
              )}
            >
              <td className="px-3 py-2 text-charcoal-400">{row.rowIndex}</td>
              <td className="px-3 py-2 text-charcoal-900">
                {[row.firstName, row.lastName].filter(Boolean).join(' ') || '—'}
              </td>
              <td className="px-3 py-2 text-charcoal-700">{row.email || '—'}</td>
              <td className="px-3 py-2 text-charcoal-600">{row.phone || '—'}</td>
              <td className="px-3 py-2 text-charcoal-600">{row.company || '—'}</td>
              <td className="px-3 py-2 text-charcoal-600">{row.status || '—'}</td>
              <td className="px-3 py-2 text-charcoal-600">{row.tags || '—'}</td>
              <td className="px-3 py-2">
                {row.rowStatus === 'ready' ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-100 rounded-full px-2 py-0.5">
                    ✓ Ready
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-100 rounded-full px-2 py-0.5">
                    ✗ {row.errorMessage}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /c/Users/miket/Documents/realestateweb && npx tsc --noEmit
```

Expected: no errors. If errors appear in files you did not touch, they are pre-existing — ignore them and move on.

- [ ] **Step 3: Commit**

```bash
cd /c/Users/miket/Documents/realestateweb
git add components/admin/CsvImportTable.tsx
git commit -m "feat: add CsvImportTable preview component"
```

---

## Chunk 4: Import Page (`app/admin/contacts/import/page.tsx`)

---

### Task 5: Import Page

**Files:**
- Create: `app/admin/contacts/import/page.tsx`

The import page has 3 steps managed by local state. It is a client component; the route is protected by middleware.

- [ ] **Step 1: Create the page**

Create `app/admin/contacts/import/page.tsx`:

```typescript
'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { Upload, ArrowLeft, ArrowRight, CheckCircle, Users } from 'lucide-react'
import { PageHeader } from '@/components/layout'
import { Button } from '@/components/ui'
import { useToast } from '@/components/ui/Toast'
import { CsvImportTable } from '@/components/admin/CsvImportTable'
import { parseCsv } from '@/lib/csv'
import type { ParsedContactRow, BulkImportResult } from '@/types/csv'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const CSV_TEMPLATE = `firstName,lastName,email,phone,company,jobTitle,source,status,tags
Jane,Smith,jane@example.com,555-1234,Acme Corp,Realtor,referral,lead,"buyer,downtown"`

function downloadTemplate() {
  const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = 'contacts-template.csv'
  a.click()
  URL.revokeObjectURL(url)
}

function validateRows(raw: Record<string, string>[]): ParsedContactRow[] {
  return raw.map((r, i) => {
    const email = (r['email'] ?? '').trim()
    if (!email) {
      return { ...mapRawRow(r), email, rowIndex: i + 1, rowStatus: 'error', errorMessage: 'Missing email' }
    }
    if (!EMAIL_REGEX.test(email)) {
      return { ...mapRawRow(r), email, rowIndex: i + 1, rowStatus: 'error', errorMessage: 'Invalid email format' }
    }
    return { ...mapRawRow(r), email, rowIndex: i + 1, rowStatus: 'ready' }
  })
}

function mapRawRow(r: Record<string, string>) {
  return {
    firstName: r['firstname'] ?? '',
    lastName:  r['lastname']  ?? '',
    email:     r['email']     ?? '',
    phone:     r['phone']     ?? '',
    company:   r['company']   ?? '',
    jobTitle:  r['jobtitle']  ?? '',
    source:    r['source']    ?? '',
    status:    r['status']    ?? '',
    tags:      r['tags']      ?? '',
  }
}

export default function ImportContactsPage() {
  const { toast }                         = useToast()
  const [step, setStep]                   = useState<1 | 2 | 3>(1)
  const [rows, setRows]                   = useState<ParsedContactRow[]>([])
  const [results, setResults]             = useState<BulkImportResult | null>(null)
  const [loading, setLoading]             = useState(false)
  const [fileError, setFileError]         = useState<string | null>(null)
  const [isDragging, setIsDragging]       = useState(false)
  const fileInputRef                      = useRef<HTMLInputElement>(null)

  const readyCount = rows.filter(r => r.rowStatus === 'ready').length
  const errorCount = rows.filter(r => r.rowStatus === 'error').length

  function handleFile(file: File) {
    setFileError(null)
    if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
      setFileError('Please upload a .csv file.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setFileError('File is too large. Maximum size is 5 MB.')
      return
    }
    const reader = new FileReader()
    reader.onload = e => {
      try {
        const text     = e.target?.result as string
        const rawRows  = parseCsv(text)
        const validated = validateRows(rawRows)
        setRows(validated)
        setStep(2)
      } catch {
        setFileError('Could not parse this file. Make sure it is a valid CSV.')
      }
    }
    reader.readAsText(file)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  async function handleImport() {
    const readyRows = rows.filter(r => r.rowStatus === 'ready')
    setLoading(true)
    try {
      const res = await fetch('/api/contacts/bulk', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contacts: readyRows.map(r => ({
            firstName: r.firstName || undefined,
            lastName:  r.lastName  || undefined,
            email:     r.email,
            phone:     r.phone     || undefined,
            company:   r.company   || undefined,
            jobTitle:  r.jobTitle  || undefined,
            source:    r.source    || undefined,
            status:    r.status    || undefined,
            tags:      r.tags ? r.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
            rowIndex:  r.rowIndex,
          })),
        }),
      })
      if (!res.ok) {
        toast('error', 'Import failed', 'Please try again.')
        return
      }
      const data: BulkImportResult = await res.json()
      setResults(data)
      setStep(3)
    } catch {
      toast('error', 'Import failed', 'Please try again.')
    } finally {
      setLoading(false)
    }
  }

  function resetImport() {
    setStep(1)
    setRows([])
    setResults(null)
    setFileError(null)
  }

  // Minimal layout wrapper — the real DashboardLayout requires a server session.
  // We use a lightweight wrapper here since the page is a client component.
  return (
    <div className="min-h-screen bg-charcoal-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <PageHeader
          title="Import Contacts"
          subtitle="Upload a CSV file to create contacts in bulk"
          breadcrumbs={[
            { label: 'Dashboard', href: '/admin/dashboard' },
            { label: 'Contacts',  href: '/admin/contacts' },
            { label: 'Import' },
          ]}
        />

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-8">
          {[
            { n: 1, label: 'Upload File' },
            { n: 2, label: 'Preview & Validate' },
            { n: 3, label: 'Results' },
          ].map(({ n, label }, idx, arr) => (
            <div key={n} className="flex items-center gap-2 flex-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                step >= n ? 'bg-charcoal-900 text-white' : 'bg-charcoal-200 text-charcoal-500'
              }`}>
                {n}
              </div>
              <span className={`text-sm font-medium ${step >= n ? 'text-charcoal-900' : 'text-charcoal-400'}`}>
                {label}
              </span>
              {idx < arr.length - 1 && <div className="flex-1 h-px bg-charcoal-200 mx-2" />}
            </div>
          ))}
        </div>

        {/* Step 1: Upload */}
        {step === 1 && (
          <div className="bg-white rounded-2xl border border-charcoal-200 p-8 space-y-4">
            <div
              className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors cursor-pointer ${
                isDragging ? 'border-charcoal-500 bg-charcoal-50' : 'border-charcoal-300 hover:border-charcoal-400'
              }`}
              onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="mx-auto mb-3 text-charcoal-400" size={32} />
              <p className="font-medium text-charcoal-800 text-base">Drop your CSV here or click to browse</p>
              <p className="text-sm text-charcoal-500 mt-1">Accepts .csv files up to 5 MB</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={e => { e.stopPropagation(); fileInputRef.current?.click() }}>
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

            {fileError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
                {fileError}
              </p>
            )}

            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-800">
              <span className="font-medium">Expected columns:</span>{' '}
              firstName, lastName, email*, phone, company, jobTitle, source, status, tags
              <br />
              <button
                className="text-blue-600 underline mt-1 inline-block"
                onClick={downloadTemplate}
              >
                ⬇ Download CSV template
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Preview */}
        {step === 2 && (
          <div className="bg-white rounded-2xl border border-charcoal-200 p-6 space-y-4">
            <div className="flex gap-3 flex-wrap">
              <span className="text-sm font-medium text-green-700 bg-green-100 border border-green-200 rounded-full px-3 py-1">
                {readyCount} ready to import
              </span>
              {errorCount > 0 && (
                <span className="text-sm font-medium text-red-700 bg-red-100 border border-red-200 rounded-full px-3 py-1">
                  {errorCount} error{errorCount !== 1 ? 's' : ''} (will be skipped)
                </span>
              )}
            </div>

            {rows.length === 0 ? (
              <p className="text-sm text-charcoal-500 py-4 text-center">
                No data rows found. The CSV may contain only a header row.
              </p>
            ) : (
              <CsvImportTable rows={rows} />
            )}

            <div className="flex justify-between pt-2">
              <Button variant="outline" leftIcon={<ArrowLeft size={16} />} onClick={() => setStep(1)}>
                Back
              </Button>
              <Button
                variant="primary"
                rightIcon={<ArrowRight size={16} />}
                disabled={readyCount === 0}
                loading={loading}
                onClick={handleImport}
              >
                Import {readyCount} Contact{readyCount !== 1 ? 's' : ''}
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Results */}
        {step === 3 && results && (
          <div className="bg-white rounded-2xl border border-charcoal-200 p-10 text-center space-y-6">
            <CheckCircle className="mx-auto text-green-500" size={56} />
            <h2 className="text-2xl font-bold text-charcoal-900">Import Complete</h2>
            <div className="flex justify-center gap-10">
              <div>
                <div className="text-3xl font-bold text-green-600">{results.imported}</div>
                <div className="text-sm text-charcoal-500 mt-1">Imported</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-amber-500">{results.skipped}</div>
                <div className="text-sm text-charcoal-500 mt-1">Skipped (duplicate)</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-red-500">{results.failed}</div>
                <div className="text-sm text-charcoal-500 mt-1">Failed</div>
              </div>
            </div>

            {results.errors.length > 0 && (
              <div className="text-left bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-800 max-h-40 overflow-y-auto">
                <p className="font-medium mb-2">Row errors:</p>
                {results.errors.map(e => (
                  <div key={e.row}>Row {e.row}: {e.email || '(no email)'} — {e.reason}</div>
                ))}
              </div>
            )}

            <div className="flex justify-center gap-3">
              <Button variant="outline" onClick={resetImport}>
                Import Another
              </Button>
              <Button variant="primary" leftIcon={<Users size={16} />} asChild>
                <Link href="/admin/contacts">View Contacts</Link>
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /c/Users/miket/Documents/realestateweb && npx tsc --noEmit
```

Expected: no errors. If errors appear in files you did not touch, they are pre-existing — ignore them and move on.

- [ ] **Step 3: Manual test — navigate to the import page**

Start the dev server (`npm run dev`), log in as admin, then navigate to `http://localhost:3000/admin/contacts/import`.

Verify:
- Step indicator shows step 1 active
- Drop zone renders with "Choose File" button
- "Download CSV template" link triggers a file download
- Uploading a file > 5 MB shows the error message
- Uploading a non-CSV shows the file type error

- [ ] **Step 4: Manual test — preview step**

Upload the downloaded template CSV. Verify:
- Step advances to step 2
- Table shows 1 row with green "✓ Ready" badge
- "Import 1 Contact" button is enabled
- "Back" button returns to step 1

Create a second CSV with a row missing the email:
```
firstName,lastName,email
Test,User,
```
Upload it. Verify:
- Row shows red background and "✗ Missing email" badge
- "Import 0 Contacts" button is disabled

Create a third CSV with only a header row and no data:
```
firstName,lastName,email,phone,company,jobTitle,source,status,tags
```
Upload it. Verify:
- Step advances to step 2
- "No data rows found" message is shown (no table)
- "Import 0 Contacts" button is disabled

- [ ] **Step 5: Manual test — results step**

With the template CSV, click "Import 1 Contact". Verify:
- Step advances to step 3
- "Imported: 1, Skipped: 0, Failed: 0" shown
- Re-import the same file: "Imported: 0, Skipped: 1, Failed: 0"
- "View Contacts" navigates to `/admin/contacts`
- "Import Another" resets to step 1

- [ ] **Step 6: Commit**

```bash
cd /c/Users/miket/Documents/realestateweb
git add app/admin/contacts/import/page.tsx
git commit -m "feat: add CSV contact import page with 3-step flow"
```

---

## Chunk 5: Wire Up — Add Button to Contacts List

---

### Task 6: Add "Import Contacts" Button to Contacts Page

**Files:**
- Modify: `app/admin/contacts/page.tsx`

The existing file has a single `actions` button in `PageHeader`. We add a second button alongside it.

Current `actions` prop (line 27–31):
```tsx
actions={
  <Button variant="primary" leftIcon={<UserPlus size={16} />} asChild>
    <Link href="/admin/contacts/new">Add Contact</Link>
  </Button>
}
```

- [ ] **Step 1: Add the Import button**

Edit `app/admin/contacts/page.tsx`:

1. Add `Upload` to the lucide-react import line.
2. Replace the `actions` prop with a two-button group:

```tsx
actions={
  <div className="flex gap-2">
    <Button variant="outline" leftIcon={<Upload size={16} />} asChild>
      <Link href="/admin/contacts/import">Import Contacts</Link>
    </Button>
    <Button variant="primary" leftIcon={<UserPlus size={16} />} asChild>
      <Link href="/admin/contacts/new">Add Contact</Link>
    </Button>
  </div>
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /c/Users/miket/Documents/realestateweb && npx tsc --noEmit
```

Expected: no errors. If errors appear in files you did not touch, they are pre-existing — ignore them and move on.

- [ ] **Step 3: Manual test**

Navigate to `http://localhost:3000/admin/contacts`. Verify:
- Two buttons visible: "Import Contacts" (outline) and "Add Contact" (primary)
- "Import Contacts" navigates to `/admin/contacts/import`

- [ ] **Step 4: Commit**

```bash
cd /c/Users/miket/Documents/realestateweb
git add app/admin/contacts/page.tsx
git commit -m "feat: add Import Contacts button to contacts list page"
```

---

## Done

All tasks complete. The full feature is:

- `lib/csv.ts` — pure-JS CSV parser
- `types/csv.ts` — shared types
- `app/api/contacts/bulk/route.ts` — bulk create API
- `components/admin/CsvImportTable.tsx` — preview table
- `app/admin/contacts/import/page.tsx` — 3-step import page
- `app/admin/contacts/page.tsx` — "Import Contacts" button added
