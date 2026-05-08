# Budget & Expense Tracker Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a full YNAB-style budget & expense tracker to the admin section with envelope budgeting, roll-forward balances, receipt image uploads, goals, and income/spending/net-worth reports.

**Architecture:** Five new Prisma models (BudgetGroup, BudgetCategory, BudgetAllocation, Transaction, NetWorthEntry) back twelve new API routes. The admin page at `/admin/budget` is a server component shell wrapping a single `BudgetManager` client component that owns the three-tab UI (Budget, Transactions, Reports). Roll-forward is computed at query time from cumulative aggregations — no stored carry-forward field. Income never touches category envelopes; it feeds a "Ready to Assign" pool only.

**Tech Stack:** Next.js 16 App Router, TypeScript, Prisma + PostgreSQL, Tailwind (`charcoal-*`/`gold-*`), Recharts (already installed), lucide-react, existing `/api/uploads` for receipts, existing `Modal` component from `@/components/ui`.

---

## File Map

### New files
| File | Responsibility |
|---|---|
| `prisma/schema.prisma` | +5 new models |
| `app/api/budget/groups/route.ts` | GET list, POST create group |
| `app/api/budget/groups/[id]/route.ts` | PATCH update, DELETE group |
| `app/api/budget/categories/route.ts` | POST create category |
| `app/api/budget/categories/[id]/route.ts` | PATCH update, DELETE category |
| `app/api/budget/allocations/route.ts` | GET with roll-forward, POST upsert |
| `app/api/budget/transactions/route.ts` | GET paginated list, POST create |
| `app/api/budget/transactions/[id]/route.ts` | PATCH update, DELETE |
| `app/api/budget/reports/spending/route.ts` | GET spending by category |
| `app/api/budget/reports/income-expenses/route.ts` | GET monthly income vs expenses |
| `app/api/budget/networth/route.ts` | GET list, POST upsert |
| `app/admin/budget/page.tsx` | Server component shell |
| `components/budget/BudgetManager.tsx` | Client tab container |
| `components/budget/BudgetTab.tsx` | Envelope grid for current month |
| `components/budget/AllocationPanel.tsx` | Side panel: assign amount + goal |
| `components/budget/TransactionsTab.tsx` | Transaction table + filters |
| `components/budget/TransactionModal.tsx` | Add/edit transaction modal |
| `components/budget/ReceiptUpload.tsx` | Drop zone + camera input |
| `components/budget/ReportsTab.tsx` | All three report sub-views |
| `components/budget/index.ts` | Barrel exports |

### Modified files
| File | Change |
|---|---|
| `components/navigation/Sidebar.tsx` | Add Budget nav item |

---

## Chunk 1: Database Schema

### Task 1: Add five Prisma models to schema

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Open `prisma/schema.prisma` and append the five new models at the end of the file, before the final closing line**

Add this block (all five models together):

```prisma
// ─── Budget & Expense Tracker ─────────────────────────────────────────────────

model BudgetGroup {
  id         String           @id @default(cuid())
  name       String
  order      Int              @default(0)
  createdAt  DateTime         @default(now())
  updatedAt  DateTime         @updatedAt
  categories BudgetCategory[]

  @@map("budget_groups")
}

model BudgetCategory {
  id             String             @id @default(cuid())
  groupId        String
  group          BudgetGroup        @relation(fields: [groupId], references: [id], onDelete: Cascade)
  name           String
  order          Int                @default(0)
  color          String             @default("#6366f1")
  goalType       String?            // monthly_limit | savings_target
  goalAmount     Float?
  goalTargetDate DateTime?
  createdAt      DateTime           @default(now())
  updatedAt      DateTime           @updatedAt
  allocations    BudgetAllocation[]
  transactions   Transaction[]

  @@map("budget_categories")
}

model BudgetAllocation {
  id         String         @id @default(cuid())
  categoryId String
  category   BudgetCategory @relation(fields: [categoryId], references: [id], onDelete: Cascade)
  month      String         // YYYY-MM
  assigned   Float          @default(0)
  note       String?
  createdAt  DateTime       @default(now())
  updatedAt  DateTime       @updatedAt

  @@unique([categoryId, month])
  @@index([month])
  @@map("budget_allocations")
}

model Transaction {
  id         String          @id @default(cuid())
  type       String          // income | expense
  categoryId String?
  category   BudgetCategory? @relation(fields: [categoryId], references: [id], onDelete: SetNull)
  amount     Float
  date       DateTime
  payee      String?
  notes      String?
  receiptUrl String?
  createdAt  DateTime        @default(now())
  updatedAt  DateTime        @updatedAt

  @@index([type, date])
  @@index([categoryId, date])
  @@map("transactions")
}

model NetWorthEntry {
  id          String   @id @default(cuid())
  month       String   @unique // YYYY-MM
  assets      String   // JSON: [{label: string, amount: number}]
  liabilities String   // JSON: [{label: string, amount: number}]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@map("net_worth_entries")
}
```

- [ ] **Step 2: Push schema to the database**

**Development (local):**
```bash
npx prisma db push
```

**Production (Docker):**
```bash
docker compose exec app node node_modules/prisma/build/index.js db push
```

Expected output: `Your database is now in sync with your Prisma schema.`
A harmless `EACCES unlink index.js` error may follow — the schema was already applied.

- [ ] **Step 3: Verify the generated client sees the new models**

```bash
node -e "const { PrismaClient } = require('./node_modules/@prisma/client'); const p = new PrismaClient(); console.log(typeof p.budgetGroup, typeof p.budgetCategory, typeof p.budgetAllocation, typeof p.transaction, typeof p.netWorthEntry)"
```

Expected: `function function function function function`

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: add budget tracker prisma models"
```

---

## Chunk 2: Groups & Categories API

### Task 2: Budget groups API routes

**Files:**
- Create: `app/api/budget/groups/route.ts`
- Create: `app/api/budget/groups/[id]/route.ts`

- [ ] **Step 1: Create `app/api/budget/groups/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const groups = await prisma.budgetGroup.findMany({
    orderBy: { order: 'asc' },
    include: { categories: { orderBy: { order: 'asc' } } },
  })
  return NextResponse.json({ data: groups })
}

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { name } = body
  if (!name?.trim()) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  }

  const maxOrder = await prisma.budgetGroup.aggregate({ _max: { order: true } })
  const order = (maxOrder._max.order ?? -1) + 1

  const group = await prisma.budgetGroup.create({
    data: { name: name.trim(), order },
    include: { categories: true },
  })
  return NextResponse.json({ data: group }, { status: 201 })
}
```

- [ ] **Step 2: Create `app/api/budget/groups/[id]/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { name, order } = await request.json()

  const group = await prisma.budgetGroup.update({
    where: { id },
    data: {
      ...(name !== undefined && { name: name.trim() }),
      ...(order !== undefined && { order }),
    },
    include: { categories: { orderBy: { order: 'asc' } } },
  })
  return NextResponse.json({ data: group })
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  // Cascade: categories → allocations hard-deleted; transactions → categoryId SET NULL
  await prisma.budgetGroup.delete({ where: { id } })
  return NextResponse.json({ data: { deleted: true } })
}
```

- [ ] **Step 3: Smoke-test the groups API manually**

```bash
# Create a group
curl -s -X POST http://localhost:3000/api/budget/groups \
  -H "Content-Type: application/json" \
  -b "your-session-cookie" \
  -d '{"name":"Marketing"}' | python -m json.tool

# List groups
curl -s http://localhost:3000/api/budget/groups \
  -b "your-session-cookie" | python -m json.tool
```

Expected: POST returns `{ data: { id, name: "Marketing", order: 0, categories: [] } }`. GET returns the same group in an array.

- [ ] **Step 4: Commit**

```bash
git add app/api/budget/groups/
git commit -m "feat: add budget groups API (GET, POST, PATCH, DELETE)"
```

### Task 3: Budget categories API routes

**Files:**
- Create: `app/api/budget/categories/route.ts`
- Create: `app/api/budget/categories/[id]/route.ts`

- [ ] **Step 1: Create `app/api/budget/categories/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const VALID_GOAL_TYPES = new Set(['monthly_limit', 'savings_target'])
const HEX_RE = /^#[0-9A-Fa-f]{6}$/

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { groupId, name, color, goalType, goalAmount, goalTargetDate } = await request.json()

  if (!groupId || !name?.trim()) {
    return NextResponse.json({ error: 'groupId and name are required' }, { status: 400 })
  }
  if (color && !HEX_RE.test(color)) {
    return NextResponse.json({ error: 'color must be a valid hex color (#RRGGBB)' }, { status: 400 })
  }
  if (goalType != null && !VALID_GOAL_TYPES.has(goalType)) {
    return NextResponse.json({ error: 'goalType must be monthly_limit, savings_target, or null' }, { status: 400 })
  }

  const maxOrder = await prisma.budgetCategory.aggregate({
    where: { groupId },
    _max: { order: true },
  })
  const order = (maxOrder._max.order ?? -1) + 1

  const category = await prisma.budgetCategory.create({
    data: {
      groupId,
      name: name.trim(),
      color: color ?? '#6366f1',
      order,
      goalType: goalType ?? null,
      goalAmount: goalAmount ?? null,
      goalTargetDate: goalTargetDate ? new Date(goalTargetDate) : null,
    },
  })
  return NextResponse.json({ data: category }, { status: 201 })
}
```

- [ ] **Step 2: Create `app/api/budget/categories/[id]/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const VALID_GOAL_TYPES = new Set(['monthly_limit', 'savings_target'])
const HEX_RE = /^#[0-9A-Fa-f]{6}$/

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { name, color, order, goalType, goalAmount, goalTargetDate } = await request.json()

  if (color !== undefined && !HEX_RE.test(color)) {
    return NextResponse.json({ error: 'color must be a valid hex color (#RRGGBB)' }, { status: 400 })
  }
  if (goalType !== undefined && goalType !== null && !VALID_GOAL_TYPES.has(goalType)) {
    return NextResponse.json({ error: 'goalType must be monthly_limit, savings_target, or null' }, { status: 400 })
  }

  const category = await prisma.budgetCategory.update({
    where: { id },
    data: {
      ...(name !== undefined && { name: name.trim() }),
      ...(color !== undefined && { color }),
      ...(order !== undefined && { order }),
      ...(goalType !== undefined && { goalType }),
      ...(goalAmount !== undefined && { goalAmount }),
      ...(goalTargetDate !== undefined && {
        goalTargetDate: goalTargetDate ? new Date(goalTargetDate) : null,
      }),
    },
  })
  return NextResponse.json({ data: category })
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  // Allocations cascade-deleted; transactions get categoryId SET NULL
  await prisma.budgetCategory.delete({ where: { id } })
  return NextResponse.json({ data: { deleted: true } })
}
```

- [ ] **Step 3: Smoke-test categories**

```bash
# Replace GROUP_ID with an actual id from the GET /api/budget/groups response
curl -s -X POST http://localhost:3000/api/budget/categories \
  -H "Content-Type: application/json" \
  -b "your-session-cookie" \
  -d '{"groupId":"GROUP_ID","name":"Online Ads","color":"#f59e0b"}' | python -m json.tool
