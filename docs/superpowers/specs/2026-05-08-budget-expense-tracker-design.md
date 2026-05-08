# Budget & Expense Tracker — Design Spec
_Date: 2026-05-08_

## Overview

A full YNAB-style envelope budgeting module added to the admin section of the real estate web app. Tracks income and expenses, assigns money to grouped category envelopes, rolls unspent balances forward month to month, supports savings and spending-limit goals, allows receipt image uploads per transaction, and provides income/expense, spending-by-category, and net-worth reports.

### Income model
Income transactions are **never** assigned to a budget category. All income flows into a global "Ready to Assign" pool for the month. Category envelopes are funded only by explicit allocation (the Assigned column). This matches YNAB's design: income is logged for reporting but does not automatically fill any envelope.

### Standard API response envelope
All API routes return JSON in one of two shapes:
- **Success:** `{ data: <object or array> }` with the appropriate 2xx status
- **Error:** `{ error: string }` with the appropriate 4xx/5xx status

Specific response shapes are documented per endpoint below.

---

## Data Model

Five new Prisma models added to `prisma/schema.prisma`.

### `BudgetGroup`
A named container for related categories.

| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| name | String | e.g. "Marketing", "Professional Fees" |
| order | Int | display sort order |
| createdAt | DateTime | |
| updatedAt | DateTime | @updatedAt |

### `BudgetCategory`
A sub-category within a group. Carries optional goal configuration.

| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| groupId | String | FK → BudgetGroup |
| name | String | e.g. "Online Ads" |
| order | Int | display sort order within group |
| color | String | hex colour for UI; validated as `#RRGGBB` in API handler |
| goalType | String? | one of: `monthly_limit` \| `savings_target` \| null (no goal) |
| goalAmount | Float? | target dollar amount for the goal |
| goalTargetDate | DateTime? | deadline for savings_target goals |
| createdAt | DateTime | |
| updatedAt | DateTime | @updatedAt |

`goalType` is stored as a nullable String and validated in the API handler to one of the two allowed values. Prisma enums are avoided here because they require a migration ALTER TYPE on PostgreSQL — the app layer enforces the constraint instead.

### `BudgetAllocation`
The envelope amount assigned to a category for a specific month.

| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| categoryId | String | FK → BudgetCategory |
| month | String | `YYYY-MM` format |
| assigned | Float | amount assigned this month |
| note | String? | optional memo |
| createdAt | DateTime | |
| updatedAt | DateTime | |

`@@unique([categoryId, month])` — one allocation per category per month.

Roll-forward is computed at query time: `available = Σ(assigned, all months ≤ current) − Σ(expenses, all months ≤ current)`. Nothing is stored redundantly.

### `Transaction`
A single income or expense record.

| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| type | String | `income` \| `expense` |
| categoryId | String? | FK → BudgetCategory; always null for income; required for expense |
| amount | Float | always positive |
| date | DateTime | transaction date |
| payee | String? | vendor / payer name |
| notes | String? | memo |
| receiptUrl | String? | path returned by `/api/uploads` (e.g. `/uploads/uuid.jpg`) |
| createdAt | DateTime | |
| updatedAt | DateTime | |

Income transactions always have `categoryId = null`. The API handler enforces this: if `type = 'income'` and `categoryId` is provided, it is silently ignored and stored as null. Expense transactions require `categoryId` — the handler returns 400 if missing.

### `NetWorthEntry`
A manual monthly snapshot of assets and liabilities.

| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| month | String | `YYYY-MM` format |
| assets | String | JSON array of `{label: string, amount: number}` |
| liabilities | String | JSON array of `{label: string, amount: number}` |
| createdAt | DateTime | |
| updatedAt | DateTime | |

`@@unique([month])` — one entry per month.

---

## API Routes

All routes require `getSession()` and return 401 if unauthenticated. All responses follow `{ data: ... }` on success, `{ error: string }` on failure.

### Budget Groups

**`GET /api/budget/groups`**
Returns all groups with their categories sorted by `order`.
```json
{ "data": [{ "id": "...", "name": "Marketing", "order": 0, "categories": [{ "id": "...", "name": "Online Ads", "color": "#...", "order": 0, "goalType": "monthly_limit", "goalAmount": 500, "goalTargetDate": null }] }] }
```

**`POST /api/budget/groups`** — Body: `{ name: string }`
Returns: `{ "data": { id, name, order, createdAt } }` — order defaults to `max(existing) + 1`.

**`PATCH /api/budget/groups/[id]`** — Body: `{ name?: string, order?: number }`
Returns: `{ "data": <updated group> }`

