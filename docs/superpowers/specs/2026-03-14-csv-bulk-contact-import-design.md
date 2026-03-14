# CSV Bulk Contact Import — Design Spec

**Date:** 2026-03-14
**Status:** Approved

---

## Overview

Add a bulk contact import feature to the admin contacts section, allowing admins to upload a CSV file and create multiple contacts at once. The flow is a 3-step dedicated page: Upload → Preview & Validate → Results.

---

## User Flow

1. Admin clicks **"Import Contacts"** button on the contacts list page (`/admin/contacts`). This button is added **alongside** the existing "Add Contact" button.
2. Browser navigates to `/admin/contacts/import`.
3. **Step 1 — Upload:** Admin drops or selects a CSV file. A template download link is available. Client validates file size (≤ 5 MB) before parsing.
4. **Step 2 — Preview & Validate:** CSV is parsed client-side and displayed in a full-width table. Each row is labeled **Ready** (valid) or **Error** (missing/invalid email). Summary badges show Ready and Error counts. If zero data rows are present (header-only CSV), an inline message is shown and the "Import" button is disabled. Note: duplicate detection is authoritative server-side only — the preview does not pre-check for duplicates.
5. **Step 3 — Results:** Only `ready` rows are POSTed to `/api/contacts/bulk` (each with its original CSV `rowIndex`). The server creates contacts, skips duplicates, and returns a summary. The results screen shows imported / skipped (duplicate) / failed counts with options to import another or view contacts.

---

## CSV Format

**Required column:** `email`

**Supported columns:**

| Column | Required | Notes |
|--------|----------|-------|
| `firstName` | No | Defaults to `""` if omitted |
| `lastName` | No | Defaults to `""` if omitted |
| `email` | **Yes** | Must be a valid email format |
| `phone` | No | |
| `company` | No | |
| `jobTitle` | No | |
| `source` | No | e.g. `website`, `referral`, `manual` |
| `status` | No | `lead`, `prospect`, `client`, `past_client` — defaults to `lead` if omitted or unrecognized |
| `tags` | No | Comma-separated tag names. **Must be quoted in the CSV** when multiple tags are present, e.g. `"buyer,downtown"`. The downloadable template demonstrates this. |

Column order is flexible; headers are matched by name (case-insensitive). Extra columns are ignored.

---

## Duplicate Handling

- **Database duplicates:** Rows whose email already exists in the database are skipped (not updated). Counted in "Skipped" on the results screen.
- **Intra-batch duplicates:** If the same email appears twice in the uploaded CSV, the first occurrence creates the contact and the second is treated as a database duplicate (skipped), since `findUnique` will find it after the first row is created.

---

## Validation Rules

### Client-side (preview step)

- `email` missing or not matching a basic email regex → row marked `rowStatus: 'error'`, excluded from import
- All other fields: no client-side blocking validation

### Server-side (import step)

- `contacts.length > 2000` → HTTP 400 `{ "error": "Too many rows. Maximum is 2000." }`
- Invalid Zod parse on outer request body → HTTP 400 `{ "error": "Invalid request body" }`
- Per-row: `email` fails `z.string().email()` → row recorded in `errors[]` array, counted in `failed`, import continues for remaining rows (no HTTP 4xx for row-level failures)
- `firstName` / `lastName` default to `""` when absent (Prisma schema requires `String`, not `String?`)
- `status` defaults to `"lead"` if omitted or not in the allowed enum

---

## Architecture

### New Files

| Path | Purpose |
|------|---------|
| `app/admin/contacts/import/page.tsx` | 3-step import page (client component) |
| `app/api/contacts/bulk/route.ts` | POST endpoint — bulk create contacts |
| `lib/csv.ts` | CSV parsing utility — pure JS, no new npm deps |
| `components/admin/CsvImportTable.tsx` | Preview table component |

### Modified Files

| Path | Change |
|------|--------|
| `app/admin/contacts/page.tsx` | Add "Import Contacts" button alongside existing "Add Contact" in `PageHeader` `actions` prop |

### No New Dependencies

CSV parsing handled by pure-JS in `lib/csv.ts`. No new npm packages.

---

## `lib/csv.ts` — Interface

```typescript
/**
 * Parse a CSV string into an array of row objects keyed by lowercased header name.
 * Handles quoted fields (including fields containing commas or newlines).
 *
 * @param csvText  Raw CSV file contents as a string
 * @returns        Array of objects, one per data row. Keys are trimmed, lowercased header names.
 *                 Empty string if the CSV has no data rows (header only).
 */
export function parseCsv(csvText: string): Record<string, string>[]
```

---

## Data Types

### `ParsedContactRow`

```typescript
type ParsedContactRow = {
  // Raw CSV values (strings after parsing)
  firstName: string
  lastName: string
  email: string
  phone: string
  company: string
  jobTitle: string
  source: string
  status: string
  tags: string        // raw comma-separated string from CSV cell, e.g. "buyer,downtown"

  // Client-side validation result
  rowStatus: 'ready' | 'error'
  errorMessage?: string    // e.g. "Missing email", "Invalid email format"
  rowIndex: number         // 1-based data row number (row 1 = first data row after header)
}
```