```

Expected: `{ data: { id, groupId, name: "Online Ads", color: "#f59e0b", order: 0, goalType: null, ... } }`

- [ ] **Step 4: Commit**

```bash
git add app/api/budget/categories/
git commit -m "feat: add budget categories API (POST, PATCH, DELETE)"
```

---

## Chunk 3: Allocations & Transactions API

### Task 4: Allocations API — GET with roll-forward + POST upsert

**Files:**
- Create: `app/api/budget/allocations/route.ts`

The `GET` handler is the most complex route in this feature. It runs six parallel queries and computes `available` (cumulative roll-forward) and `activity` (this month's spending) for every category, plus `readyToAssign`.

- [ ] **Step 1: Create `app/api/budget/allocations/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function monthBounds(month: string) {
  const [y, m] = month.split('-').map(Number)
  const start = new Date(y, m - 1, 1)
  const end = new Date(y, m, 0, 23, 59, 59, 999)
  return { start, end }
}

export async function GET(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const month = searchParams.get('month')
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: 'month param required (YYYY-MM)' }, { status: 400 })
  }

  const { start, end } = monthBounds(month)

  const [
    allAllocations,
    allExpenses,
    monthlyExpenses,
    monthlyIncome,
    monthlyAssigned,
    thisMonthAllocations,
    categories,
  ] = await Promise.all([
    // Cumulative assigned per category up to this month (roll-forward numerator)
    prisma.budgetAllocation.groupBy({
      by: ['categoryId'],
      where: { month: { lte: month } },
      _sum: { assigned: true },
    }),
    // Cumulative expenses per category up to end of this month (roll-forward denominator)
    prisma.transaction.groupBy({
      by: ['categoryId'],
      where: { type: 'expense', categoryId: { not: null }, date: { lte: end } },
      _sum: { amount: true },
    }),
    // This month's expenses per category (Activity column)
    prisma.transaction.groupBy({
      by: ['categoryId'],
      where: { type: 'expense', categoryId: { not: null }, date: { gte: start, lte: end } },
      _sum: { amount: true },
    }),
    // Total income logged this month (feeds Ready to Assign)
    prisma.transaction.aggregate({
      where: { type: 'income', date: { gte: start, lte: end } },
      _sum: { amount: true },
    }),
    // Total assigned across all categories this month
    prisma.budgetAllocation.aggregate({
      where: { month },
      _sum: { assigned: true },
    }),
    // This month's allocation records (for assigned value + note per category)
    prisma.budgetAllocation.findMany({ where: { month } }),
    // All categories
    prisma.budgetCategory.findMany({ orderBy: { order: 'asc' } }),
  ])

  const totalIncome = monthlyIncome._sum.amount ?? 0
  const totalAssigned = monthlyAssigned._sum.assigned ?? 0

  const cumAssigned = new Map(allAllocations.map(a => [a.categoryId, a._sum.assigned ?? 0]))
  const cumExpenses = new Map(allExpenses.map(e => [e.categoryId!, e._sum.amount ?? 0]))
  const monthActivity = new Map(monthlyExpenses.map(e => [e.categoryId!, e._sum.amount ?? 0]))
  const thisMonthMap = new Map(thisMonthAllocations.map(a => [a.categoryId, a]))

  const categoryData = categories.map(cat => {
    const alloc = thisMonthMap.get(cat.id)
    return {
      categoryId: cat.id,
      month,
      assigned: alloc?.assigned ?? 0,
      activity: monthActivity.get(cat.id) ?? 0,
      available: (cumAssigned.get(cat.id) ?? 0) - (cumExpenses.get(cat.id) ?? 0),
      note: alloc?.note ?? null,
    }
  })

  return NextResponse.json({
    data: {
      readyToAssign: totalIncome - totalAssigned,
      categories: categoryData,
    },
  })
}

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { categoryId, month, assigned, note } = await request.json()

  if (!categoryId || !month) {
    return NextResponse.json({ error: 'categoryId and month are required' }, { status: 400 })
  }
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: 'month must be YYYY-MM' }, { status: 400 })
  }
  if (typeof assigned !== 'number' || assigned < 0) {
    return NextResponse.json({ error: 'assigned must be a non-negative number' }, { status: 400 })
  }

  const allocation = await prisma.budgetAllocation.upsert({
    where: { categoryId_month: { categoryId, month } },
    create: { categoryId, month, assigned, note: note ?? null },
    update: { assigned, note: note ?? null },
  })

  const { start, end } = monthBounds(month)
  const [cumA, cumE, monthE] = await Promise.all([
    prisma.budgetAllocation.aggregate({
      where: { categoryId, month: { lte: month } },
      _sum: { assigned: true },
    }),
    prisma.transaction.aggregate({
      where: { type: 'expense', categoryId, date: { lte: end } },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { type: 'expense', categoryId, date: { gte: start, lte: end } },
      _sum: { amount: true },
    }),
  ])

  return NextResponse.json({
    data: {
      ...allocation,
      activity: monthE._sum.amount ?? 0,
      available: (cumA._sum.assigned ?? 0) - (cumE._sum.amount ?? 0),
    },
  })
}
```

- [ ] **Step 2: Smoke-test allocations**

```bash
# Check budget data for current month (replace YYYY-MM)
curl -s "http://localhost:3000/api/budget/allocations?month=2026-05" \
  -b "your-session-cookie" | python -m json.tool
```

Expected: `{ data: { readyToAssign: 0, categories: [...] } }` — categories array has one entry per category with assigned=0, activity=0, available=0 (all zero since no data yet).

- [ ] **Step 3: Commit**

```bash
git add app/api/budget/allocations/
git commit -m "feat: add allocations API with roll-forward computation"
```

### Task 5: Transactions API — list/create + update/delete

**Files:**
- Create: `app/api/budget/transactions/route.ts`
- Create: `app/api/budget/transactions/[id]/route.ts`

- [ ] **Step 1: Create `app/api/budget/transactions/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function monthBounds(month: string) {
  const [y, m] = month.split('-').map(Number)
  return { start: new Date(y, m - 1, 1), end: new Date(y, m, 0, 23, 59, 59, 999) }
}

const SORT_MAP: Record<string, object> = {
  date_desc:   { date: 'desc' },
  date_asc:    { date: 'asc' },
  amount_desc: { amount: 'desc' },
  amount_asc:  { amount: 'asc' },
}