**`DELETE /api/budget/groups/[id]`**
Cascades to all categories in the group. Categories with existing transactions: their transactions have `categoryId` set to null (SET NULL on delete). Allocations for deleted categories are hard-deleted. Returns `{ "data": { deleted: true } }`.

### Budget Categories

**`POST /api/budget/categories`** — Body: `{ groupId, name, color?, goalType?, goalAmount?, goalTargetDate? }`
Returns: `{ "data": <created category> }` — order defaults to `max within group + 1`.

**`PATCH /api/budget/categories/[id]`** — Body: `{ name?, color?, order?, goalType?, goalAmount?, goalTargetDate? }`
`goalType` must be `'monthly_limit'`, `'savings_target'`, or `null` — returns 400 otherwise.
Returns: `{ "data": <updated category> }`

**`DELETE /api/budget/categories/[id]`**
Transactions referencing this category have `categoryId` set to null (SET NULL). Allocations are hard-deleted. Returns `{ "data": { deleted: true } }`.

### Allocations

**`GET /api/budget/allocations?month=YYYY-MM`**
Returns all categories with their allocation for that month and computed `activity` and `available`:
```json
{
  "data": {
    "readyToAssign": 1200.00,
    "categories": [{
      "categoryId": "...",
      "month": "2026-05",
      "assigned": 300.00,
      "activity": 125.50,
      "available": 641.00,
      "note": null
    }]
  }
}
```
- `activity` = sum of expense transactions for this category where `date` falls in month M
- `available` = Σ(assigned, all months ≤ M) − Σ(expense amounts, all months ≤ M for this category)
- `readyToAssign` = Σ(income amounts, date in month M) − Σ(assigned, month = M across all categories)

**`POST /api/budget/allocations`** — Body: `{ categoryId, month, assigned, note? }`
Upserts (creates or updates) the allocation for that categoryId+month pair.
Returns: `{ "data": <allocation record with computed activity and available> }`

### Transactions

**`GET /api/budget/transactions`**
Query params: `month` (YYYY-MM), `type` (income|expense), `categoryId`, `payee` (substring search), `page` (default 1), `limit` (default 50, max 200), `sort` (date_desc|date_asc|amount_desc|amount_asc — default date_desc).
Returns:
```json
{ "data": { "items": [{ "id", "type", "categoryId", "categoryName", "amount", "date", "payee", "notes", "receiptUrl", "createdAt" }], "total": 142, "page": 1, "limit": 50 } }
```

**`POST /api/budget/transactions`** — Body: `{ type, categoryId?, amount, date, payee?, notes?, receiptUrl? }`
Validates: `type` must be `income` or `expense`; `amount` must be > 0; `categoryId` required when `type = 'expense'`.
Returns: `{ "data": <created transaction> }`

**`PATCH /api/budget/transactions/[id]`** — Body: same optional fields
Returns: `{ "data": <updated transaction> }`

**`DELETE /api/budget/transactions/[id]`**
Returns: `{ "data": { deleted: true } }`

### Reports

**`GET /api/budget/reports/spending?from=YYYY-MM&to=YYYY-MM`**
Returns total expenses per category for the date range:
```json
{ "data": [{ "categoryId", "categoryName", "groupName", "color", "total": 450.00 }] }
```

**`GET /api/budget/reports/income-expenses?from=YYYY-MM&to=YYYY-MM`**
Returns per-month totals for the range. Months with no activity are included with zeros:
```json
{ "data": [{ "month": "2026-01", "income": 8000, "expenses": 3200, "net": 4800 }] }
```

### Net Worth

**`GET /api/budget/networth`**
Returns all entries sorted by month ascending:
```json
{ "data": [{ "id", "month", "assets": [{...}], "liabilities": [{...}], "totalAssets": 250000, "totalLiabilities": 180000, "netWorth": 70000 }] }
```
`totalAssets`, `totalLiabilities`, and `netWorth` are computed server-side from the JSON arrays.

**`POST /api/budget/networth`** — Body: `{ month, assets: [{label, amount}], liabilities: [{label, amount}] }`
Upserts (one entry per month). Returns: `{ "data": <entry with computed totals> }`

Receipt uploads reuse the existing **`POST /api/uploads`** endpoint. No new upload route needed.

---

## Navigation

`components/navigation/Sidebar.tsx` gets a new nav item:

```
{ label: 'Budget', href: '/admin/budget', icon: Wallet }
```

Inserted between "Activities" and "Listings".

---

## Page Structure

### `/admin/budget` (server component shell)

Wraps in `DashboardLayout` + `PageHeader`. Renders `BudgetManager` client component which owns the three-tab UI.

### Tab 1: Budget