### `CsvImportTable` props

```typescript
type CsvImportTableProps = {
  rows: ParsedContactRow[]
}
```

---

## API: `POST /api/contacts/bulk`

**Authentication:** Protected automatically by `middleware.ts` (JWT cookie check covers all `/api/contacts/*` paths). No explicit auth check needed in the route handler.

**Next.js body size:** The Pages Router `export const config = { api: { bodyParser: ... } }` syntax has no effect in the App Router. Instead, add a `content-length` guard inside the handler, and note that Vercel's default body limit is 4.5 MB — just under the 5 MB CSV limit. Implementer should verify the deployment platform's limit and adjust accordingly.

**Request body:**

```typescript
{
  contacts: Array<{
    firstName?: string
    lastName?: string
    email: string
    phone?: string
    company?: string
    jobTitle?: string
    source?: string
    status?: string
    tags?: string[]      // already split by the client, e.g. ["buyer", "downtown"]
    rowIndex: number     // 1-based original CSV row number, echoed back in errors
  }>
}
```

**Behavior:**

1. Validate `contacts.length ≤ 2000` — HTTP 400 if exceeded
2. Validate body shape with Zod
3. For each contact row:
   - Default `firstName` / `lastName` to `""` if absent
   - Default `status` to `"lead"` if absent or not in enum
   - Validate email with `z.string().email()` — add to `errors[]` and continue if invalid
   - Check for existing email: `prisma.contact.findUnique({ where: { email } })` — skip if found (increment `skipped`)
   - Create contact via `prisma.contact.create(...)`. Tags use the `connectOrCreate` pattern through the explicit `ContactTag` join table:
     ```typescript
     tags: {
       create: (tags ?? []).map(name => ({
         tag: {
           connectOrCreate: {
             where: { name },
             create: { name, color: '#6366f1' }
           }
         }
       }))
     }
     ```
     (`Tag` requires `name` and `color`; use `'#6366f1'` as default, matching schema default.)
4. Return summary

**Success response (HTTP 200):**

```json
{
  "imported": 47,
  "skipped": 3,
  "failed": 2,
  "errors": [
    { "row": 3, "email": "alice@", "reason": "Invalid email format" }
  ]
}
```

`row` is the original `rowIndex` value from the request (1-based CSV data row number).

**Error responses:**

- `400 { "error": "Too many rows. Maximum is 2000." }`
- `400 { "error": "Invalid request body" }`
- `500 { "error": "Import failed" }`

---

## UI Components

### `/admin/contacts/import/page.tsx`

- Client component (`'use client'`). Route protected by middleware; no in-component session check needed.
- State:
  - `step: 1 | 2 | 3`
  - `rows: ParsedContactRow[]`
  - `results: { imported: number; skipped: number; failed: number; errors: ... } | null`
  - `loading: boolean`
  - `fileError: string | null`
- **Step 1:** File input with drag-and-drop zone + template download (Blob download of hardcoded CSV string). Client checks file ≤ 5 MB before reading; shows `fileError` inline if too large or parse fails.
- **Step 2:** `<CsvImportTable rows={rows} />` with summary badges (Ready / Error counts). "Import N Contacts" button is **disabled** when `readyCount === 0`. On confirm, split `tags` strings by comma, include `rowIndex`, POST to `/api/contacts/bulk`. On API failure: `toast('error', 'Import failed', 'Please try again.')` and stay on step 2.
- **Step 3:** Result counts (imported / skipped / failed) + "Import Another" (reset to step 1) / "View Contacts" (`/admin/contacts`) buttons.
- Uses existing `Button`, `useToast`, and Tailwind conventions.

### `components/admin/CsvImportTable.tsx`

- Receives `rows: ParsedContactRow[]`
- Renders full-width table: #, Name, Email, Phone, Company, Status, Tags, Result
- Row background colors:
  - `bg-green-50` → `rowStatus === 'ready'`
  - `bg-red-50` → `rowStatus === 'error'`
- "Result" badge: green "✓ Ready" or red "✗ {errorMessage}"

### CSV Template Download

Hardcoded string, offered as a Blob download — no server endpoint needed:

```
firstName,lastName,email,phone,company,jobTitle,source,status,tags
Jane,Smith,jane@example.com,555-1234,Acme Corp,Realtor,referral,lead,"buyer,downtown"
```

---

## Error Handling

| Scenario | Handling |
|----------|---------|
| File > 5 MB | Client-side check, inline error, allow re-upload |
| Not a CSV / parse failure | Inline error, allow re-upload |
| Zero data rows (header only) | Inline message in step 2, Import button disabled |
| API network / server error | Error toast, stay on step 2 to retry |
| Per-row failures | Import continues; failures in `errors[]` on step 3 |

---

## Security

- Route protected by existing `middleware.ts` JWT cookie check
- Input validated server-side with Zod before any Prisma write
- No file stored server-side — CSV parsed in browser, JSON array sent to API
- Hard cap of 2,000 rows per request

---

## Out of Scope

- Update/merge existing contacts on duplicate (skip only)
- Column mapping UI (CSV must match expected header names)
- Async/background processing (import is synchronous)
- Progress bar during import