export async function GET(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const month      = searchParams.get('month')
  const type       = searchParams.get('type')
  const categoryId = searchParams.get('categoryId')
  const payee      = searchParams.get('payee')
  const page       = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const limit      = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') ?? '50')))
  const sort       = searchParams.get('sort') ?? 'date_desc'

  const where: Record<string, unknown> = {}
  if (month) {
    const { start, end } = monthBounds(month)
    where.date = { gte: start, lte: end }
  }
  if (type === 'income' || type === 'expense') where.type = type
  if (categoryId) where.categoryId = categoryId
  if (payee) where.payee = { contains: payee, mode: 'insensitive' }

  const [items, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      orderBy: SORT_MAP[sort] ?? SORT_MAP.date_desc,
      skip: (page - 1) * limit,
      take: limit,
      include: { category: { select: { name: true } } },
    }),
    prisma.transaction.count({ where }),
  ])

  return NextResponse.json({
    data: {
      items: items.map(t => ({
        id:           t.id,
        type:         t.type,
        categoryId:   t.categoryId,
        categoryName: t.category?.name ?? null,
        amount:       t.amount,
        date:         t.date,
        payee:        t.payee,
        notes:        t.notes,
        receiptUrl:   t.receiptUrl,
        createdAt:    t.createdAt,
      })),
      total,
      page,
      limit,
    },
  })
}

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { type, categoryId, amount, date, payee, notes, receiptUrl } = await request.json()

  if (!['income', 'expense'].includes(type)) {
    return NextResponse.json({ error: 'type must be income or expense' }, { status: 400 })
  }
  if (typeof amount !== 'number' || amount <= 0) {
    return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 })
  }
  if (!date) {
    return NextResponse.json({ error: 'date is required' }, { status: 400 })
  }
  if (type === 'expense' && !categoryId) {
    return NextResponse.json({ error: 'categoryId is required for expense transactions' }, { status: 400 })
  }

  const transaction = await prisma.transaction.create({
    data: {
      type,
      categoryId: type === 'income' ? null : categoryId,
      amount,
      date: new Date(date),
      payee:      payee ?? null,
      notes:      notes ?? null,
      receiptUrl: receiptUrl ?? null,
    },
    include: { category: { select: { name: true } } },
  })

  return NextResponse.json({
    data: { ...transaction, categoryName: transaction.category?.name ?? null },
  }, { status: 201 })
}
```

- [ ] **Step 2: Create `app/api/budget/transactions/[id]/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { type, categoryId, amount, date, payee, notes, receiptUrl } = await request.json()

  if (type !== undefined && !['income', 'expense'].includes(type)) {
    return NextResponse.json({ error: 'type must be income or expense' }, { status: 400 })
  }
  if (amount !== undefined && (typeof amount !== 'number' || amount <= 0)) {
    return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 })
  }

  const existing = await prisma.transaction.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const effectiveType = type ?? existing.type
  const effectiveCategoryId = effectiveType === 'income'
    ? null
    : (categoryId !== undefined ? categoryId : existing.categoryId)

  if (effectiveType === 'expense' && !effectiveCategoryId) {
    return NextResponse.json({ error: 'categoryId is required for expense transactions' }, { status: 400 })
  }

  const transaction = await prisma.transaction.update({
    where: { id },
    data: {
      ...(type !== undefined && { type }),
      categoryId: effectiveCategoryId,
      ...(amount !== undefined && { amount }),
      ...(date !== undefined && { date: new Date(date) }),
      ...(payee !== undefined && { payee }),
      ...(notes !== undefined && { notes }),
      ...(receiptUrl !== undefined && { receiptUrl }),
    },
    include: { category: { select: { name: true } } },
  })

  return NextResponse.json({
    data: { ...transaction, categoryName: transaction.category?.name ?? null },
  })
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  await prisma.transaction.delete({ where: { id } })
  return NextResponse.json({ data: { deleted: true } })
}
```

- [ ] **Step 3: Smoke-test transactions**

```bash
# Log an income transaction (replace YYYY-MM-DD with today's date)
curl -s -X POST http://localhost:3000/api/budget/transactions \
  -H "Content-Type: application/json" \
  -b "your-session-cookie" \
  -d '{"type":"income","amount":5000,"date":"2026-05-01","payee":"Commission - 123 Main St"}' \
  | python -m json.tool

# List transactions for current month
curl -s "http://localhost:3000/api/budget/transactions?month=2026-05" \
  -b "your-session-cookie" | python -m json.tool
```

Expected: income transaction created with `categoryId: null`. List returns `{ data: { items: [...], total: 1, page: 1, limit: 50 } }`.

- [ ] **Step 4: Commit**

```bash
git add app/api/budget/transactions/
git commit -m "feat: add transactions API (list, create, update, delete)"
```

---

## Chunk 4: Reports & Net Worth API

### Task 6: Spending by category report

**Files:**
- Create: `app/api/budget/reports/spending/route.ts`

- [ ] **Step 1: Create the file**

```typescript
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const from = searchParams.get('from')
  const to   = searchParams.get('to')

  if (!from || !to || !/^\d{4}-\d{2}$/.test(from) || !/^\d{4}-\d{2}$/.test(to)) {
    return NextResponse.json({ error: 'from and to params required (YYYY-MM)' }, { status: 400 })
  }

  const [fy, fm] = from.split('-').map(Number)
  const [ty, tm] = to.split('-').map(Number)
  const startDate = new Date(fy, fm - 1, 1)
  const endDate   = new Date(ty, tm, 0, 23, 59, 59, 999)

  const [expenses, categories] = await Promise.all([
    prisma.transaction.groupBy({
      by: ['categoryId'],
      where: { type: 'expense', categoryId: { not: null }, date: { gte: startDate, lte: endDate } },
      _sum: { amount: true },
      orderBy: { _sum: { amount: 'desc' } },
    }),
    prisma.budgetCategory.findMany({ include: { group: { select: { name: true } } } }),
  ])

  const catMap = new Map(categories.map(c => [c.id, c]))

  const data = expenses.map(e => {
    const cat = catMap.get(e.categoryId!)
    return {
      categoryId:   e.categoryId,
      categoryName: cat?.name ?? 'Unknown',
      groupName:    cat?.group.name ?? 'Unknown',
      color:        cat?.color ?? '#6366f1',
      total:        e._sum.amount ?? 0,
    }
  })

  return NextResponse.json({ data })
}
```

- [ ] **Step 2: Smoke-test**

```bash
curl -s "http://localhost:3000/api/budget/reports/spending?from=2026-01&to=2026-05" \
  -b "your-session-cookie" | python -m json.tool
```

Expected: `{ data: [] }` if no expense transactions exist yet, or an array of category totals.

### Task 7: Income vs expenses report

**Files:**
- Create: `app/api/budget/reports/income-expenses/route.ts`

- [ ] **Step 1: Create the file**

```typescript
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function eachMonthInRange(from: string, to: string): string[] {
  const months: string[] = []
  const [fy, fm] = from.split('-').map(Number)
  const [ty, tm] = to.split('-').map(Number)
  let y = fy, m = fm
  while (y < ty || (y === ty && m <= tm)) {
    months.push(`${y}-${String(m).padStart(2, '0')}`)
    m++; if (m > 12) { m = 1; y++ }
  }
  return months
}

export async function GET(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const from = searchParams.get('from')
  const to   = searchParams.get('to')

  if (!from || !to || !/^\d{4}-\d{2}$/.test(from) || !/^\d{4}-\d{2}$/.test(to)) {
    return NextResponse.json({ error: 'from and to params required (YYYY-MM)' }, { status: 400 })
  }

  const months = eachMonthInRange(from, to)

  const [fy, fm] = from.split('-').map(Number)
  const [ty, tm] = to.split('-').map(Number)
  const startDate = new Date(fy, fm - 1, 1)
  const endDate   = new Date(ty, tm, 0, 23, 59, 59, 999)

  const transactions = await prisma.transaction.findMany({
    where: { date: { gte: startDate, lte: endDate } },
    select: { type: true, amount: true, date: true },
  })

  const incomeMap  = new Map<string, number>()
  const expenseMap = new Map<string, number>()
  for (const t of transactions) {
    const key = `${t.date.getFullYear()}-${String(t.date.getMonth() + 1).padStart(2, '0')}`
    if (t.type === 'income') incomeMap.set(key, (incomeMap.get(key) ?? 0) + t.amount)
    else expenseMap.set(key, (expenseMap.get(key) ?? 0) + t.amount)
  }

  const data = months.map(m => {
    const income   = incomeMap.get(m) ?? 0
    const expenses = expenseMap.get(m) ?? 0
    return { month: m, income, expenses, net: income - expenses }
  })

  return NextResponse.json({ data })
}
```

### Task 8: Net worth API

**Files:**
- Create: `app/api/budget/networth/route.ts`

- [ ] **Step 1: Create the file**

```typescript
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type MoneyItem = { label: string; amount: number }

function computeTotals(entry: { assets: string; liabilities: string }) {
  const assets:      MoneyItem[] = JSON.parse(entry.assets)
  const liabilities: MoneyItem[] = JSON.parse(entry.liabilities)
  const totalAssets      = assets.reduce((s, a) => s + a.amount, 0)
  const totalLiabilities = liabilities.reduce((s, l) => s + l.amount, 0)
  return { totalAssets, totalLiabilities, netWorth: totalAssets - totalLiabilities }
}

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const entries = await prisma.netWorthEntry.findMany({ orderBy: { month: 'asc' } })
  return NextResponse.json({ data: entries.map(e => ({ ...e, ...computeTotals(e) })) })
}

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { month, assets, liabilities } = await request.json()

  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: 'month required (YYYY-MM)' }, { status: 400 })
  }
  if (!Array.isArray(assets) || !Array.isArray(liabilities)) {
    return NextResponse.json({ error: 'assets and liabilities must be arrays' }, { status: 400 })
  }

  const entry = await prisma.netWorthEntry.upsert({
    where: { month },
    create: {
      month,
      assets:      JSON.stringify(assets),
      liabilities: JSON.stringify(liabilities),
    },
    update: {
      assets:      JSON.stringify(assets),
      liabilities: JSON.stringify(liabilities),
    },
  })

  return NextResponse.json({ data: { ...entry, ...computeTotals(entry) } })
}
```

- [ ] **Step 2: Commit all report routes**

```bash
git add app/api/budget/reports/ app/api/budget/networth/
git commit -m "feat: add budget reports and net worth API routes"
```

---

## Chunk 5: Navigation & Page Shell

### Task 9: Add sidebar nav item and server page

**Files:**
- Modify: `components/navigation/Sidebar.tsx`
- Create: `app/admin/budget/page.tsx`

- [ ] **Step 1: Add Wallet import and Budget nav entry in `components/navigation/Sidebar.tsx`**

In the import line, add `Wallet` to the lucide-react destructure:
```typescript
// Current line (abbreviated):
import { LayoutDashboard, Users, Briefcase, ... } from 'lucide-react'
// Add Wallet to the list
```

In the `navItems` array, insert after the Activities entry:
```typescript
{ label: 'Budget', href: '/admin/budget', icon: Wallet },
```

The array should now have `Activities` then `Budget` then `Listings`.

- [ ] **Step 2: Create `app/admin/budget/page.tsx`**

```typescript
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { DashboardLayout } from '@/components/dashboard'
import { PageHeader } from '@/components/layout'
import { BudgetManager } from '@/components/budget'

