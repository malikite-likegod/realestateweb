export interface FilterClause {
  field: string
  op:    'eq' | 'ne' | 'gt' | 'ge' | 'lt' | 'le'
  value: string | number | boolean | null
}

const CLAUSE_RE = /^(\w+)\s+(eq|ne|gt|ge|lt|le)\s+(.+)$/i

function parseValue(raw: string): string | number | boolean | null {
  const s = raw.trim()
  if (s === 'null')  return null
  if (s === 'true')  return true
  if (s === 'false') return false
  if ((s.startsWith("'") && s.endsWith("'")) ||
      (s.startsWith('"') && s.endsWith('"'))) {
    return s.slice(1, -1)
  }
  const n = Number(s)
  if (!isNaN(n)) return n
  return s
}

export function parseODataFilter(filter: string): FilterClause[] {
  if (!filter?.trim()) return []
  const clauses = filter.split(/\s+and\s+/i)
  const result: FilterClause[] = []
  for (const clause of clauses) {
    const m = clause.trim().match(CLAUSE_RE)
    if (!m) {
      console.warn('[odata-filter] Unsupported clause:', clause)
      continue
    }
    result.push({ field: m[1], op: m[2].toLowerCase() as FilterClause['op'], value: parseValue(m[3]) })
  }
  return result
}

/** Apply parsed filter clauses to an in-memory array. */
export function applyFilter<T extends Record<string, unknown>>(items: T[], clauses: FilterClause[]): T[] {
  if (!clauses.length) return items
  return items.filter(item => clauses.every(({ field, op, value }) => {
    const v = item[field]
    if (v === undefined) return true // unknown field — don't filter
    switch (op) {
      case 'eq': return v == value
      case 'ne': return v != value
      case 'gt': return (v as number) >  (value as number)
      case 'ge': return (v as number) >= (value as number)
      case 'lt': return (v as number) <  (value as number)
      case 'le': return (v as number) <= (value as number)
    }
  }))
}
