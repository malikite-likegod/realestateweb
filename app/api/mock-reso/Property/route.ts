import { NextResponse } from 'next/server'
import { mockGuard } from '@/lib/mock-guard'
import { validateMockToken } from '@/lib/mock-ampre-auth'
import { parseODataFilter, applyFilter } from '@/lib/odata-filter'
import { MOCK_RESO_LISTINGS } from '@/data/mock-reso-seed'

function applySelect(item: Record<string, unknown>, select: string): Record<string, unknown> {
  const fields = select.split(',').map(s => s.trim())
  return Object.fromEntries(fields.filter(f => f in item).map(f => [f, item[f]]))
}

// Real PropTx 400s on the entire request if $select names a field the account's tier doesn't
// expose. Buyer-side fields aren't confirmed available on this account's feed, so the mock
// rejects them by default — this exercises services/reso/sync.ts's closed_property tiered
// fallback locally. Set MOCK_RESO_UNSUPPORTED_FIELDS='' to simulate a tier with full access.
const UNSUPPORTED_SELECT_FIELDS = (
  process.env.MOCK_RESO_UNSUPPORTED_FIELDS ?? 'BuyerAgentFullName,BuyerOfficeKey,BuyerOfficeName'
).split(',').map(s => s.trim()).filter(Boolean)

function applyOrderBy(items: typeof MOCK_RESO_LISTINGS, orderby: string): typeof MOCK_RESO_LISTINGS {
  // Support comma-separated multi-field sort: "ModificationTimestamp,ListingKey"
  // Each field may optionally be followed by " asc" or " desc"
  const fields = orderby.split(',').map(s => {
    const parts = s.trim().split(/\s+/)
    return { field: parts[0], desc: parts[1]?.toLowerCase() === 'desc' }
  })
  return [...items].sort((a, b) => {
    for (const { field, desc } of fields) {
      const av = (a as unknown as Record<string, unknown>)[field]
      const bv = (b as unknown as Record<string, unknown>)[field]
      if (av == null && bv == null) continue
      if (av == null) return 1
      if (bv == null) return -1
      const cmp = av < bv ? -1 : av > bv ? 1 : 0
      if (cmp !== 0) return desc ? -cmp : cmp
    }
    return 0
  })
}

export async function GET(request: Request) {
  const guard = mockGuard(); if (guard) return guard
  if (!validateMockToken(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const filter  = searchParams.get('$filter')  ?? ''
  const select  = searchParams.get('$select')  ?? ''
  const top     = Math.min(500, parseInt(searchParams.get('$top')  ?? '20', 10))
  const skip    = parseInt(searchParams.get('$skip') ?? '0', 10)
  const orderby = searchParams.get('$orderby') ?? ''

  if (select) {
    const requested = select.split(',').map(s => s.trim())
    const rejected = requested.find(f => UNSUPPORTED_SELECT_FIELDS.includes(f))
    if (rejected) {
      return NextResponse.json({ error: `Invalid $select field: ${rejected}` }, { status: 400 })
    }
  }

  const clauses = parseODataFilter(filter)
  let data: typeof MOCK_RESO_LISTINGS = applyFilter(MOCK_RESO_LISTINGS as unknown as Record<string, unknown>[], clauses) as unknown as typeof MOCK_RESO_LISTINGS

  if (orderby) data = applyOrderBy(data, orderby)

  const count = data.length
  const page  = data.slice(skip, skip + top)

  const value = select
    ? page.map(item => applySelect(item as unknown as Record<string, unknown>, select))
    : page

  return NextResponse.json({
    '@odata.context': `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/api/mock-reso/$metadata#Property`,
    '@odata.count':   count,
    value,
  })
}