export default async function BudgetPage() {
  const session = await getSession()
  if (!session) redirect('/admin/login')

  return (
    <DashboardLayout user={session}>
      <PageHeader
        title="Budget"
        subtitle="Track income, expenses, and net worth"
        breadcrumbs={[
          { label: 'Dashboard', href: '/admin/dashboard' },
          { label: 'Budget' },
        ]}
      />
      <BudgetManager />
    </DashboardLayout>
  )
}
```

- [ ] **Step 3: Verify the page loads (without BudgetManager yet — create a placeholder)**

Create `components/budget/index.ts` with a temporary export:
```typescript
export { BudgetManager } from './BudgetManager'
```

Create `components/budget/BudgetManager.tsx` with a temporary placeholder:
```typescript
'use client'
export function BudgetManager() {
  return <div className="text-white">Budget coming soon</div>
}
```

Start dev server (`npm run dev`) and navigate to `/admin/budget`. Verify: page loads, sidebar shows "Budget" link, PageHeader shows "Budget" title.

- [ ] **Step 4: Commit**

```bash
git add components/navigation/Sidebar.tsx app/admin/budget/ components/budget/
git commit -m "feat: add budget page shell and sidebar nav entry"
```

### Task 10: BudgetManager client component with tab switcher

**Files:**
- Modify: `components/budget/BudgetManager.tsx`

Replace the placeholder with the real tab container. `BudgetTab`, `TransactionsTab`, and `ReportsTab` will be stubbed — fill in for real in later tasks.

- [ ] **Step 1: Replace `components/budget/BudgetManager.tsx`**

```typescript
'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { BudgetTab } from './BudgetTab'
import { TransactionsTab } from './TransactionsTab'
import { ReportsTab } from './ReportsTab'

type Tab = 'budget' | 'transactions' | 'reports'

export function BudgetManager() {
  const [tab, setTab] = useState<Tab>('budget')

  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-1 border-b border-charcoal-800">
        {(['budget', 'transactions', 'reports'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-4 py-2.5 text-sm font-medium capitalize border-b-2 -mb-px transition-colors',
              tab === t
                ? 'border-gold-400 text-gold-400'
                : 'border-transparent text-charcoal-400 hover:text-white',
            )}
          >
            {t === 'income-expenses' ? 'Income vs Expenses' : t}
          </button>
        ))}
      </div>

      {tab === 'budget'       && <BudgetTab />}
      {tab === 'transactions' && <TransactionsTab />}
      {tab === 'reports'      && <ReportsTab />}
    </div>
  )
}
```

- [ ] **Step 2: Create stub files for the three tab components (so the app compiles)**

Create `components/budget/BudgetTab.tsx`:
```typescript
'use client'
export function BudgetTab() {
  return <div className="text-charcoal-400 text-sm">Budget tab — coming soon</div>
}
```

Create `components/budget/TransactionsTab.tsx`:
```typescript
'use client'
export function TransactionsTab() {
  return <div className="text-charcoal-400 text-sm">Transactions tab — coming soon</div>
}
```

Create `components/budget/ReportsTab.tsx`:
```typescript
'use client'
export function ReportsTab() {
  return <div className="text-charcoal-400 text-sm">Reports tab — coming soon</div>
}
```

- [ ] **Step 3: Verify tab switching works in the browser**

Navigate to `/admin/budget`. Click each of the three tabs. Verify the tab button highlights with gold underline and the stub content changes.

- [ ] **Step 4: Commit**

```bash
git add components/budget/
git commit -m "feat: add BudgetManager tab switcher with stub tab components"
```

---

## Chunk 6: Budget Tab UI

### Task 11: BudgetTab — envelope grid

**Files:**
- Modify: `components/budget/BudgetTab.tsx`
- Create: `components/budget/AllocationPanel.tsx`

- [ ] **Step 1: Replace `components/budget/BudgetTab.tsx` with the full implementation**

```typescript
'use client'