- Month navigator (← YYYY-MM →) at top
- "Ready to Assign" banner: `total income this month − total assigned this month`; turns red if negative
- Grouped category rows, each showing: **Category name | Assigned | Activity | Available**
- Available cell is green if positive, yellow if near goal limit, red if over limit
- Click a row → inline side panel with:
  - Amount field to assign (updates on blur/enter via PATCH `/api/budget/allocations`)
  - Goal progress bar (for monthly_limit: spent/limit; for savings_target: available/goalAmount with days-remaining)
  - Goal edit shortcut
- "Add Group" and "Add Category" buttons for setup

### Tab 2: Transactions

- Filter bar: month picker (defaults to current month), type toggle (All / Income / Expense), category dropdown, payee text search
- Table columns: Date | Payee | Category | Amount | Receipt — sortable by Date and Amount only (client-side toggle, default date desc)
- Receipt column shows a small image thumbnail if `receiptUrl` is set; clicking opens the image in a lightbox (full-screen overlay). PDF receipts show a document icon instead of a thumbnail; clicking opens the PDF in a new tab.
- "Add Transaction" button → modal form (full-screen drawer on mobile, centred modal on desktop):
  - Date (date picker, defaults to today)
  - Type toggle: **Income / Expense** — when Income is selected, the Category field is hidden entirely (income is never categorized)
  - Payee (text input)
  - Amount (number input, must be > 0)
  - Category (grouped select — visible only when type = Expense; required)
  - Notes (textarea, optional)
  - Receipt: a drop zone that accepts drag-and-drop on desktop; on mobile renders an `<input accept="image/*,application/pdf" capture="environment">` to open the camera directly. File is uploaded immediately to `/api/uploads` on selection; thumbnail renders in the drop zone on success. Upload failure shows a toast but does not block saving the transaction.
- Edit mode: clicking any row opens the same modal pre-populated with that transaction's data

### Tab 3: Reports

Three pill-button sub-views:

**Spending by Category**
- Horizontal bar chart (Recharts) — one bar per category, colour-coded by group
- Month-range filter (start month → end month)
- Table below chart with totals

**Income vs. Expenses**
- Combo chart: grouped bars (income, expenses) per month + net line
- Defaults to last 12 months; adjustable range

**Net Worth**
- Line chart of `total assets − total liabilities` over all recorded months
- Below the chart: a form for the current month's entry — free-form asset rows (label + amount) and liability rows, with add/remove buttons; saves on submit to `/api/budget/networth`

---

## Receipt Upload Detail

The receipt field in the transaction modal:

1. User drops a file or clicks the zone (or taps the camera button on mobile)
2. Client immediately POSTs `multipart/form-data` to `/api/uploads`
3. On success, stores the returned `url` in component state
4. Thumbnail renders in the drop zone
5. On transaction save, `receiptUrl` is included in the POST/PATCH body
6. Accepts: jpg, jpeg, png, webp, pdf — up to 10 MB (matches existing upload API)

---

## Roll-Forward Logic

No stored carry-forward field. Income does not affect category available balances — it only contributes to "Ready to Assign." For any given month M and category C:

```
available(C, M) =
  SUM(allocation.assigned WHERE categoryId=C AND month <= M)
  − SUM(transaction.amount WHERE categoryId=C AND type='expense'
        AND date >= '(earliest month with any allocation for C)-01'
        AND date <= last day of M)

readyToAssign(M) =
  SUM(transaction.amount WHERE type='income' AND date in month M)
  − SUM(allocation.assigned WHERE month = M)
```

Both aggregations run in the `/api/budget/allocations?month=M` handler in a single Prisma `groupBy` + `aggregate` pass over all categories at once. Backfilled transactions automatically affect all future months correctly without any stored state.

"Ready to Assign" going negative (more assigned than income received) is allowed — it turns the banner red as a warning.

---

## Goal Rendering

| Goal type | Progress bar | Status colour |
|---|---|---|
| `monthly_limit` | activity / goalAmount | green → yellow at 80% → red at 100%+ |
| `savings_target` | available / goalAmount | green; shows "X days left" near target date |
| `none` | hidden | — |

---

## Error Handling

- All API routes return structured `{ error: string }` on failure with appropriate HTTP status codes
- The transaction modal shows inline validation errors (required fields, negative amounts)
- Receipt upload failures show a toast and leave the field empty; transaction can still be saved without a receipt
- Roll-forward queries are wrapped in try/catch; a failed report shows an error state rather than crashing the page

---

## Out of Scope (this iteration)

- Multi-user budget (all data is agent-scoped, no per-user isolation)
- CSV import/export
- Bank feed / Plaid integration
- Mobile-native app
- Budget templates (pre-built category sets) — user builds categories manually
