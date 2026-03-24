import { NextResponse } from 'next/server'
import { mockGuard } from '@/lib/mock-guard'
import { validateMockToken } from '@/lib/mock-ampre-auth'
import { parseODataFilter, applyFilter } from '@/lib/odata-filter'
import { MOCK_RESO_OFFICES } from '@/data/mock-reso-seed'

function applySelect(item: Record<string, unknown>, select: string): Record<string, unknown> {
  const fields = select.split(',').map(s => s.trim())
  return Object.fromEntries(fields.filter(f => f in item).map(f => [f, item[f]]))
}

function applyOrderBy(items: typeof MOCK_RESO_OFFICES, orderby: string): typeof MOCK_RESO_OFFICES {
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
  const top     = Math.min(500, parseInt(searchParams.get('$top') ?? '500', 10))
  const orderby = searchParams.get('$orderby') ?? ''

  const clauses = parseODataFilter(filter)
  let data: typeof MOCK_RESO_OFFICES = applyFilter(MOCK_RESO_OFFICES as unknown as Record<string, unknown>[], clauses) as unknown as typeof MOCK_RESO_OFFICES

  if (orderby) data = applyOrderBy(data, orderby)

  const page  = data.slice(0, top)
  const value = select
    ? page.map(item => applySelect(item as unknown as Record<string, unknown>, select))
    : page

  return NextResponse.json({
    '@odata.context': `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/api/mock-reso/$metadata#Office`,
    '@odata.count':   data.length,
    value,
  })
}