import { useState, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { Button } from '@/components/ui'
import { cn } from '@/lib/utils'
import { AllocationPanel } from './AllocationPanel'

type Category = {
  id: string; name: string; color: string; order: number
  goalType: string | null; goalAmount: number | null; goalTargetDate: string | null
}
type Group = { id: string; name: string; order: number; categories: Category[] }
type AllocData = {
  categoryId: string; month: string
  assigned: number; activity: number; available: number; note: string | null
}
type BudgetData = { readyToAssign: number; categories: AllocData[] }

function toMonth(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
function prevMonth(m: string) {
  const [y, mo] = m.split('-').map(Number)
  return mo === 1 ? `${y - 1}-12` : `${y}-${String(mo - 1).padStart(2, '0')}`
}
function nextMonth(m: string) {
  const [y, mo] = m.split('-').map(Number)
  return mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, '0')}`
}
function fmt(n: number) {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(n)
}

export function BudgetTab() {
  const [month, setMonth]                   = useState(toMonth)
  const [groups, setGroups]                 = useState<Group[]>([])
  const [budgetData, setBudgetData]         = useState<BudgetData | null>(null)
  const [loading, setLoading]               = useState(true)
  const [selectedId, setSelectedId]         = useState<string | null>(null)
  const [showAddGroup, setShowAddGroup]     = useState(false)
  const [newGroupName, setNewGroupName]     = useState('')
  const [showAddCat, setShowAddCat]         = useState<string | null>(null) // groupId
  const [newCatName, setNewCatName]         = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const [gRes, aRes] = await Promise.all([
      fetch('/api/budget/groups'),
      fetch(`/api/budget/allocations?month=${month}`),
    ])
    const gJson = await gRes.json()
    const aJson = await aRes.json()
    setGroups(gJson.data ?? [])
    setBudgetData(aJson.data ?? null)
    setLoading(false)
  }, [month])

  useEffect(() => { load() }, [load])

  const allocMap = new Map<string, AllocData>(
    budgetData?.categories.map(c => [c.categoryId, c]) ?? []
  )

  async function addGroup() {
    if (!newGroupName.trim()) return
    await fetch('/api/budget/groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newGroupName.trim() }),
    })
    setNewGroupName(''); setShowAddGroup(false); load()
  }

  async function addCategory(groupId: string) {
    if (!newCatName.trim()) return
    await fetch('/api/budget/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ groupId, name: newCatName.trim() }),
    })
    setNewCatName(''); setShowAddCat(null); load()
  }

  return (
    <div className="flex gap-6 items-start">
      <div className="flex-1 flex flex-col gap-4 min-w-0">
        {/* Month navigator + Ready to Assign */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button onClick={() => setMonth(prevMonth)} className="p-1 text-charcoal-400 hover:text-white">
              <ChevronLeft size={20} />
            </button>
            <span className="text-white font-medium w-24 text-center">{month}</span>
            <button onClick={() => setMonth(nextMonth)} className="p-1 text-charcoal-400 hover:text-white">
              <ChevronRight size={20} />
            </button>
          </div>
          {budgetData && (
            <div className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium',
              budgetData.readyToAssign >= 0
                ? 'bg-green-900/30 text-green-400'
                : 'bg-red-900/30 text-red-400',
            )}>
              Ready to Assign: {fmt(budgetData.readyToAssign)}
            </div>
          )}
        </div>

        {/* Table header */}
        <div className="grid grid-cols-4 gap-2 px-3 py-2 text-xs text-charcoal-500 font-medium uppercase tracking-wider">
          <span className="col-span-1">Category</span>
          <span className="text-right">Assigned</span>
          <span className="text-right">Activity</span>
          <span className="text-right">Available</span>
        </div>

        {loading ? (
          <div className="text-charcoal-500 text-sm px-3">Loading…</div>
        ) : groups.length === 0 ? (
          <div className="text-charcoal-500 text-sm px-3">
            No budget groups yet. Create your first group below.
          </div>
        ) : (
          groups.map(group => (
            <div key={group.id} className="flex flex-col gap-1">
              {/* Group header */}
              <div className="flex items-center justify-between px-3 py-1.5 text-xs font-semibold text-charcoal-400 uppercase tracking-wider bg-charcoal-900/60 rounded">
                <span>{group.name}</span>
                <button
                  onClick={() => { setShowAddCat(group.id); setNewCatName('') }}
                  className="text-charcoal-600 hover:text-gold-400 flex items-center gap-0.5"
                >
                  <Plus size={12} /> Add
                </button>
              </div>

              {/* Category rows */}
              {group.categories.map(cat => {
                const alloc    = allocMap.get(cat.id)
                const assigned = alloc?.assigned ?? 0
                const activity = alloc?.activity ?? 0
                const available = alloc?.available ?? 0
                const isSelected = selectedId === cat.id
                const isOver = cat.goalType === 'monthly_limit' && cat.goalAmount && activity > cat.goalAmount
                const isNear = cat.goalType === 'monthly_limit' && cat.goalAmount && activity >= cat.goalAmount * 0.8 && !isOver

                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedId(isSelected ? null : cat.id)}
                    className={cn(
                      'grid grid-cols-4 gap-2 px-3 py-2.5 rounded-lg text-sm text-left w-full transition-colors',
                      isSelected ? 'bg-charcoal-800' : 'hover:bg-charcoal-900/50',
                    )}
                  >
                    <span className="col-span-1 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                      <span className="text-white truncate">{cat.name}</span>
                    </span>
                    <span className="text-right text-charcoal-300">{fmt(assigned)}</span>
                    <span className="text-right text-charcoal-300">{fmt(activity)}</span>
                    <span className={cn(
                      'text-right font-medium',
                      isOver ? 'text-red-400' : isNear ? 'text-yellow-400' : available >= 0 ? 'text-green-400' : 'text-red-400',
                    )}>
                      {fmt(available)}
                    </span>
                  </button>
                )
              })}

              {/* Inline add-category form */}
              {showAddCat === group.id && (
                <div className="flex gap-2 px-3">
                  <input
                    autoFocus
                    value={newCatName}
                    onChange={e => setNewCatName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') addCategory(group.id); if (e.key === 'Escape') setShowAddCat(null) }}
                    placeholder="Category name…"
                    className="flex-1 bg-charcoal-800 border border-charcoal-700 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-gold-400"
                  />
                  <Button size="sm" onClick={() => addCategory(group.id)}>Add</Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowAddCat(null)}>Cancel</Button>
                </div>
              )}
            </div>
          ))
        )}

        {/* Add group */}
        {showAddGroup ? (
          <div className="flex gap-2">
            <input
              autoFocus
              value={newGroupName}
              onChange={e => setNewGroupName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addGroup(); if (e.key === 'Escape') setShowAddGroup(false) }}
              placeholder="Group name…"
              className="flex-1 bg-charcoal-900 border border-charcoal-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-gold-400"
            />
            <Button size="sm" onClick={addGroup}>Add</Button>
            <Button size="sm" variant="ghost" onClick={() => setShowAddGroup(false)}>Cancel</Button>
          </div>
        ) : (
          <Button size="sm" variant="ghost" onClick={() => setShowAddGroup(true)} className="self-start" leftIcon={<Plus size={14} />}>
            Add Group
          </Button>
        )}
      </div>

      {/* Allocation side panel */}
      {selectedId && (
        <AllocationPanel
          categoryId={selectedId}
          month={month}
          groups={groups}
          allocData={allocMap.get(selectedId) ?? null}
          onClose={() => setSelectedId(null)}
          onSaved={load}
        />
      )}
    </div>
  )
}
```

### Task 12: AllocationPanel — assign amount and goal management

**Files:**
- Create: `components/budget/AllocationPanel.tsx`

- [ ] **Step 1: Create `components/budget/AllocationPanel.tsx`**

```typescript
'use client'

import { useState } from 'react'
import { X, Plus } from 'lucide-react'
import { Button } from '@/components/ui'
import { cn } from '@/lib/utils'

type Category = {
  id: string; name: string; color: string
  goalType: string | null; goalAmount: number | null; goalTargetDate: string | null
}
type Group = { id: string; name: string; categories: Category[] }
type AllocData = { categoryId: string; month: string; assigned: number; activity: number; available: number; note: string | null }

interface Props {
  categoryId: string; month: string; groups: Group[]
  allocData: AllocData | null; onClose: () => void; onSaved: () => void
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(n)
}

function daysLeft(iso: string | null) {
  if (!iso) return null
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000)
}

export function AllocationPanel({ categoryId, month, groups, allocData, onClose, onSaved }: Props) {
  const cat = groups.flatMap(g => g.categories).find(c => c.id === categoryId)
  const [assigned, setAssigned]     = useState(String(allocData?.assigned ?? 0))
  const [saving, setSaving]         = useState(false)
  const [showGoal, setShowGoal]     = useState(false)
  const [goalType, setGoalType]     = useState(cat?.goalType ?? '')
  const [goalAmount, setGoalAmount] = useState(String(cat?.goalAmount ?? ''))

  if (!cat) return null

  const activity  = allocData?.activity ?? 0
  const available = allocData?.available ?? 0
  const goalAmt   = cat.goalAmount ?? 0
  const days      = daysLeft(cat.goalTargetDate)

  let pct = 0, barColor = 'bg-green-500'
  if (cat.goalType === 'monthly_limit' && goalAmt > 0) {
    pct = Math.min(100, (activity / goalAmt) * 100)
    barColor = pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-yellow-500' : 'bg-green-500'
  } else if (cat.goalType === 'savings_target' && goalAmt > 0) {
    pct = Math.min(100, (available / goalAmt) * 100)
  }

  async function saveAllocation() {
    setSaving(true)
    await fetch('/api/budget/allocations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categoryId, month, assigned: parseFloat(assigned) || 0 }),
    })
    setSaving(false); onSaved()
  }

  async function saveGoal() {
    await fetch(`/api/budget/categories/${categoryId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        goalType: goalType || null,
        goalAmount: goalAmount ? parseFloat(goalAmount) : null,
      }),
    })
    setShowGoal(false); onSaved()
  }

  return (
    <div className="w-72 shrink-0 bg-charcoal-900 border border-charcoal-700 rounded-xl p-4 flex flex-col gap-4 sticky top-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
          <span className="font-medium text-white">{cat.name}</span>
        </div>
        <button onClick={onClose} className="text-charcoal-400 hover:text-white"><X size={16} /></button>
      </div>

      {/* Assign */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-charcoal-400 uppercase tracking-wider font-medium">Assign for {month}</label>
        <div className="flex gap-2">
          <input
            type="number" value={assigned} min="0" step="0.01"
            onChange={e => setAssigned(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') saveAllocation() }}
            className="flex-1 bg-charcoal-800 border border-charcoal-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-gold-400"
          />
          <Button size="sm" onClick={saveAllocation} loading={saving}>Save</Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <div className="text-xs text-charcoal-400">Activity</div>
          <div className="text-white font-medium">{fmt(activity)}</div>
        </div>
        <div>
          <div className="text-xs text-charcoal-400">Available</div>
          <div className={cn('font-medium', available >= 0 ? 'text-green-400' : 'text-red-400')}>
            {fmt(available)}
          </div>
        </div>
      </div>

      {/* Goal display */}
      {cat.goalType && !showGoal && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-charcoal-400 uppercase tracking-wider">
              {cat.goalType === 'monthly_limit' ? 'Spending Limit' : 'Savings Target'}
            </span>
            <button onClick={() => setShowGoal(true)} className="text-xs text-gold-400 hover:underline">Edit</button>
          </div>
          <div className="h-2 bg-charcoal-800 rounded-full overflow-hidden">
            <div className={cn('h-full rounded-full transition-all', barColor)} style={{ width: `${pct}%` }} />
          </div>
          <p className="text-xs text-charcoal-400">
            {cat.goalType === 'monthly_limit'
              ? `${fmt(activity)} of ${fmt(goalAmt)}`
              : `${fmt(available)} of ${fmt(goalAmt)}${days !== null ? ` · ${days}d left` : ''}`
            }
          </p>
        </div>
      )}

      {/* Goal edit form */}
      {showGoal ? (
        <div className="flex flex-col gap-2">
          <select
            value={goalType}
            onChange={e => setGoalType(e.target.value)}
            className="bg-charcoal-800 border border-charcoal-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-gold-400"
          >
            <option value="">No goal</option>
            <option value="monthly_limit">Monthly Spending Limit</option>
            <option value="savings_target">Savings Target</option>
          </select>
          {goalType && (
            <input
              type="number" value={goalAmount} min="0" step="0.01"
              onChange={e => setGoalAmount(e.target.value)}
              placeholder="Goal amount"
              className="bg-charcoal-800 border border-charcoal-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-gold-400"
            />
          )}
          <div className="flex gap-2">
            <Button size="sm" onClick={saveGoal}>Save Goal</Button>
            <Button size="sm" variant="ghost" onClick={() => setShowGoal(false)}>Cancel</Button>
          </div>
        </div>
      ) : !cat.goalType && (
        <button
          onClick={() => setShowGoal(true)}
          className="text-xs text-charcoal-400 hover:text-gold-400 flex items-center gap-1 self-start"
        >
          <Plus size={12} /> Add Goal
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Manually test the Budget tab end-to-end**

1. Navigate to `/admin/budget`
2. Click "Add Group" → enter "Marketing" → press Enter. Verify group appears.
3. Click "+ Add" next to Marketing → enter "Online Ads" → press Enter. Verify category row appears with $0.00 in all columns.
4. Click the "Online Ads" row. Verify the AllocationPanel slides open on the right.
5. Type "500" in the Assign field and press Enter. Verify the "Assigned" column updates to $500.00.
6. Click "+ Add Goal" → select "Monthly Spending Limit" → enter 500 → Save Goal. Verify progress bar appears.
7. Verify "Ready to Assign" banner shows $0.00 (no income logged yet).

- [ ] **Step 3: Commit**

```bash
git add components/budget/BudgetTab.tsx components/budget/AllocationPanel.tsx
git commit -m "feat: add BudgetTab envelope grid and AllocationPanel"
```

---

## Chunk 7: Transactions Tab UI

### Task 13: ReceiptUpload component

**Files:**
- Create: `components/budget/ReceiptUpload.tsx`

- [ ] **Step 1: Create `components/budget/ReceiptUpload.tsx`**

```typescript
'use client'

import { useState, useRef } from 'react'
import { Upload, X, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/ui'

interface Props {
  value: string | null
  onChange: (url: string | null) => void
}

export function ReceiptUpload({ value, onChange }: Props) {
  const { toast } = useToast()
  const [uploading, setUploading] = useState(false)
  const [dragging, setDragging]   = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function uploadFile(file: File) {
    setUploading(true)
    const form = new FormData()
    form.append('file', file)
    const res  = await fetch('/api/uploads', { method: 'POST', body: form })
    const json = await res.json()
    setUploading(false)
    if (!res.ok) {
      toast({ title: 'Upload failed', description: json.error ?? 'Could not upload file', variant: 'destructive' })
      return
    }
    onChange(json.data.url)
  }

  function handleFiles(files: FileList | null) {
    if (files?.length) uploadFile(files[0])
  }

  const isPdf = value?.toLowerCase().endsWith('.pdf')

  if (value) {
    return (
      <div className="flex items-center gap-3 p-3 bg-charcoal-800 border border-charcoal-700 rounded-lg">
        {isPdf ? (
          <a href={value} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-charcoal-300 hover:text-white">
            <FileText size={20} className="text-gold-400 shrink-0" />
            <span>View receipt (PDF)</span>
          </a>
        ) : (
          <a href={value} target="_blank" rel="noopener noreferrer">
            <img src={value} alt="Receipt" className="h-16 w-16 object-cover rounded" />
          </a>
        )}
        <button onClick={() => onChange(null)} className="ml-auto text-charcoal-400 hover:text-red-400">
          <X size={16} />
        </button>
      </div>
    )
  }

  return (
    <div>
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files) }}
        onClick={() => inputRef.current?.click()}
        className={cn(
          'border-2 border-dashed rounded-lg p-6 flex flex-col items-center gap-2 cursor-pointer transition-colors',
          dragging ? 'border-gold-400 bg-gold-400/5' : 'border-charcoal-700 hover:border-charcoal-500',
        )}
      >
        <Upload size={24} className="text-charcoal-400" />
        <span className="text-sm text-charcoal-400 text-center">
          {uploading ? 'Uploading…' : 'Drop receipt here or click to browse'}
        </span>
        <span className="text-xs text-charcoal-600">JPG, PNG, WEBP, PDF · max 10 MB</span>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        capture="environment"
        className="hidden"
        onChange={e => handleFiles(e.target.files)}
      />
    </div>
  )
}
```

### Task 14: TransactionModal — add/edit form

**Files:**
- Create: `components/budget/TransactionModal.tsx`

Uses the existing `Modal` component from `@/components/ui` (`bg-white` interior, Escape-to-close, scroll-locked).

- [ ] **Step 1: Create `components/budget/TransactionModal.tsx`**

```typescript
'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui'
import { Button } from '@/components/ui'
import { ReceiptUpload } from './ReceiptUpload'
import { cn } from '@/lib/utils'

type Category = { id: string; name: string }
type Group    = { id: string; name: string; categories: Category[] }

export type TransactionDraft = {
  id?:         string
  type:        'income' | 'expense'
  categoryId:  string | null
  amount:      number
  date:        string    // ISO date string YYYY-MM-DD
  payee:       string
  notes:       string
  receiptUrl:  string | null
}

interface Props {
  open:     boolean
  initial?: Partial<TransactionDraft>
  groups:   Group[]
  onClose:  () => void
  onSaved:  () => void
}

function todayStr() {
  return new Date().toISOString().split('T')[0]
}

export function TransactionModal({ open, initial, groups, onClose, onSaved }: Props) {
  const [type, setType]             = useState<'income' | 'expense'>(initial?.type ?? 'expense')
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? '')
  const [amount, setAmount]         = useState(initial?.amount ? String(initial.amount) : '')
  const [date, setDate]             = useState(initial?.date ? initial.date.split('T')[0] : todayStr())
  const [payee, setPayee]           = useState(initial?.payee ?? '')
  const [notes, setNotes]           = useState(initial?.notes ?? '')
  const [receiptUrl, setReceiptUrl] = useState<string | null>(initial?.receiptUrl ?? null)
  const [saving, setSaving]         = useState(false)
  const [errors, setErrors]         = useState<Record<string, string>>({})

  function validate() {
    const e: Record<string, string> = {}
    if (!amount || parseFloat(amount) <= 0) e.amount = 'Must be greater than 0'
    if (!date) e.date = 'Date is required'
    if (type === 'expense' && !categoryId) e.categoryId = 'Category is required'
    return e
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setSaving(true)

    const body = {
      type,
      categoryId: type === 'income' ? null : categoryId,
      amount:     parseFloat(amount),
      date,
      payee:      payee || null,
      notes:      notes || null,
      receiptUrl,
    }

    const isEdit = !!initial?.id
    await fetch(
      isEdit ? `/api/budget/transactions/${initial.id}` : '/api/budget/transactions',
      { method: isEdit ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
    )
    setSaving(false)
    onSaved(); onClose()
  }

  const title = initial?.id ? 'Edit Transaction' : 'Add Transaction'

  return (
    <Modal open={open} onClose={onClose} title={title} size="md">
      <form onSubmit={submit} className="flex flex-col gap-4">
        {/* Type toggle */}
        <div className="flex rounded-lg overflow-hidden border border-charcoal-200">
          {(['expense', 'income'] as const).map(t => (
            <button key={t} type="button"
              onClick={() => { setType(t); if (t === 'income') setCategoryId('') }}
              className={cn(
                'flex-1 py-2 text-sm font-medium capitalize transition-colors',
                type === t ? 'bg-charcoal-900 text-white' : 'text-charcoal-500 hover:bg-charcoal-50',
              )}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Date */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-charcoal-500 font-medium">Date</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="border border-charcoal-200 rounded-lg px-3 py-2 text-charcoal-900 text-sm focus:outline-none focus:border-charcoal-900" />
          {errors.date && <p className="text-xs text-red-500">{errors.date}</p>}
        </div>

        {/* Payee */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-charcoal-500 font-medium">Payee</label>
          <input value={payee} onChange={e => setPayee(e.target.value)} placeholder="Who did you pay?"
            className="border border-charcoal-200 rounded-lg px-3 py-2 text-charcoal-900 text-sm focus:outline-none focus:border-charcoal-900" />
        </div>

        {/* Amount */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-charcoal-500 font-medium">Amount (CAD)</label>
          <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
            min="0.01" step="0.01" placeholder="0.00"
            className="border border-charcoal-200 rounded-lg px-3 py-2 text-charcoal-900 text-sm focus:outline-none focus:border-charcoal-900" />
          {errors.amount && <p className="text-xs text-red-500">{errors.amount}</p>}
        </div>

        {/* Category (expense only) */}
        {type === 'expense' && (
          <div className="flex flex-col gap-1">
            <label className="text-xs text-charcoal-500 font-medium">Category</label>
            <select value={categoryId} onChange={e => setCategoryId(e.target.value)}
              className="border border-charcoal-200 rounded-lg px-3 py-2 text-charcoal-900 text-sm focus:outline-none focus:border-charcoal-900">
              <option value="">Select category…</option>
              {groups.map(g => (
                <optgroup key={g.id} label={g.name}>
                  {g.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </optgroup>
              ))}
            </select>
            {errors.categoryId && <p className="text-xs text-red-500">{errors.categoryId}</p>}
          </div>
        )}

        {/* Notes */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-charcoal-500 font-medium">Notes</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
            placeholder="Optional memo…"
            className="border border-charcoal-200 rounded-lg px-3 py-2 text-charcoal-900 text-sm focus:outline-none focus:border-charcoal-900 resize-none" />
        </div>

        {/* Receipt */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-charcoal-500 font-medium">Receipt</label>
          <ReceiptUpload value={receiptUrl} onChange={setReceiptUrl} />
        </div>

        <div className="flex gap-2 pt-2">
          <Button type="submit" loading={saving} fullWidth>
            {initial?.id ? 'Save Changes' : 'Add Transaction'}
          </Button>
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
        </div>
      </form>
    </Modal>
  )
}
```

### Task 15: TransactionsTab — table, filters, lightbox

**Files:**
- Modify: `components/budget/TransactionsTab.tsx`

- [ ] **Step 1: Replace `components/budget/TransactionsTab.tsx`**

```typescript
'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui'
import { TransactionModal, type TransactionDraft } from './TransactionModal'
import { cn } from '@/lib/utils'

type TxRow = {
  id: string; type: 'income' | 'expense'
  categoryId: string | null; categoryName: string | null
  amount: number; date: string
  payee: string | null; notes: string | null; receiptUrl: string | null
}
type Group = { id: string; name: string; categories: { id: string; name: string }[] }

function toMonth(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })
}
function fmt(n: number) {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(n)
}

export function TransactionsTab() {
  const [month, setMonth]           = useState(toMonth)
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense'>('all')
  const [payeeFilter, setPayeeFilter] = useState('')
  const [sort, setSort]             = useState('date_desc')
  const [rows, setRows]             = useState<TxRow[]>([])
  const [total, setTotal]           = useState(0)
  const [loading, setLoading]       = useState(true)
  const [groups, setGroups]         = useState<Group[]>([])
  const [modalOpen, setModalOpen]   = useState(false)
  const [editDraft, setEditDraft]   = useState<Partial<TransactionDraft> | undefined>()
  const [lightbox, setLightbox]     = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const p = new URLSearchParams({ month, sort })
    if (typeFilter !== 'all') p.set('type', typeFilter)
    if (payeeFilter) p.set('payee', payeeFilter)

    const [txRes, gRes] = await Promise.all([
      fetch(`/api/budget/transactions?${p}`),
      fetch('/api/budget/groups'),
    ])
    const txJson = await txRes.json()
    const gJson  = await gRes.json()
    setRows(txJson.data?.items ?? [])
    setTotal(txJson.data?.total ?? 0)
    setGroups(gJson.data ?? [])
    setLoading(false)
  }, [month, typeFilter, payeeFilter, sort])

  useEffect(() => { load() }, [load])

  function openEdit(t: TxRow) {
    setEditDraft({
      id: t.id, type: t.type, categoryId: t.categoryId,
      amount: t.amount, date: t.date.split('T')[0],
      payee: t.payee ?? '', notes: t.notes ?? '', receiptUrl: t.receiptUrl,
    })
    setModalOpen(true)
  }

  function openNew() { setEditDraft(undefined); setModalOpen(true) }

  async function deleteRow(id: string) {
    if (!confirm('Delete this transaction?')) return
    await fetch(`/api/budget/transactions/${id}`, { method: 'DELETE' })
    load()
  }

  function toggleSort(key: string) {
    setSort(s => s === key + '_desc' ? key + '_asc' : key + '_desc')
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-charcoal-400">Month</label>
          <input type="month" value={month} onChange={e => setMonth(e.target.value)}
            className="bg-charcoal-800 border border-charcoal-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-gold-400" />
        </div>
        <div className="flex rounded-lg overflow-hidden border border-charcoal-700">
          {(['all', 'income', 'expense'] as const).map(t => (
            <button key={t} onClick={() => setTypeFilter(t)}
              className={cn('px-3 py-2 text-sm capitalize transition-colors',
                typeFilter === t ? 'bg-gold-400 text-charcoal-950' : 'text-charcoal-400 hover:text-white')}>
              {t}
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-charcoal-400">Payee</label>
          <input value={payeeFilter} onChange={e => setPayeeFilter(e.target.value)} placeholder="Search payee…"
            className="bg-charcoal-800 border border-charcoal-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-gold-400 w-44" />
        </div>
        <Button onClick={openNew} className="ml-auto" leftIcon={<Plus size={16} />}>Add Transaction</Button>
      </div>

      {/* Table */}
      <div className="bg-charcoal-900 border border-charcoal-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-charcoal-800">
              {[
                { label: 'Date',    sortKey: 'date' },
                { label: 'Payee',   sortKey: null },
                { label: 'Category', sortKey: null },
                { label: 'Amount',  sortKey: 'amount' },
                { label: 'Receipt', sortKey: null },
                { label: '',        sortKey: null },
              ].map(col => (
                <th key={col.label}
                  onClick={() => col.sortKey && toggleSort(col.sortKey)}
                  className={cn('px-4 py-3 text-left text-xs text-charcoal-500 font-medium uppercase tracking-wider',
                    col.sortKey && 'cursor-pointer hover:text-charcoal-300')}
                >
                  {col.label}
                  {col.sortKey && sort.startsWith(col.sortKey) && (
                    <span className="ml-1">{sort.endsWith('desc') ? '↓' : '↑'}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-charcoal-500">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-charcoal-500">No transactions found</td></tr>
            ) : rows.map(t => (
              <tr key={t.id}
                onClick={() => openEdit(t)}
                className="border-b border-charcoal-800/50 hover:bg-charcoal-800/30 cursor-pointer"
              >
                <td className="px-4 py-3 text-charcoal-300 whitespace-nowrap">{fmtDate(t.date)}</td>
                <td className="px-4 py-3 text-white">{t.payee ?? '—'}</td>
                <td className="px-4 py-3 text-charcoal-400">{t.categoryName ?? '—'}</td>
                <td className={cn('px-4 py-3 font-medium', t.type === 'income' ? 'text-green-400' : 'text-white')}>
                  {t.type === 'income' ? '+' : ''}{fmt(t.amount)}
                </td>
                <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                  {t.receiptUrl && (
                    t.receiptUrl.toLowerCase().endsWith('.pdf')
                      ? <a href={t.receiptUrl} target="_blank" rel="noopener noreferrer"
                          className="text-gold-400 hover:underline text-xs">PDF</a>
                      : <img src={t.receiptUrl} alt="receipt"
                          onClick={() => setLightbox(t.receiptUrl)}
                          className="h-8 w-8 object-cover rounded cursor-pointer hover:opacity-80" />
                  )}
                </td>
                <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                  <button onClick={() => deleteRow(t.id)}
                    className="text-charcoal-600 hover:text-red-400 text-xs">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && total > 0 && (
          <div className="px-4 py-3 border-t border-charcoal-800 text-xs text-charcoal-500">
            {total} transaction{total !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* Transaction modal */}
      <TransactionModal
        open={modalOpen}
        initial={editDraft}
        groups={groups}
        onClose={() => setModalOpen(false)}
        onSaved={load}
      />

      {/* Receipt lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          onClick={() => setLightbox(null)}
        >
          <img src={lightbox} alt="Receipt" className="max-w-2xl max-h-[90vh] object-contain rounded-xl" />
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Manual test the Transactions tab end-to-end**

1. Click the Transactions tab.
2. Click "Add Transaction" → set type to Income → enter amount 8000 → date → payee "May Commission" → click "Add Transaction". Verify it appears in the table with a green + amount.
3. Add an Expense → select category "Online Ads" → amount 250 → drag a test image into the receipt zone → verify thumbnail appears → save. Verify receipt thumbnail appears in the table.
4. Click the receipt thumbnail → verify lightbox opens full-screen.
5. Switch back to the Budget tab and verify "Ready to Assign" now shows $7,750 (8000 income − 250 assigned-to-envelope not triggered yet; readyToAssign = income − assigned, so $8000 − $500 assigned earlier = $7500. Activity for Online Ads shows $250 and Available dropped by $250).
6. On the Transactions tab, click the expense row → verify modal opens pre-populated → change payee → save → verify updated.

- [ ] **Step 3: Commit**

```bash
git add components/budget/ReceiptUpload.tsx components/budget/TransactionModal.tsx components/budget/TransactionsTab.tsx
git commit -m "feat: add Transactions tab with receipt upload, modal, and lightbox"
```

---

## Chunk 8: Reports Tab UI

### Task 16: ReportsTab — all three report sub-views

**Files:**
- Modify: `components/budget/ReportsTab.tsx`

All three views live in this one file as internal components. Recharts is already installed.

- [ ] **Step 1: Replace `components/budget/ReportsTab.tsx`**

```typescript
'use client'

import { useState, useEffect } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ComposedChart, Line, Legend,
  LineChart,
} from 'recharts'
import { Button } from '@/components/ui'
import { cn } from '@/lib/utils'

type View = 'spending' | 'income-expenses' | 'net-worth'

function toMonth(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
function nAgo(n: number) {
  const d = new Date(); d.setMonth(d.getMonth() - n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
function fmt(n: number) {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(n)
}

// ── Spending by Category ──────────────────────────────────────────────────────

type SpendRow = { categoryId: string | null; categoryName: string; groupName: string; color: string; total: number }

function SpendingView() {
  const [from, setFrom]       = useState(nAgo(3))
  const [to, setTo]           = useState(toMonth)
  const [data, setData]       = useState<SpendRow[]>([])
  const [loading, setLoading] = useState(false)

  async function load() {
    setLoading(true)
    const res  = await fetch(`/api/budget/reports/spending?from=${from}&to=${to}`)
    const json = await res.json()
    setData(json.data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [from, to])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-3 items-end">
        {[['From', from, setFrom], ['To', to, setTo]].map(([label, value, setter]) => (
          <div key={label as string} className="flex flex-col gap-1">
            <label className="text-xs text-charcoal-400">{label as string}</label>
            <input type="month" value={value as string} onChange={e => (setter as (v: string) => void)(e.target.value)}
              className="bg-charcoal-800 border border-charcoal-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-gold-400" />
          </div>
        ))}
      </div>

      {loading ? <p className="text-charcoal-500 text-sm">Loading…</p>
       : data.length === 0 ? <p className="text-charcoal-500 text-sm py-8 text-center">No expense data in this range</p>
       : (
        <>
          <ResponsiveContainer width="100%" height={Math.max(200, data.length * 40)}>
            <BarChart data={data} layout="vertical" margin={{ left: 130, right: 24, top: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis type="number" tickFormatter={fmt} tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis type="category" dataKey="categoryName" width={120} tick={{ fill: '#d1d5db', fontSize: 12 }} />
              <Tooltip formatter={(v: number) => fmt(v)}
                contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#fff' }} />
              <Bar dataKey="total" fill="#d4a93a" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>

          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-charcoal-800">
                <th className="text-left px-3 py-2 text-xs text-charcoal-500 font-medium uppercase">Category</th>
                <th className="text-left px-3 py-2 text-xs text-charcoal-500 font-medium uppercase">Group</th>
                <th className="text-right px-3 py-2 text-xs text-charcoal-500 font-medium uppercase">Total</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d, i) => (
                <tr key={i} className="border-b border-charcoal-800/50">
                  <td className="px-3 py-2.5 text-white">{d.categoryName}</td>
                  <td className="px-3 py-2.5 text-charcoal-400">{d.groupName}</td>
                  <td className="px-3 py-2.5 text-right font-medium text-white">{fmt(d.total)}</td>
                </tr>
              ))}
              <tr className="bg-charcoal-900/50">
                <td colSpan={2} className="px-3 py-2.5 text-charcoal-400 font-medium">Total</td>
                <td className="px-3 py-2.5 text-right font-semibold text-gold-400">
                  {fmt(data.reduce((s, d) => s + d.total, 0))}
                </td>
              </tr>
            </tbody>
          </table>
        </>
       )}
    </div>
  )
}

// ── Income vs Expenses ────────────────────────────────────────────────────────

type IERow = { month: string; income: number; expenses: number; net: number }

function IncomeExpensesView() {
  const [from, setFrom]       = useState(nAgo(12))
  const [to, setTo]           = useState(toMonth)
  const [data, setData]       = useState<IERow[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/budget/reports/income-expenses?from=${from}&to=${to}`)
      .then(r => r.json()).then(j => { setData(j.data ?? []); setLoading(false) })
  }, [from, to])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-3 items-end">
        {[['From', from, setFrom], ['To', to, setTo]].map(([label, value, setter]) => (
          <div key={label as string} className="flex flex-col gap-1">
            <label className="text-xs text-charcoal-400">{label as string}</label>
            <input type="month" value={value as string} onChange={e => (setter as (v: string) => void)(e.target.value)}
              className="bg-charcoal-800 border border-charcoal-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-gold-400" />
          </div>
        ))}
      </div>

      {loading ? <p className="text-charcoal-500 text-sm">Loading…</p> : (
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={data} margin={{ top: 8, right: 20, bottom: 8, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <YAxis tickFormatter={fmt} tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <Tooltip formatter={(v: number) => fmt(v)}
              contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#fff' }} />
            <Legend wrapperStyle={{ color: '#d1d5db' }} />
            <Bar dataKey="income"   name="Income"   fill="#4ade80" radius={[2, 2, 0, 0]} />
            <Bar dataKey="expenses" name="Expenses" fill="#f87171" radius={[2, 2, 0, 0]} />
            <Line dataKey="net" name="Net" stroke="#d4a93a" strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

// ── Net Worth ─────────────────────────────────────────────────────────────────

type MoneyItem = { label: string; amount: number }
type NWEntry   = { id: string; month: string; assets: string; liabilities: string; totalAssets: number; totalLiabilities: number; netWorth: number }

function NetWorthView() {
  const [entries, setEntries]         = useState<NWEntry[]>([])
  const [loading, setLoading]         = useState(true)
  const [assets, setAssets]           = useState<MoneyItem[]>([{ label: '', amount: 0 }])
  const [liabilities, setLiabilities] = useState<MoneyItem[]>([{ label: '', amount: 0 }])
  const [saving, setSaving]           = useState(false)
  const editMonth = toMonth()

  async function loadEntries() {
    setLoading(true)
    const json = await fetch('/api/budget/networth').then(r => r.json())
    const data: NWEntry[] = json.data ?? []
    setEntries(data)
    const cur = data.find(e => e.month === editMonth)
    if (cur) { setAssets(JSON.parse(cur.assets)); setLiabilities(JSON.parse(cur.liabilities)) }
    setLoading(false)
  }

  useEffect(() => { loadEntries() }, [])

  function updItem<T extends MoneyItem>(list: T[], set: React.Dispatch<React.SetStateAction<T[]>>, i: number, field: keyof T, v: string | number) {
    set(list.map((x, j) => j === i ? { ...x, [field]: v } : x))
  }

  async function save() {
    setSaving(true)
    await fetch('/api/budget/networth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ month: editMonth, assets, liabilities }),
    })
    setSaving(false); loadEntries()
  }

  const previewNet = assets.reduce((s, a) => s + (a.amount || 0), 0)
    - liabilities.reduce((s, l) => s + (l.amount || 0), 0)

  const chartData = entries.map(e => ({ month: e.month, netWorth: e.netWorth }))

  return (
    <div className="flex flex-col gap-6">
      {loading ? <p className="text-charcoal-500 text-sm">Loading…</p> : (
        <>
          {chartData.length >= 2 && (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={chartData} margin={{ top: 8, right: 20, bottom: 8, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                <YAxis tickFormatter={fmt} tick={{ fill: '#9ca3af', fontSize: 11 }} />
                <Tooltip formatter={(v: number) => fmt(v)}
                  contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: 8 }}
                  labelStyle={{ color: '#fff' }} />
                <Line dataKey="netWorth" name="Net Worth" stroke="#d4a93a" strokeWidth={2} dot={{ fill: '#d4a93a' }} />
              </LineChart>
            </ResponsiveContainer>
          )}

          {/* Entry form */}
          <div className="bg-charcoal-900 border border-charcoal-800 rounded-xl p-5 flex flex-col gap-5">
            <h3 className="text-white font-medium">Update {editMonth} Net Worth</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Assets */}
              <div className="flex flex-col gap-3">
                <span className="text-sm font-medium text-green-400">Assets</span>
                {assets.map((a, i) => (
                  <div key={i} className="flex gap-2">
                    <input value={a.label} onChange={e => updItem(assets, setAssets, i, 'label', e.target.value)}
                      placeholder="e.g. Cash, Car"
                      className="flex-1 bg-charcoal-800 border border-charcoal-700 rounded-lg px-2 py-1.5 text-white text-sm focus:outline-none focus:border-gold-400" />
                    <input type="number" value={a.amount || ''} onChange={e => updItem(assets, setAssets, i, 'amount', parseFloat(e.target.value) || 0)}
                      placeholder="0"
                      className="w-28 bg-charcoal-800 border border-charcoal-700 rounded-lg px-2 py-1.5 text-white text-sm focus:outline-none focus:border-gold-400" />
                    <button onClick={() => setAssets(assets.filter((_, j) => j !== i))}
                      className="text-charcoal-600 hover:text-red-400 px-1">×</button>
                  </div>
                ))}
                <button onClick={() => setAssets([...assets, { label: '', amount: 0 }])}
                  className="text-xs text-charcoal-400 hover:text-gold-400 self-start">+ Add asset</button>
              </div>

              {/* Liabilities */}
              <div className="flex flex-col gap-3">
                <span className="text-sm font-medium text-red-400">Liabilities</span>
                {liabilities.map((l, i) => (
                  <div key={i} className="flex gap-2">
                    <input value={l.label} onChange={e => updItem(liabilities, setLiabilities, i, 'label', e.target.value)}
                      placeholder="e.g. Mortgage, Car Loan"
                      className="flex-1 bg-charcoal-800 border border-charcoal-700 rounded-lg px-2 py-1.5 text-white text-sm focus:outline-none focus:border-gold-400" />
                    <input type="number" value={l.amount || ''} onChange={e => updItem(liabilities, setLiabilities, i, 'amount', parseFloat(e.target.value) || 0)}
                      placeholder="0"
                      className="w-28 bg-charcoal-800 border border-charcoal-700 rounded-lg px-2 py-1.5 text-white text-sm focus:outline-none focus:border-gold-400" />
                    <button onClick={() => setLiabilities(liabilities.filter((_, j) => j !== i))}
                      className="text-charcoal-600 hover:text-red-400 px-1">×</button>
                  </div>
                ))}
                <button onClick={() => setLiabilities([...liabilities, { label: '', amount: 0 }])}
                  className="text-xs text-charcoal-400 hover:text-gold-400 self-start">+ Add liability</button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-charcoal-800">
              <p className="text-sm text-charcoal-400">
                Net worth preview:{' '}
                <span className={cn('font-semibold', previewNet >= 0 ? 'text-green-400' : 'text-red-400')}>
                  {fmt(previewNet)}
                </span>
              </p>
              <Button onClick={save} loading={saving}>Save</Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ── Tab container ─────────────────────────────────────────────────────────────

export function ReportsTab() {
  const [view, setView] = useState<View>('spending')

  const views: { key: View; label: string }[] = [
    { key: 'spending',         label: 'Spending by Category' },
    { key: 'income-expenses',  label: 'Income vs Expenses' },
    { key: 'net-worth',        label: 'Net Worth' },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-2 flex-wrap">
        {views.map(v => (
          <button key={v.key} onClick={() => setView(v.key)}
            className={cn('px-4 py-2 rounded-full text-sm font-medium transition-colors',
              view === v.key ? 'bg-gold-400 text-charcoal-950' : 'bg-charcoal-800 text-charcoal-400 hover:text-white')}>
            {v.label}
          </button>
        ))}
      </div>

      {view === 'spending'        && <SpendingView />}
      {view === 'income-expenses' && <IncomeExpensesView />}
      {view === 'net-worth'       && <NetWorthView />}
    </div>
  )
}
```

- [ ] **Step 2: Update `components/budget/index.ts` with all exports**

```typescript
export { BudgetManager }    from './BudgetManager'
export { BudgetTab }        from './BudgetTab'
export { AllocationPanel }  from './AllocationPanel'
export { TransactionsTab }  from './TransactionsTab'
export { TransactionModal } from './TransactionModal'
export { ReceiptUpload }    from './ReceiptUpload'
export { ReportsTab }       from './ReportsTab'
```

- [ ] **Step 3: Manually test the Reports tab**

1. Navigate to the Reports tab.
2. "Spending by Category" — set from/to range covering transactions you've logged. Verify bar chart and table appear with correct category names and totals.
3. "Income vs Expenses" — verify combo chart shows income bar, expenses bar, and net line per month. Months with no activity show zero-height bars (not missing).
4. "Net Worth" — add one asset (e.g. "Cash" $50,000) and one liability (e.g. "Mortgage" $400,000). Click Save. Verify net worth preview updates. Save a second month's entry. Verify the line chart renders with two data points.

- [ ] **Step 4: Final commit**

```bash
git add components/budget/
git commit -m "feat: add Reports tab with spending, income/expense, and net worth charts"
```

---

## Final Verification Checklist

After all tasks are complete, verify the following in the browser:

- [ ] Sidebar shows "Budget" link with Wallet icon, positioned between Activities and Listings
- [ ] Budget tab: groups and categories can be added; assigning updates the Assigned column immediately; Available turns red when overspent; Ready to Assign updates when income is logged
- [ ] Roll-forward: navigate to a previous month; Available should reflect cumulative history, not just that month alone
- [ ] Goal progress bar appears after setting a monthly limit; turns yellow at 80%, red at 100%+
- [ ] Transactions tab: income rows show green + amount; expense rows show category; sort toggles by clicking Date/Amount headers; payee search filters live
- [ ] Receipt upload: drag a JPEG onto the drop zone → thumbnail appears in modal → save → thumbnail appears in table → click thumbnail → lightbox opens
- [ ] Receipt upload on mobile: the camera icon opens the device camera (test via browser dev tools device emulation or real device)
- [ ] Reports → Spending by Category: horizontal bar chart renders with gold bars
- [ ] Reports → Income vs Expenses: combo chart shows green income bars, red expense bars, gold net line
- [ ] Reports → Net Worth: save two months of data → line chart appears connecting them
- [ ] All API routes return 401 when accessed without a session (verify by opening an incognito tab)
